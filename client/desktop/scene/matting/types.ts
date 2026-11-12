export type QualityProfile = 'performance' | 'balanced' | 'quality';

export type MattingBackendId = 'phone' | 'bgm' | 'rvm' | 'modnet' | 'rtx' | 'mediapipe';

export type MatteState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string;
  lastInferMs: number;
  inferFps: number;
  busy: boolean;
  profile: QualityProfile;
  hasMask: boolean;
  backend: MattingBackendId;
  softAlpha: boolean;
  featherPx: number;
  growPx: number;
};

export type MatteBackend = {
  readonly id: MattingBackendId;
  readonly softAlpha: boolean;
  init(onStatus?: (msg: string) => void): Promise<void>;
  setProfile(profile: QualityProfile): void;
  maybeMatte(video: HTMLVideoElement): void;
  getMaskCanvas(): HTMLCanvasElement | null;
  /** Optional despilled person RGBA (BGM fgr). */
  getPersonCanvas?(): HTMLCanvasElement | null;
  getState(): Omit<MatteState, 'backend' | 'softAlpha' | 'featherPx' | 'growPx'> & {
    featherPx: number;
    growPx: number;
  };
};
