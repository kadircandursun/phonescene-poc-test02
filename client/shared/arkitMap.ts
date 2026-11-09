/** Pure ARKit → Three axis helpers (no Three.js dependency). */

export function mapArkitPosition(px: number, py: number, pz: number): [number, number, number] {
  return [px, py, -pz];
}

export function mapArkitQuat(qx: number, qy: number, qz: number, qw: number): [number, number, number, number] {
  return [qx, qy, -qz, qw];
}
