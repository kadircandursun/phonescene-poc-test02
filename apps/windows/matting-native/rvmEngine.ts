/**
 * Robust Video Matting — native Windows (DirectML → CPU).
 * Universal: no RTX/CUDA/Maxine required.
 *
 * First-frame recurrent inputs MUST be float32 zeros shaped [1,1,1,1]
 * (official RVM ONNX convention). Later frames feed r1o..r4o back.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODEL = path.resolve(__dirname, '../../../models/rvm/rvm_mobilenetv3_fp32.onnx');

export type RvmProviders = 'dml' | 'cpu';

export type RvmInferResult = {
  alpha: Float32Array;
  width: number;
  height: number;
  inferMs: number;
  provider: RvmProviders;
};

export class RvmEngine {
  private session: ort.InferenceSession | null = null;
  private provider: RvmProviders = 'cpu';
  private r1: ort.Tensor | null = null;
  private r2: ort.Tensor | null = null;
  private r3: ort.Tensor | null = null;
  private r4: ort.Tensor | null = null;
  private downsampleRatio = 0.25;

  get activeProvider() {
    return this.provider;
  }

  async init(modelPath = DEFAULT_MODEL): Promise<void> {
    if (!fs.existsSync(modelPath)) {
      throw new Error(`RVM model missing: ${modelPath} — run npm run matting:download`);
    }

    const attempts: Array<{ id: RvmProviders; eps: string[] }> = [
      { id: 'dml', eps: ['dml', 'cpu'] },
      { id: 'cpu', eps: ['cpu'] },
    ];

    let lastErr: unknown;
    for (const a of attempts) {
      try {
        this.session = await ort.InferenceSession.create(modelPath, {
          executionProviders: a.eps,
          graphOptimizationLevel: 'all',
        });
        this.provider = a.id;
        this.resetState();
        return;
      } catch (error) {
        lastErr = error;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  resetState() {
    this.r1 = null;
    this.r2 = null;
    this.r3 = null;
    this.r4 = null;
  }

  async inferRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Promise<RvmInferResult> {
    if (!this.session) throw new Error('RvmEngine not initialized');

    const t0 = performance.now();
    const src = this.rgbaToNchwFloat(rgba, width, height);
    const feeds: Record<string, ort.Tensor> = {
      src,
      downsample_ratio: new ort.Tensor('float32', Float32Array.from([this.downsampleRatio]), [1]),
      r1i: this.r1 ?? this.emptyRecurrent(),
      r2i: this.r2 ?? this.emptyRecurrent(),
      r3i: this.r3 ?? this.emptyRecurrent(),
      r4i: this.r4 ?? this.emptyRecurrent(),
    };

    const out = await this.session.run(feeds);
    const pha = out.pha;
    if (!pha) throw new Error(`RVM outputs missing pha: ${this.session.outputNames.join(',')}`);

    this.r1 = out.r1o as ort.Tensor;
    this.r2 = out.r2o as ort.Tensor;
    this.r3 = out.r3o as ort.Tensor;
    this.r4 = out.r4o as ort.Tensor;

    const alpha = this.tensorToAlpha(pha as ort.Tensor, width, height);
    return {
      alpha,
      width,
      height,
      inferMs: performance.now() - t0,
      provider: this.provider,
    };
  }

  private emptyRecurrent() {
    return new ort.Tensor('float32', new Float32Array(1), [1, 1, 1, 1]);
  }

  private rgbaToNchwFloat(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): ort.Tensor {
    const plane = w * h;
    const f32 = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      const o = i * 4;
      f32[i] = rgba[o] / 255;
      f32[plane + i] = rgba[o + 1] / 255;
      f32[2 * plane + i] = rgba[o + 2] / 255;
    }
    return new ort.Tensor('float32', f32, [1, 3, h, w]);
  }

  private tensorToAlpha(pha: ort.Tensor, w: number, h: number): Float32Array {
    const data = pha.data as Float32Array;
    const expected = w * h;
    if (data.length === expected) {
      const out = new Float32Array(expected);
      for (let i = 0; i < expected; i++) out[i] = Math.min(1, Math.max(0, data[i]));
      return out;
    }
    if (data.length >= expected) {
      const out = new Float32Array(expected);
      const off = data.length - expected;
      for (let i = 0; i < expected; i++) out[i] = Math.min(1, Math.max(0, data[off + i]));
      return out;
    }
    return new Float32Array(expected);
  }
}
