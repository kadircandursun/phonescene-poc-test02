/**
 * ARKit front-camera (selfie) → virtual room camera helpers.
 *
 * Hold model (Recenter pose):
 * - Phone upright portrait, screen toward face
 * - Window behind body; virtual camera looks into the room
 *
 * ARKit camera local (sensor): +X right-of-image, +Y up-of-image, −Z look
 * On iPhone portrait face-tracking the buffer is landscape-native, so when the
 * phone is upright those axes are rolled ~90° vs the phone body:
 *   cam +X ≈ phone up
 *   cam +Y ≈ phone right
 *   cam +Z ≈ out the back (into room when window is behind)
 *
 * Virtual camera (Three): +X right, +Y up, −Z look-into-room
 * Device-tuned maps (rotation and translation signs differ — hardware):
 *   rot  (qy, qx, −qz, qw) — turns OK
 *   pos  (y, −x, z) — walk X/Z flipped after device report that
 *        forward/right moved toward the window / opposite side
 */

export function mapArkitPosition(px: number, py: number, pz: number): [number, number, number] {
  // World positions stay as ARKit reports; remapping happens in phone-local deltas.
  return [px, py, pz];
}

export function mapArkitQuat(qx: number, qy: number, qz: number, qw: number): [number, number, number, number] {
  return [qx, qy, qz, qw];
}

/** Camera-local translation → virtual-camera-local (portrait selfie). */
export function mapSelfieLocalDelta(lx: number, ly: number, lz: number): [number, number, number] {
  // Keep Y from pitch-tuned map; flip X and Z so walk matches corrected turns.
  return [ly, -lx, lz];
}

/**
 * Relative camera rotation → relative virtual rotation (portrait selfie).
 * Portrait roll: cam pitch↔yaw swap into virtual yaw/pitch.
 * Pitch output sign flipped after device report (up/down inverted);
 * yaw sign kept so left/right stays correct: (qy, qx, −qz, qw).
 */
export function mapSelfieRelativeQuat(
  qx: number,
  qy: number,
  qz: number,
  qw: number,
): [number, number, number, number] {
  return [qy, qx, -qz, qw];
}
