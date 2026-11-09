#!/usr/bin/env node
/** Pure mapping tests — selfie local remap. */

function mapSelfieLocalDelta(lx, ly, lz) {
  return [-lx, ly, -lz];
}

function mapSelfieRelativeQuat(qx, qy, qz, qw) {
  const x1 = qz;
  const y1 = qw;
  const z1 = qx;
  const w1 = -qy;
  return [-x1, y1, -z1, w1];
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

// Into-room walk (phone +Z) → virtual look (−Z)
{
  const [x, y, z] = mapSelfieLocalDelta(0, 0, 0.5);
  assert(x === 0 && y === 0 && z === -0.5, 'forward (+Z phone) → −Z virtual (into room)');
}

// Toward window behind (phone −Z / look dir) → virtual +Z (back toward window)
{
  const [x, y, z] = mapSelfieLocalDelta(0, 0, -0.4);
  assert(z === 0.4, 'back toward window (−Z phone) → +Z virtual (behind)');
}

// Up
{
  const [x, y, z] = mapSelfieLocalDelta(0, 0.3, 0);
  assert(y === 0.3 && x === 0 && z === 0, 'up stays +Y');
}

// User's right: phone moves −X in front-cam frame → virtual +X
{
  const [x, y, z] = mapSelfieLocalDelta(-0.2, 0, 0);
  assert(x === 0.2, 'user-right (−X phone) → +X virtual');
}

// Identity relative quat after selfie map should be finite unit-ish
{
  const q = mapSelfieRelativeQuat(0, 0, 0, 1);
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  assert(Math.abs(n - 1) < 1e-9, 'identity relative maps to unit quat');
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('\nAll pose-map tests passed.');
