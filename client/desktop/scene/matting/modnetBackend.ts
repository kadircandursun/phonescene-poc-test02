import type * as OrtNS from 'onnxruntime-web';
import { blurMatteInPlace, SOFT_ALPHA_BY_PROFILE, writeSoftMatte } from './softAlpha';
import type { MatteBackend, QualityProfile } from './types';

type OrtModule = typeof OrtNS;
type OrtSession = OrtNS.InferenceSession;
type OrtTensor = OrtNS.Tensor;

/**
 * MODNet ONNX — realtime-first on Windows.
 * Preprocess: (x-127.5)/127.5 → [-1,1].
 * Size capped by maxSide (not short-side=512) so portrait stays real-time.
 */
const DEFAULT_MODEL =
  'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx';
const ORT_WASM_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';

const PROFILE: Record<QualityProfile, { maxSide: number; intervalMs: number }> = {
  performance: { maxSide: 192, intervalMs: 120 },
  balanced: { maxSide: 256, intervalMs: 80 },
  quality: { maxSide: 320, intervalMs: 55 },
};

export class ModNetMattingBackend implements MatteBackend {
  readonly id = 'modnet' as const;
  readonly softAlpha = true;

  private ort: OrtModule | null = null;
  private session: OrtSession | null = null;
  private busy = false;
  private lastInferAt = 0;
  private lastInferMs = 0;
  private inferCount = 0;
  private inferWindowStart = performance.now();
  private inferFps = 0;
  private status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private errorMessage = '';
  private profile: QualityProfile = 'performance';
  private hasMask = false;
  private prevAlpha: Float32Array | null = null;
  private inputName = 'input';
  private outputName = 'output';

  private readonly workCanvas = document.createElement('canvas');
  private readonly workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true })!;
  private readonly rawMatte = document.createElement('canvas');
  private readonly rawCtx = this.rawMatte.getContext('2d')!;
  private readonly softMatte = document.createElement('canvas');
  private readonly softCtx = this.softMatte.getContext('2d')!;

  async init(onStatus?: (msg: string) => void): Promise<void> {
    if (this.session) return;
    this.status = 'loading';
    onStatus?.('MODNet/ONNX matting yükleniyor…');

    const modelUrl =
      (typeof import.meta !== 'undefined' &&
        (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_MODNET_URL) ||
      DEFAULT_MODEL;

    try {
      const ortGpu = (await import('onnxruntime-web/webgpu')) as OrtModule;
      ortGpu.env.wasm.wasmPaths = ORT_WASM_CDN;
      this.ort = ortGpu;
      this.session = await ortGpu.InferenceSession.create(modelUrl, {
        executionProviders: ['webgpu'],
        graphOptimizationLevel: 'all',
      });
      onStatus?.('MODNet WebGPU aktif.');
    } catch {
      onStatus?.('WebGPU yok/başarısız — ONNX WASM…');
      const ortWasm = await import('onnxruntime-web');
      ortWasm.env.wasm.wasmPaths = ORT_WASM_CDN;
      // Single thread avoids WASM worker contention with compositor RAF.
      ortWasm.env.wasm.numThreads = 1;
      this.ort = ortWasm;
      this.session = await ortWasm.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
    }

    this.inputName = this.session.inputNames[0] || 'input';
    this.outputName = this.session.outputNames[0] || 'output';
    this.status = 'ready';
    onStatus?.(`MODNet hazır (${this.inputName}→${this.outputName}).`);
  }

  setProfile(profile: QualityProfile) {
    this.profile = profile;
    this.prevAlpha = null;
  }

  maybeMatte(video: HTMLVideoElement): void {
    if (!this.session || this.busy || this.status !== 'ready') return;
    if (video.readyState < 2 || video.videoWidth < 2) return;

    const now = performance.now();
    const { intervalMs } = PROFILE[this.profile];
    if (now - this.lastInferAt < intervalMs) return;

    this.busy = true;
    this.lastInferAt = now;
    void this.run(video).finally(() => {
      this.busy = false;
    });
  }

  private async run(video: HTMLVideoElement) {
    if (!this.session) return;
    const t0 = performance.now();
    try {
      const { maxSide } = PROFILE[this.profile];
      const { tensor, tw, th } = this.preprocess(video, maxSide);
      const feeds: Record<string, OrtTensor> = { [this.inputName]: tensor };
      const out = await this.session.run(feeds);
      const alphaTensor = out[this.outputName];
      if (!alphaTensor) return;

      const data = alphaTensor.data as Float32Array;
      const alpha = this.normalizeAlpha(this.extractAlpha(data, tw, th));
      const params = SOFT_ALPHA_BY_PROFILE[this.profile];
      this.prevAlpha = writeSoftMatte(alpha, tw, th, params, this.prevAlpha, this.rawMatte, this.rawCtx);
      if (params.blurPx > 0.05) {
        blurMatteInPlace(this.rawMatte, this.softMatte, this.softCtx, params.blurPx);
      } else {
        if (this.softMatte.width !== tw || this.softMatte.height !== th) {
          this.softMatte.width = tw;
          this.softMatte.height = th;
        }
        this.softCtx.clearRect(0, 0, tw, th);
        this.softCtx.drawImage(this.rawMatte, 0, 0);
      }
      this.hasMask = true;

      this.lastInferMs = performance.now() - t0;
      this.inferCount += 1;
      const elapsed = performance.now() - this.inferWindowStart;
      if (elapsed >= 1000) {
        this.inferFps = Math.round((this.inferCount * 1000) / elapsed);
        this.inferCount = 0;
        this.inferWindowStart = performance.now();
      }
    } catch (error) {
      console.warn('MODNet infer failed', error);
    }
  }

  /** Cap longest side → realtime; dims % 32. */
  private preprocess(video: HTMLVideoElement, maxSide: number): { tensor: OrtTensor; tw: number; th: number } {
    if (!this.ort) throw new Error('ORT not initialized');
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = maxSide / Math.max(vw, vh);
    let tw = Math.max(32, Math.round((vw * scale) / 32) * 32);
    let th = Math.max(32, Math.round((vh * scale) / 32) * 32);

    if (this.workCanvas.width !== tw || this.workCanvas.height !== th) {
      this.workCanvas.width = tw;
      this.workCanvas.height = th;
    }
    this.workCtx.drawImage(video, 0, 0, tw, th);
    const img = this.workCtx.getImageData(0, 0, tw, th);
    const px = img.data;
    const f32 = new Float32Array(3 * tw * th);
    const plane = tw * th;
    for (let i = 0; i < plane; i++) {
      const o = i * 4;
      f32[i] = (px[o] - 127.5) / 127.5;
      f32[plane + i] = (px[o + 1] - 127.5) / 127.5;
      f32[2 * plane + i] = (px[o + 2] - 127.5) / 127.5;
    }
    return { tensor: new this.ort.Tensor('float32', f32, [1, 3, th, tw]), tw, th };
  }

  private extractAlpha(data: Float32Array, tw: number, th: number): Float32Array {
    const expected = tw * th;
    if (data.length === expected) return data;
    if (data.length >= expected) {
      const out = new Float32Array(expected);
      const offset = data.length - expected;
      for (let i = 0; i < expected; i++) out[i] = data[offset + i];
      return out;
    }
    return new Float32Array(expected);
  }

  private normalizeAlpha(raw: Float32Array): Float32Array {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const mean = sum / Math.max(1, raw.length);
    const out = new Float32Array(raw.length);

    if (min < -0.05 || max > 1.05) {
      for (let i = 0; i < raw.length; i++) {
        const z = raw[i];
        out[i] = 1 / (1 + Math.exp(-Math.min(20, Math.max(-20, z))));
      }
      return out;
    }

    if (max - min < 0.15 && mean > 0.35 && mean < 0.65) {
      for (let i = 0; i < raw.length; i++) {
        out[i] = Math.min(1, Math.max(0, (raw[i] - min) / Math.max(1e-6, max - min)));
      }
      return out;
    }

    for (let i = 0; i < raw.length; i++) {
      out[i] = Math.min(1, Math.max(0, raw[i]));
    }
    return out;
  }

  getMaskCanvas(): HTMLCanvasElement | null {
    return this.hasMask ? this.softMatte : null;
  }

  getState() {
    const p = SOFT_ALPHA_BY_PROFILE[this.profile];
    return {
      status: this.status,
      errorMessage: this.errorMessage,
      lastInferMs: this.lastInferMs,
      inferFps: this.inferFps,
      busy: this.busy,
      profile: this.profile,
      hasMask: this.hasMask,
      featherPx: p.blurPx,
      growPx: 0,
    };
  }
}
