import { PersonSegmenter } from '../segmenter';
import type { MatteBackend, QualityProfile } from './types';

const PROFILE: Record<QualityProfile, { maxSide: number; intervalMs: number }> = {
  performance: { maxSide: 256, intervalMs: 66 },
  balanced: { maxSide: 320, intervalMs: 50 },
  quality: { maxSide: 384, intervalMs: 40 },
};

/**
 * Native RVM (soft hair) ∩ MediaPipe person gate (drop chair/desk).
 * RVM alone often keeps the gaming chair as "subject"; person gate cuts it.
 */
export class NativeRvmMattingBackend implements MatteBackend {
  readonly id = 'rvm' as const;
  readonly softAlpha = true;

  private ws: WebSocket | null = null;
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
  private provider = '';
  private readonly personGate = new PersonSegmenter();

  private readonly workCanvas = document.createElement('canvas');
  private readonly workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true })!;
  private readonly maskCanvas = document.createElement('canvas');
  private readonly maskCtx = this.maskCanvas.getContext('2d')!;
  private readonly gateCanvas = document.createElement('canvas');
  private readonly gateCtx = this.gateCanvas.getContext('2d')!;
  private readonly gatedCanvas = document.createElement('canvas');
  private readonly gatedCtx = this.gatedCanvas.getContext('2d')!;

  async init(onStatus?: (msg: string) => void): Promise<void> {
    this.status = 'loading';
    onStatus?.('Native RVM + person gate…');

    const health = await fetch('http://127.0.0.1:8791/health').then((r) => r.json());
    if (!health?.ok) throw new Error('RVM health failed');
    if (health.service && health.service !== 'rvm-matting') {
      throw new Error(`Expected rvm-matting, got ${health.service}`);
    }
    this.provider = String(health.provider || '');

    try {
      await this.personGate.init(onStatus);
      this.personGate.setProfile(this.profile);
    } catch (error) {
      onStatus?.(`Person gate yok, yalnız RVM: ${String(error).slice(0, 80)}`);
    }

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://127.0.0.1:8791/matte');
      ws.binaryType = 'arraybuffer';
      const timer = window.setTimeout(() => reject(new Error('RVM WS timeout')), 5000);
      ws.onopen = () => {
        window.clearTimeout(timer);
        this.ws = ws;
        this.status = 'ready';
        onStatus?.(`Native RVM hazır (${this.provider}) + person gate.`);
        resolve();
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('RVM WS error'));
      };
      ws.onclose = () => {
        this.status = 'error';
        this.errorMessage = 'RVM WS closed';
        this.ws = null;
      };
      ws.onmessage = (ev) => this.onMessage(ev.data);
    });
  }

  setProfile(profile: QualityProfile) {
    this.profile = profile;
    this.personGate.setProfile(profile);
  }

  maybeMatte(video: HTMLVideoElement): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.busy) return;
    if (this.status !== 'ready') return;
    if (video.readyState < 2 || video.videoWidth < 2) return;

    const now = performance.now();
    const cfg = PROFILE[this.profile];
    if (now - this.lastInferAt < cfg.intervalMs) return;

    // Person-only gate (drops chair when selfie segmenter is confident).
    this.personGate.maybeSegment(video);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = cfg.maxSide / Math.max(vw, vh);
    let tw = Math.max(32, Math.round((vw * scale) / 32) * 32);
    let th = Math.max(32, Math.round((vh * scale) / 32) * 32);

    if (this.workCanvas.width !== tw || this.workCanvas.height !== th) {
      this.workCanvas.width = tw;
      this.workCanvas.height = th;
    }
    this.workCtx.drawImage(video, 0, 0, tw, th);
    const img = this.workCtx.getImageData(0, 0, tw, th);

    const payload = new ArrayBuffer(8 + img.data.byteLength);
    const view = new DataView(payload);
    view.setUint32(0, tw, true);
    view.setUint32(4, th, true);
    new Uint8Array(payload, 8).set(img.data);

    this.busy = true;
    this.lastInferAt = now;
    this.ws.send(payload);
  }

  private onMessage(data: unknown) {
    this.busy = false;
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'error') console.warn('RVM', msg.message);
      } catch {
        /* ignore */
      }
      return;
    }
    if (!(data instanceof ArrayBuffer) || data.byteLength < 12) return;
    const view = new DataView(data);
    const w = view.getUint32(0, true);
    const h = view.getUint32(4, true);
    this.lastInferMs = view.getUint32(8, true);
    const alpha = new Uint8Array(data, 12);

    if (this.maskCanvas.width !== w || this.maskCanvas.height !== h) {
      this.maskCanvas.width = w;
      this.maskCanvas.height = h;
    }
    const img = this.maskCtx.createImageData(w, h);
    const out = img.data;
    const n = Math.min(alpha.length, w * h);
    for (let i = 0; i < n; i++) {
      // Crush weak RVM leftovers (chair fringe often mid-alpha).
      const raw = alpha[i] / 255;
      const crushed = raw < 0.45 ? raw * raw * 0.5 : Math.min(1, (raw - 0.35) / 0.55);
      const a = Math.round(Math.max(0, Math.min(1, crushed)) * 255);
      const o = i * 4;
      out[o] = 255;
      out[o + 1] = 255;
      out[o + 2] = 255;
      out[o + 3] = a;
    }
    this.maskCtx.putImageData(img, 0, 0);

    this.applyPersonGate(w, h);
    this.hasMask = true;

    this.inferCount += 1;
    const elapsed = performance.now() - this.inferWindowStart;
    if (elapsed >= 1000) {
      this.inferFps = Math.round((this.inferCount * 1000) / elapsed);
      this.inferCount = 0;
      this.inferWindowStart = performance.now();
    }
  }

  /** final = RVM soft ∩ MediaPipe person (chair/desk cut). */
  private applyPersonGate(w: number, h: number) {
    if (this.gatedCanvas.width !== w || this.gatedCanvas.height !== h) {
      this.gatedCanvas.width = w;
      this.gatedCanvas.height = h;
    }
    const out = this.gatedCtx;
    out.clearRect(0, 0, w, h);
    out.drawImage(this.maskCanvas, 0, 0);

    const gate = this.personGate.getMaskCanvas();
    if (!gate) return;

    if (this.gateCanvas.width !== w || this.gateCanvas.height !== h) {
      this.gateCanvas.width = w;
      this.gateCanvas.height = h;
    }
    const g = this.gateCtx;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = true;
    // Soft person silhouette; tiny grow so hair isn't shaved.
    const grow = Math.max(1, Math.round(w / 180));
    for (const [dx, dy] of [
      [0, 0],
      [grow, 0],
      [-grow, 0],
      [0, grow],
      [0, -grow],
    ] as const) {
      g.drawImage(gate, dx, dy, w, h);
    }

    out.globalCompositeOperation = 'destination-in';
    out.drawImage(this.gateCanvas, 0, 0);
    out.globalCompositeOperation = 'source-over';
  }

  getMaskCanvas() {
    return this.hasMask ? this.gatedCanvas : null;
  }

  getState() {
    return {
      status: this.status,
      errorMessage: this.errorMessage,
      lastInferMs: this.lastInferMs,
      inferFps: this.inferFps,
      busy: this.busy,
      profile: this.profile,
      hasMask: this.hasMask,
      featherPx: 0.6,
      growPx: 0,
    };
  }
}
