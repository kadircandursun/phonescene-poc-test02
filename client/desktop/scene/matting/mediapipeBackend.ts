import { PersonSegmenter, type QualityProfile } from '../segmenter';
import type { MatteBackend } from './types';

/** Legacy binary selfie segmenter — fallback only. */
export class MediaPipeMattingBackend implements MatteBackend {
  readonly id = 'mediapipe' as const;
  readonly softAlpha = false;
  private readonly inner = new PersonSegmenter();

  init(onStatus?: (msg: string) => void) {
    return this.inner.init(onStatus);
  }

  setProfile(profile: QualityProfile) {
    this.inner.setProfile(profile);
  }

  maybeMatte(video: HTMLVideoElement) {
    this.inner.maybeSegment(video);
  }

  getMaskCanvas() {
    return this.inner.getMaskCanvas();
  }

  getState() {
    const s = this.inner.getState();
    return {
      status: s.status,
      errorMessage: s.errorMessage,
      lastInferMs: s.lastInferMs,
      inferFps: s.inferFps,
      busy: s.busy,
      profile: s.profile,
      hasMask: s.hasMask,
      featherPx: s.featherPx,
      growPx: s.growPx,
    };
  }
}
