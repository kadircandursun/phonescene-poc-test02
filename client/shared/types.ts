export type Role = 'mobile' | 'desktop';

/** Legacy Safari DeviceOrientation path (TEST 02–04). */
export type SensorPayload = {
  type: 'sensor';
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  t: number;
};

/**
 * Native / future sender pose over DataChannel.
 * 6dof uses px/py/pz + quaternion; 3dof may omit position and use euler fields.
 * Sender `t` should be a monotonic clock (ms); receiver does not treat wall clocks as equal.
 */
export type PosePayload = {
  type: 'pose';
  mode: '6dof' | '3dof';
  t: number;
  px?: number | null;
  py?: number | null;
  pz?: number | null;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  trackingState?: string;
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  /** Optional horizontal FOV degrees from camera intrinsics. */
  fovY?: number | null;
};

export type MediaChannelPayload = SensorPayload | PosePayload;

export type StatusTone = 'idle' | 'ok' | 'warn' | 'error';

export function isSensorPayload(v: unknown): v is SensorPayload {
  return !!v && typeof v === 'object' && (v as SensorPayload).type === 'sensor';
}

export function isPosePayload(v: unknown): v is PosePayload {
  return !!v && typeof v === 'object' && (v as PosePayload).type === 'pose';
}
