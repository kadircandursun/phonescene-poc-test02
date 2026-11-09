export type Role = 'mobile' | 'desktop';

export type SensorPayload = {
  type: 'sensor';
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  t: number;
};

export type StatusTone = 'idle' | 'ok' | 'warn' | 'error';
