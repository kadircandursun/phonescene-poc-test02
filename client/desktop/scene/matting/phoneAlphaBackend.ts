import type { MatteBackend, QualityProfile } from './types';

/**
 * Soft alpha from iPhone Vision (second WebRTC video track).
 * No empty-background plate — works while user/phone moves.
 */
export class PhoneAlphaMattingBackend implements MatteBackend {
  readonly id = 'phone' as const;
  readonly softAlpha = true;

  private status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private errorMessage = '';
  private profile: QualityProfile = 'balanced';
  private hasMask = false;
  private lastInferMs = 0;
  private inferFps = 0;
  private inferCount = 0;
  private inferWindowStart = performance.now();
  private lastSampleAt = 0;

  private alphaVideo: HTMLVideoElement | null = null;
  private readonly maskCanvas = document.createElement('canvas');
  private readonly maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true })!;
  private readonly workCanvas = document.createElement('canvas');
  private readonly workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true })!;

  async init(onStatus?: (msg: string) => void): Promise<void> {
    this.status = 'ready';
    onStatus?.(
      this.alphaVideo
        ? 'Phone Vision alpha track bağlı'
        : 'Phone Vision alpha bekleniyor (iOS rebuild) — RVM yedek aktif olabilir',
    );
  }

  setProfile(profile: QualityProfile) {
    this.profile = profile;
  }

  /** Attach grayscale/BGRA alpha track from phone. */
  attachAlphaTrack(track: MediaStreamTrack) {
    if (!this.alphaVideo) {
      this.alphaVideo = document.createElement('video');
      this.alphaVideo.muted = true;
      this.alphaVideo.playsInline = true;
      this.alphaVideo.autoplay = true;
    }
    this.alphaVideo.srcObject = new MediaStream([track]);
    void this.alphaVideo.play().catch(() => undefined);
    this.status = 'ready';
    this.errorMessage = '';
  }

  hasAlphaTrack() {
    return !!this.alphaVideo?.srcObject;
  }

  maybeMatte(_video: HTMLVideoElement): void {
    const v = this.alphaVideo;
    if (!v || v.readyState < 2 || v.videoWidth < 2) return;

    const now = performance.now();
    const interval = this.profile === 'quality' ? 33 : this.profile === 'performance' ? 66 : 40;
    if (now - this.lastSampleAt < interval) return;
    this.lastSampleAt = now;

    const t0 = performance.now();
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (this.workCanvas.width !== w || this.workCanvas.height !== h) {
      this.workCanvas.width = w;
      this.workCanvas.height = h;
    }
    if (this.maskCanvas.width !== w || this.maskCanvas.height !== h) {
      this.maskCanvas.width = w;
      this.maskCanvas.height = h;
    }

    this.workCtx.drawImage(v, 0, 0, w, h);
    const img = this.workCtx.getImageData(0, 0, w, h);
    const src = img.data;
    const out = this.maskCtx.createImageData(w, h);
    const dst = out.data;
    for (let i = 0; i < src.length; i += 4) {
      // Vision alpha encoded as luma (or in R); take max channel as soft alpha.
      const a = Math.max(src[i]!, src[i + 1]!, src[i + 2]!);
      dst[i] = 255;
      dst[i + 1] = 255;
      dst[i + 2] = 255;
      dst[i + 3] = a;
    }
    this.maskCtx.putImageData(out, 0, 0);
    this.hasMask = true;
    this.lastInferMs = performance.now() - t0;

    this.inferCount += 1;
    const elapsed = performance.now() - this.inferWindowStart;
    if (elapsed >= 1000) {
      this.inferFps = Math.round((this.inferCount * 1000) / elapsed);
      this.inferCount = 0;
      this.inferWindowStart = performance.now();
    }
  }

  getMaskCanvas() {
    return this.hasMask ? this.maskCanvas : null;
  }

  getState() {
    return {
      status: this.hasMask ? this.status : this.alphaVideo ? 'loading' : 'idle',
      errorMessage: this.errorMessage,
      lastInferMs: this.lastInferMs,
      inferFps: this.inferFps,
      busy: false,
      profile: this.profile,
      hasMask: this.hasMask,
      featherPx: 0.4,
      growPx: 0,
    };
  }
}
