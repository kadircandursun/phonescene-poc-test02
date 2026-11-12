#!/usr/bin/env node
/** Pure mapping tests — portrait selfie remap (device-tuned). */

function mapSelfieLocalDelta(lx, ly, lz) {
  return [ly, -lx, lz];
}

function mapSelfieRelativeQuat(qx, qy, qz, qw) {
  return [qy, qx, -qz, qw];
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  } else {
    console.log('PASS', msg);
  }
}

function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

{
  const [x, y, z] = mapSelfieLocalDelta(0, 0, 0.5);
  assert(x === 0 && y === 0 && z === 0.5, 'into-room (+Z cam) → +Z virtual (behind cam look; walk fix)');
}

{
  const [x, y, z] = mapSelfieLocalDelta(0, 0, -0.4);
  assert(z === -0.4, 'toward window (−Z cam) → −Z virtual');
}

{
  const [x, y, z] = mapSelfieLocalDelta(0.3, 0, 0);
  assert(x === 0 && y === -0.3 && z === 0, 'phone-up (+X cam) → −Y virtual');
}

{
  const [x, y, z] = mapSelfieLocalDelta(0, 0.2, 0);
  assert(x === 0.2 && y === 0 && z === 0, 'phone-right (+Y cam) → +X virtual');
}

{
  const q = mapSelfieRelativeQuat(0, 0, 0, 1);
  assert(
    approx(q[0], 0) && approx(q[1], 0) && approx(q[2], 0) && approx(q[3], 1),
    'identity relative → identity',
  );
}

{
  const s = 0.1;
  const q = mapSelfieRelativeQuat(s, 0, 0, 1);
  assert(approx(q[0], 0) && approx(q[1], s), 'cam pitch → virtual yaw');
}

{
  const s = 0.1;
  const q = mapSelfieRelativeQuat(0, s, 0, 1);
  assert(approx(q[0], s) && approx(q[1], 0), 'cam yaw → virtual pitch');
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('\nAll pose-map tests passed.');
