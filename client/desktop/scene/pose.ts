import * as THREE from 'three';
import { mapArkitPosition, mapArkitQuat } from '../../shared/arkitMap';

/**
 * ARKit camera space → Three.js camera space (both Y-up, right-handed).
 * Selfie map is passthrough (dx, dy, dz); room rest has window behind. Face anchor ≠ pose.
 */
export function arkitPositionToThree(px: number, py: number, pz: number, out: THREE.Vector3): THREE.Vector3 {
  const [x, y, z] = mapArkitPosition(px, py, pz);
  return out.set(x, y, z);
}

export function arkitQuatToThree(qx: number, qy: number, qz: number, qw: number, out: THREE.Quaternion): THREE.Quaternion {
  const [x, y, z, w] = mapArkitQuat(qx, qy, qz, qw);
  return out.set(x, y, z, w).normalize();
}

export type SixDofSample = {
  px: number;
  py: number;
  pz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  trackingState?: string;
};

/**
 * Applies real camera 6DoF on top of VirtualRoom rest pose.
 * Falls back silently when no position samples exist (3DoF OrientationTracker remains owner of rotation).
 */
export class SixDofTracker {
  private readonly currentPos = new THREE.Vector3();
  private readonly currentQuat = new THREE.Quaternion();
  private readonly baselinePos = new THREE.Vector3();
  private readonly baselineQuatInv = new THREE.Quaternion();
  private readonly relativePos = new THREE.Vector3();
  private readonly relativeQuat = new THREE.Quaternion();
  private readonly smoothedPos = new THREE.Vector3();
  private readonly smoothedQuat = new THREE.Quaternion();
  private readonly scratchPos = new THREE.Vector3();
  private readonly scratchQuat = new THREE.Quaternion();

  private hasSample = false;
  private hasBaseline = false;
  private lastGoodAt = 0;
  private lost = false;

  /** Meters of phone motion → room units (PoC scale). */
  positionScale = 1.2;
  slerpFactor = 0.25;
  /** Hold last pose this long after tracking lost. */
  lostHoldMs = 800;

  get hasPoseSample() {
    return this.hasSample;
  }

  get isBaselineReady() {
    return this.hasBaseline;
  }

  get isLost() {
    return this.lost;
  }

  update(sample: SixDofSample) {
    const state = sample.trackingState || 'normal';
    if (state.startsWith('notAvailable')) {
      this.lost = true;
      return;
    }
    if (state.startsWith('limited')) {
      // Still accept samples but mark soft-lost for UI.
      this.lost = true;
    } else {
      this.lost = false;
    }

    arkitPositionToThree(sample.px, sample.py, sample.pz, this.currentPos);
    arkitQuatToThree(sample.qx, sample.qy, sample.qz, sample.qw, this.currentQuat);
    this.hasSample = true;
    this.lastGoodAt = performance.now();

    if (!this.hasBaseline) this.captureBaseline();
  }

  recenter() {
    if (this.hasSample) this.captureBaseline();
    this.smoothedPos.set(0, 0, 0);
    this.smoothedQuat.identity();
  }

  private captureBaseline() {
    this.baselinePos.copy(this.currentPos);
    this.baselineQuatInv.copy(this.currentQuat).invert();
    this.hasBaseline = true;
    this.smoothedPos.set(0, 0, 0);
    this.smoothedQuat.identity();
  }

  /**
   * Writes camera world position/quaternion relative to room rest pose.
   * Position delta is expressed in the phone's baseline-local frame, then
   * re-applied in the room rest frame — otherwise walking "back" drifts on
   * world axes and feels detached from the virtual window.
   * Returns false if 6DoF should not drive the camera (caller keeps 3DoF).
   */
  applyToCamera(
    restPosition: THREE.Vector3,
    restQuaternion: THREE.Quaternion,
    outPosition: THREE.Vector3,
    outQuaternion: THREE.Quaternion,
  ): boolean {
    if (!this.hasSample || !this.hasBaseline) return false;
    if (this.lost && performance.now() - this.lastGoodAt > this.lostHoldMs) return false;

    // World delta (mapped ARKit → Three) → baseline-local → rest-camera world.
    this.scratchPos.copy(this.currentPos).sub(this.baselinePos);
    this.scratchPos.applyQuaternion(this.baselineQuatInv);
    this.scratchPos.multiplyScalar(this.positionScale);
    this.relativePos.copy(this.scratchPos).applyQuaternion(restQuaternion);

    this.relativeQuat.copy(this.baselineQuatInv).multiply(this.currentQuat);

    this.smoothedPos.lerp(this.relativePos, this.slerpFactor);
    this.smoothedQuat.slerp(this.relativeQuat, this.slerpFactor);

    outPosition.copy(restPosition).add(this.smoothedPos);
    outQuaternion.copy(restQuaternion).multiply(this.smoothedQuat);
    return true;
  }

  /** Test helper — pure relative position after baseline. */
  debugRelativePosition(out = this.scratchPos): THREE.Vector3 {
    return out.copy(this.currentPos).sub(this.baselinePos);
  }
}
