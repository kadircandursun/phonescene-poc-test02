/** Pure ARKit → Three axis helpers (no Three.js dependency). */

/**
 * Front-camera / selfie 6DoF: invert Z so walking toward a window *behind*
 * the user moves the virtual camera toward the window behind (not the far wall).
 * Hardware check 2026-11-09: with (x,y,-z) forward walked away from rear window.
 */
export function mapArkitPosition(px: number, py: number, pz: number): [number, number, number] {
  return [px, py, pz];
}

export function mapArkitQuat(qx: number, qy: number, qz: number, qw: number): [number, number, number, number] {
  return [qx, qy, qz, qw];
}
