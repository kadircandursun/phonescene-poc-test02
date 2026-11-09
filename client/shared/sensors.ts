import type { SensorPayload } from './types';

export type SensorPermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

export async function requestOrientationPermission(): Promise<SensorPermissionState> {
  const DOE = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<PermissionState>;
  };

  if (typeof DOE === 'undefined') return 'unsupported';

  if (typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  return 'granted';
}

export function attachOrientationListener(
  onSample: (payload: SensorPayload) => void,
  minIntervalMs = 50,
): () => void {
  let last = 0;
  const handler = (event: DeviceOrientationEvent) => {
    const now = Date.now();
    if (now - last < minIntervalMs) return;
    last = now;
    onSample({
      type: 'sensor',
      alpha: Number.isFinite(event.alpha) ? event.alpha : null,
      beta: Number.isFinite(event.beta) ? event.beta : null,
      gamma: Number.isFinite(event.gamma) ? event.gamma : null,
      t: now,
    });
  };
  window.addEventListener('deviceorientation', handler);
  return () => window.removeEventListener('deviceorientation', handler);
}

export function formatAngle(value: number | null | undefined): string {
  return Number.isFinite(value) ? `${(value as number).toFixed(1)}°` : '—';
}
