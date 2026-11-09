import * as THREE from 'three';

/**
 * Maps DeviceOrientation (alpha/beta/gamma) → Three.js camera quaternion.
 *
 * Video-call mental model:
 * - Hold phone upright in front of your face, then Recenter (or wait for auto).
 * - That pose becomes "looking straight into the room".
 * - Tilt up → ceiling, tilt down → floor, turn → look around (3DoF only).
 */
export class OrientationTracker {
  private readonly current = new THREE.Quaternion();
  private readonly smoothed = new THREE.Quaternion();
  private readonly baselineInv = new THREE.Quaternion();
  private readonly relative = new THREE.Quaternion();
  private readonly restQuat = new THREE.Quaternion();
  private readonly scratchEuler = new THREE.Euler();
  private readonly q0 = new THREE.Quaternion();
  private readonly q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2); // -90° X
  private readonly zee = new THREE.Vector3(0, 0, 1);

  private hasSample = false;
  private hasBaseline = false;
  private uprightMs = 0;
  private lastUpdateAt = 0;
  trackingEnabled = true;
  slerpFactor = 0.22;

  get hasSensorSample() {
    return this.hasSample;
  }

  get isBaselineReady() {
    return this.hasBaseline;
  }

  /** Manual offset used when tracking is off or no sensor data. */
  readonly manualEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  /** Forward look into the room (from camera.lookAt). Relative sensor motion is applied on top. */
  setRestQuaternion(q: THREE.Quaternion) {
    this.restQuat.copy(q);
  }

  updateFromSensors(alpha: number | null, beta: number | null, gamma: number | null) {
    if (alpha == null || beta == null || gamma == null) return;
    if (!Number.isFinite(alpha) || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;

    const now = performance.now();
    const dt = this.lastUpdateAt ? Math.min(100, now - this.lastUpdateAt) : 16;
    this.lastUpdateAt = now;

    const a = THREE.MathUtils.degToRad(alpha);
    const b = THREE.MathUtils.degToRad(beta);
    const g = THREE.MathUtils.degToRad(gamma);
    const orient = THREE.MathUtils.degToRad(this.screenOrientationDeg());

    // Device frame → world, then screen orientation correction.
    this.scratchEuler.set(b, a, -g, 'YXZ');
    this.current.setFromEuler(this.scratchEuler);
    this.current.multiply(this.q1);
    this.current.multiply(this.q0.setFromAxisAngle(this.zee, -orient));
    this.hasSample = true;

    // Auto-baseline only when phone looks like a normal selfie hold (roughly upright).
    // Avoid capturing "phone flat / pointed at floor" as the zero pose.
    const upright = beta >= 35 && beta <= 105 && Math.abs(gamma) <= 45;
    if (!this.hasBaseline) {
      if (upright) {
        this.uprightMs += dt;
        if (this.uprightMs >= 250) this.captureBaseline();
      } else {
        this.uprightMs = 0;
      }
    }
  }

  recenter() {
    if (this.hasSample) this.captureBaseline();
    this.manualEuler.set(0, 0, 0);
    this.smoothed.identity();
  }

  private captureBaseline() {
    this.baselineInv.copy(this.current).invert();
    this.hasBaseline = true;
    this.smoothed.identity();
    this.uprightMs = 0;
  }

  addManualDelta(yawDelta: number, pitchDelta: number) {
    this.manualEuler.y += yawDelta;
    this.manualEuler.x = THREE.MathUtils.clamp(this.manualEuler.x + pitchDelta, -1.2, 1.2);
  }

  getCameraQuaternion(out: THREE.Quaternion): THREE.Quaternion {
    if (this.trackingEnabled && this.hasSample && this.hasBaseline) {
      this.relative.copy(this.baselineInv).multiply(this.current);
      // Phone tilt up/down was inverted vs room view — flip pitch only.
      this.scratchEuler.setFromQuaternion(this.relative, 'YXZ');
      this.scratchEuler.x = -this.scratchEuler.x;
      this.relative.setFromEuler(this.scratchEuler);
      this.smoothed.slerp(this.relative, this.slerpFactor);
      // Rest = looking into the room; sensor delta turns that view.
      out.copy(this.restQuat).multiply(this.smoothed);
    } else if (this.trackingEnabled && this.hasSample && !this.hasBaseline) {
      // Waiting for upright auto-recenter — keep resting forward view.
      out.copy(this.restQuat);
    } else {
      out.copy(this.restQuat);
      const manual = new THREE.Quaternion().setFromEuler(this.manualEuler);
      out.multiply(manual);
    }
    return out;
  }

  private screenOrientationDeg(): number {
    const so = window.screen.orientation?.angle;
    if (typeof so === 'number') return so;
    const legacy = (window as Window & { orientation?: number }).orientation;
    return typeof legacy === 'number' ? legacy : 0;
  }
}
