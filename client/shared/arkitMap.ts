/**
 * ARKit front-camera (selfie) → virtual room camera helpers.
 *
 * Hold model (Recenter pose):
 * - Phone upright, screen toward face
 * - Front camera looks at user; if window is behind the body, camera looks toward the window
 * - Virtual camera looks *into* the room (opposite), window stays behind
 *
 * Phone camera local (ARKit / OpenGL): +X right, +Y up, −Z look
 * User body (window behind): forward into room ≈ phone +Z (out the back of the phone)
 * Virtual camera local (Three): +X right, +Y up, −Z look-into-room
 *
 * Therefore phone-local → virtual-local:
 *   x' = −x   (selfie mirror: user's right → view right)
 *   y' =  y   (up stays up)
 *   z' = −z   (phone +Z into room → virtual −Z look / into room)
 */

export function mapArkitPosition(px: number, py: number, pz: number): [number, number, number] {
  // World positions stay as ARKit reports; remapping happens in phone-local deltas.
  return [px, py, pz];
}

export function mapArkitQuat(qx: number, qy: number, qz: number, qw: number): [number, number, number, number] {
  return [qx, qy, qz, qw];
}

/** Phone-camera-local translation → virtual-camera-local (selfie). */
export function mapSelfieLocalDelta(lx: number, ly: number, lz: number): [number, number, number] {
  return [-lx, ly, -lz];
}

/**
 * Relative phone rotation → relative virtual rotation (selfie).
 * 1) 180° yaw so look flips from toward-user to into-room
 * 2) Mirror XZ so left/right match the mirrored selfie view
 */
export function mapSelfieRelativeQuat(
  qx: number,
  qy: number,
  qz: number,
  qw: number,
): [number, number, number, number] {
  // q180y * q  with q180y = (0,1,0,0) → (qz, qw, qx, -qy)
  const x1 = qz;
  const y1 = qw;
  const z1 = qx;
  const w1 = -qy;
  // Mirror through YZ: (-x, y, -z, w)
  return [-x1, y1, -z1, w1];
}
