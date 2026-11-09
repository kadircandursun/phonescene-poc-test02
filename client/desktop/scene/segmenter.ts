import { FilesetResolver, ImageSegmenter, type ImageSegmenterResult } from '@mediapipe/tasks-vision';

export type QualityProfile = 'performance' | 'balanced' | 'quality';

const PROFILE: Record<
  QualityProfile,
  { inferSize: number; minIntervalMs: number; smooth: number; featherPx: number; growPx: number }
> = {
  performance: { inferSize: 256, minIntervalMs: 0, smooth: 0.06, featherPx: 2.2, growPx: 1.5 },
  balanced: { inferSize: 320, minIntervalMs: 0, smooth: 0.08, featherPx: 2.8, growPx: 2 },
  quality: { inferSize: 384, minIntervalMs: 0, smooth: 0.1, featherPx: 3.2, growPx: 2.5 },
};

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

/**
 * MediaPipe Selfie Segmenter — low-lag binary matte at infer res.
 * Edge beauty (upsample / grow / feather) happens in the compositor at full res.
 */
export class PersonSegmenter {
  private segmenter: ImageSegmenter | null = null;
  private busy = false;
  private lastInferAt = 0;
  private lastInferMs = 0;
  private inferCount = 0;
  private inferWindowStart = performance.now();
  private inferFps = 0;
  private status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private errorMessage = '';
  private profile: QualityProfile = 'balanced';
  private hasMask = false;
  private invertCategory = true;

  private readonly rawCanvas = document.createElement('canvas');
  private readonly rawCtx = this.rawCanvas.getContext('2d', { willReadFrequently: true })!;
  private readonly workCanvas = document.createElement('canvas');
  private readonly workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true })!;
  private prevAlpha: Uint8Array | null = null;

  getState() {
    return {
      status: this.status,
      errorMessage: this.errorMessage,
      lastInferMs: this.lastInferMs,
      inferFps: this.inferFps,
      busy: this.busy,
      profile: this.profile,
      hasMask: this.hasMask,
      invertCategory: this.invertCategory,
      featherPx: PROFILE[this.profile].featherPx,
      growPx: PROFILE[this.profile].growPx,
    };
  }

  setProfile(profile: QualityProfile) {
    this.profile = profile;
    this.prevAlpha = null;
  }

  setInvertCategory(invert: boolean) {
    this.invertCategory = invert;
    this.prevAlpha = null;
  }

  getEdgeParams() {
    const p = PROFILE[this.profile];
    return { featherPx: p.featherPx, growPx: p.growPx };
  }

  async init(onStatus?: (msg: string) => void): Promise<void> {
    if (this.segmenter) return;
    this.status = 'loading';
    onStatus?.('Segmentasyon modeli yükleniyor…');
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      const options = {
        runningMode: 'VIDEO' as const,
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      };
      try {
        this.segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          ...options,
        });
      } catch {
        onStatus?.('GPU segmentasyon başarısız, CPU deneniyor…');
        this.segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          ...options,
        });
      }
      this.status = 'ready';
      onStatus?.('Segmentasyon hazır.');
    } catch (error) {
      this.status = 'error';
      this.errorMessage = error instanceof Error ? error.message : String(error);
      onStatus?.(`Segmentasyon hatası: ${this.errorMessage}`);
      throw error;
    }
  }

  maybeSegment(video: HTMLVideoElement): void {
    if (!this.segmenter || this.busy || this.status !== 'ready') return;
    if (video.readyState < 2 || video.videoWidth < 2) return;

    const cfg = PROFILE[this.profile];
    const now = performance.now();
    if (now - this.lastInferAt < cfg.minIntervalMs) return;

    this.busy = true;
    this.lastInferAt = now;

    const aspect = video.videoWidth / Math.max(1, video.videoHeight);
    const tw = cfg.inferSize;
    const th = Math.max(2, Math.round(tw / aspect));
    if (this.workCanvas.width !== tw || this.workCanvas.height !== th) {
      this.workCanvas.width = tw;
      this.workCanvas.height = th;
    }
    this.workCtx.drawImage(video, 0, 0, tw, th);

    const t0 = performance.now();
    try {
      const result = this.segmenter.segmentForVideo(this.workCanvas, now);
      this.applyMask(result, tw, th, cfg.smooth);
      this.lastInferMs = performance.now() - t0;
      this.inferCount += 1;
      const elapsed = performance.now() - this.inferWindowStart;
      if (elapsed >= 1000) {
        this.inferFps = Math.round((this.inferCount * 1000) / elapsed);
        this.inferCount = 0;
        this.inferWindowStart = performance.now();
      }
      result.close();
    } catch (error) {
      console.warn('segmentForVideo failed', error);
    } finally {
      this.busy = false;
    }
  }

  private applyMask(result: ImageSegmenterResult, tw: number, th: number, smooth: number) {
    const mask = result.categoryMask;
    if (!mask) return;
    const data = mask.getAsUint8Array();
    const expected = tw * th;
    if (data.length < expected) return;

    if (this.rawCanvas.width !== tw || this.rawCanvas.height !== th) {
      this.rawCanvas.width = tw;
      this.rawCanvas.height = th;
      this.prevAlpha = null;
    }
    if (!this.prevAlpha || this.prevAlpha.length !== expected) {
      this.prevAlpha = new Uint8Array(expected);
    }

    const img = this.rawCtx.createImageData(tw, th);
    const out = img.data;
    const keep = 1 - smooth;

    for (let i = 0; i < expected; i++) {
      const isPerson = this.invertCategory ? data[i] === 0 : data[i] > 0;
      const a = isPerson ? 255 : 0;
      const blended = Math.round(this.prevAlpha[i] * smooth + a * keep);
      const hard = blended >= 128 ? 255 : 0;
      this.prevAlpha[i] = hard;
      const o = i * 4;
      out[o] = 255;
      out[o + 1] = 255;
      out[o + 2] = 255;
      out[o + 3] = hard;
    }

    this.rawCtx.putImageData(img, 0, 0);
    this.hasMask = true;
  }

  getMaskCanvas(): HTMLCanvasElement | null {
    return this.hasMask ? this.rawCanvas : null;
  }
}
