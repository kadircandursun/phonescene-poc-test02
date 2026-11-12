import type { MatteBackend, QualityProfile } from './types';

/**
 * NVIDIA RTX / Maxine / Video Effects Green Screen — product hook.
 * PoC does not link the proprietary SDK; selecting this backend reports error
 * until an RTX machine + SDK build is wired.
 */
export class RtxMattingBackend implements MatteBackend {
  readonly id = 'rtx' as const;
  readonly softAlpha = true;

  private status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private errorMessage = '';
  private profile: QualityProfile = 'balanced';

  async init(onStatus?: (msg: string) => void): Promise<void> {
    this.status = 'error';
    this.errorMessage =
      'NVIDIA RTX matting SDK not linked in PoC — use MODNet/ONNX on standard GPU';
    onStatus?.(this.errorMessage);
    throw new Error(this.errorMessage);
  }

  setProfile(profile: QualityProfile) {
    this.profile = profile;
  }

  maybeMatte(_video: HTMLVideoElement) {
    /* no-op until SDK wired */
  }

  getMaskCanvas() {
    return null;
  }

  getState() {
    return {
      status: this.status,
      errorMessage: this.errorMessage,
      lastInferMs: 0,
      inferFps: 0,
      busy: false,
      profile: this.profile,
      hasMask: false,
      featherPx: 1.2,
      growPx: 0,
    };
  }
}
