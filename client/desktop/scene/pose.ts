import * as THREE from 'three';
import {
  mapArkitPosition,
  mapArkitQuat,
  mapSelfieLocalDelta,
  mapSelfieRelativeQuat,
} from '../../shared/arkitMap';

/**
 * ARKit camera → Three.js. Face anchor pose must NEVER feed this class.
 * Native path is front-camera selfie; deltas remapped in phone-local space.
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
 * 6DoF on top of VirtualRoom rest pose (selfie / front camera).
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
  private normalMs = 0;
  private lastTickAt = 0;

  /** Meters of phone motion → room units. */
  positionScale = 1.35;
  slerpFactor = 0.28;
  lostHoldMs = 800;
  /** Wait for stable tracking before auto-baseline (avoid floor/tilt start). */
  settleMs = 280;

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
    const now = performance.now();
    const dt = this.lastTickAt ? Math.min(100, now - this.lastTickAt) : 16;
    this.lastTickAt = now;

    const state = sample.trackingState || 'normal';
    if (state.startsWith('notAvailable')) {
      this.lost = true;
      this.normalMs = 0;
      return;
    }
    if (state.startsWith('limited')) {
      this.lost = true;
      this.normalMs = 0;
    } else {
      this.lost = false;
      this.normalMs += dt;
    }

    arkitPositionToThree(sample.px, sample.py, sample.pz, this.currentPos);
    arkitQuatToThree(sample.qx, sample.qy, sample.qz, sample.qw, this.currentQuat);
    this.hasSample = true;
    this.lastGoodAt = now;

    if (!this.hasBaseline && !this.lost && this.normalMs >= this.settleMs) {
      this.captureBaseline();
    }
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
    this.normalMs = 0;
  }

  /**
   * Phone world delta → phone-local → selfie remap → rest-camera world.
   */
  applyToCamera(
    restPosition: THREE.Vector3,
    restQuaternion: THREE.Quaternion,
    outPosition: THREE.Vector3,
    outQuaternion: THREE.Quaternion,
  ): boolean {
    if (!this.hasSample || !this.hasBaseline) return false;
    if (this.lost && performance.now() - this.lastGoodAt > this.lostHoldMs) return false;

    // 1) World delta in phone axes at baseline
    this.scratchPos.copy(this.currentPos).sub(this.baselinePos);
    this.scratchPos.applyQuaternion(this.baselineQuatInv);

    // 2) Selfie local remap (mirror X, flip Z)
    const [sx, sy, sz] = mapSelfieLocalDelta(this.scratchPos.x, this.scratchPos.y, this.scratchPos.z);
    this.scratchPos.set(sx, sy, sz).multiplyScalar(this.positionScale);

    // 3) Into room rest frame
    this.relativePos.copy(this.scratchPos).applyQuaternion(restQuaternion);

    // Rotation: relative phone quat → selfie remap → rest
    this.scratchQuat.copy(this.baselineQuatInv).multiply(this.currentQuat);
    const [rx, ry, rz, rw] = mapSelfieRelativeQuat(
      this.scratchQuat.x,
      this.scratchQuat.y,
      this.scratchQuat.z,
      this.scratchQuat.w,
    );
    this.relativeQuat.set(rx, ry, rz, rw).normalize();

    this.smoothedPos.lerp(this.relativePos, this.slerpFactor);
    this.smoothedQuat.slerp(this.relativeQuat, this.slerpFactor);

    outPosition.copy(restPosition).add(this.smoothedPos);
    outQuaternion.copy(restQuaternion).multiply(this.smoothedQuat);
    return true;
  }

  debugRelativePosition(out = this.scratchPos): THREE.Vector3 {
    return out.copy(this.currentPos).sub(this.baselinePos);
  }
}
