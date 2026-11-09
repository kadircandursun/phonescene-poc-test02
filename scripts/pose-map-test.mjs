#!/usr/bin/env node
/** Pure mapping tests — no browser / no phone. */

function mapArkitPosition(px, py, pz) {
  return [px, py, -pz];
}
function mapArkitQuat(qx, qy, qz, qw) {
  return [qx, qy, -qz, qw];
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

const p = mapArkitPosition(0.1, 0.2, 0.3);
assert(p[0] === 0.1 && p[1] === 0.2 && p[2] === -0.3, 'position Z flip');

const q = mapArkitQuat(0.1, 0.2, 0.3, 0.9);
assert(q[0] === 0.1 && q[1] === 0.2 && q[2] === -0.3 && q[3] === 0.9, 'quat Z flip');

// Relative forward: phone moves +Z in ARKit → Three -Z into room
const a = mapArkitPosition(0, 0, 0);
const b = mapArkitPosition(0, 0, 0.5);
const dz = b[2] - a[2];
assert(dz === -0.5, 'forward phone motion maps to -Z in Three');

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('\nAll pose-map tests passed.');
