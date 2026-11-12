import type { MatteBackend, QualityProfile } from './types';

const CMD_SET_BGR = 1;
const CMD_INFER = 2;

const PROFILE: Record<QualityProfile, { maxSide: number; intervalMs: number }> = {
  performance: { maxSide: 512, intervalMs: 50 },
  balanced: { maxSide: 720, intervalMs: 40 },
  quality: { maxSide: 960, intervalMs: 33 },
};

/**
 * Background Matting V2 client — product path.
 * Uses model fgr (despill RGB) + tightened pha — not raw video×mask.
 * Requires fixed phone after empty-bg capture.
 */
export class NativeBgmMattingBackend implements MatteBackend {
  readonly id = 'bgm' as const;
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
  private hasPerson = false;
  private hasBgr = false;
  private provider = '';
  private bgrW = 0;
  private bgrH = 0;
  private pendingBgrResolve: ((ok: boolean) => void) | null = null;

  private readonly workCanvas = document.createElement('canvas');
  private readonly workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true })!;
  private readonly maskCanvas = document.createElement('canvas');
  private readonly maskCtx = this.maskCanvas.getContext('2d')!;
  private readonly personCanvas = document.createElement('canvas');
  private readonly personCtx = this.personCanvas.getContext('2d')!;

  get backgroundReady() {
    return this.hasBgr;
  }

  async init(onStatus?: (msg: string) => void): Promise<void> {
    this.status = 'loading';
    onStatus?.('Background Matting servisine bağlanılıyor…');

    const health = await fetch('http://127.0.0.1:8791/health').then((r) => r.json());
    if (!health?.ok || health.service !== 'bgm-matting') {
      throw new Error('BGM service not running');
    }
    this.provider = String(health.provider || '');
    this.hasBgr = !!health.hasBgr;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://127.0.0.1:8791/matte');
      ws.binaryType = 'arraybuffer';
      const timer = window.setTimeout(() => reject(new Error('BGM WS timeout')), 5000);
      ws.onopen = () => {
        window.clearTimeout(timer);
        this.ws = ws;
        this.status = 'ready';
        onStatus?.(
          this.hasBgr
            ? `BGM hazır (${this.provider}) — telefonu sabitle, hareket etme`
            : `BGM hazır (${this.provider}) — telefonu sabitle → boş arka planı yakala`,
        );
        resolve();
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('BGM WS error'));
      };
      ws.onclose = () => {
        this.status = 'error';
        this.errorMessage = 'BGM WS closed';
        this.ws = null;
      };
      ws.onmessage = (ev) => this.onMessage(ev.data);
    });
  }

  setProfile(profile: QualityProfile) {
    this.profile = profile;
  }

  /** Capture current video frame as empty background (user must step out). */
  async captureEmptyBackground(video: HTMLVideoElement): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    if (video.readyState < 2 || video.videoWidth < 2) return false;

    const { tw, th } = this.ensureWorkSize(video);
    this.workCtx.drawImage(video, 0, 0, tw, th);
    const img = this.workCtx.getImageData(0, 0, tw, th);
    const payload = this.packFrame(CMD_SET_BGR, tw, th, img.data);

    return await new Promise<boolean>((resolve) => {
      this.pendingBgrResolve = resolve;
      this.ws!.send(payload);
      window.setTimeout(() => {
        if (this.pendingBgrResolve) {
          this.pendingBgrResolve(false);
          this.pendingBgrResolve = null;
        }
      }, 5000);
    });
  }

  clearBackground() {
    this.hasBgr = false;
    this.bgrW = 0;
    this.bgrH = 0;
    this.ws?.send('clear_bgr');
  }

  maybeMatte(video: HTMLVideoElement): void {
    if (!this.hasBgr) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.busy) return;
    if (this.status !== 'ready') return;
    if (video.readyState < 2 || video.videoWidth < 2) return;

    const now = performance.now();
    const cfg = PROFILE[this.profile];
    if (now - this.lastInferAt < cfg.intervalMs) return;

    const tw = this.bgrW;
    const th = this.bgrH;
    if (tw < 32 || th < 32) return;

    if (this.workCanvas.width !== tw || this.workCanvas.height !== th) {
      this.workCanvas.width = tw;
      this.workCanvas.height = th;
    }
    this.workCtx.drawImage(video, 0, 0, tw, th);
    const img = this.workCtx.getImageData(0, 0, tw, th);
    const payload = this.packFrame(CMD_INFER, tw, th, img.data);

    this.busy = true;
    this.lastInferAt = now;
    this.ws.send(payload);
  }

  private ensureWorkSize(video: HTMLVideoElement) {
    const cfg = PROFILE[this.profile];
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, cfg.maxSide / Math.max(vw, vh));
    let tw = Math.max(64, Math.round(vw * scale));
    let th = Math.max(64, Math.round(vh * scale));
    tw -= tw % 2;
    th -= th % 2;
    if (this.workCanvas.width !== tw || this.workCanvas.height !== th) {
      this.workCanvas.width = tw;
      this.workCanvas.height = th;
    }
    return { tw, th };
  }

  private packFrame(cmd: number, w: number, h: number, rgba: Uint8ClampedArray) {
    const payload = new ArrayBuffer(12 + rgba.byteLength);
    const view = new DataView(payload);
    view.setUint32(0, cmd, true);
    view.setUint32(4, w, true);
    view.setUint32(8, h, true);
    new Uint8Array(payload, 12).set(rgba);
    return payload;
  }

  private onMessage(data: unknown) {
    this.busy = false;
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'bgr') {
          this.hasBgr = !!msg.hasBgr;
          this.bgrW = msg.w || 0;
          this.bgrH = msg.h || 0;
          this.pendingBgrResolve?.(this.hasBgr);
          this.pendingBgrResolve = null;
        } else if (msg.type === 'error') {
          console.warn('BGM', msg.message);
          this.pendingBgrResolve?.(false);
          this.pendingBgrResolve = null;
        }
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
    const plane = w * h;
    const needAlpha = 12 + plane;
    const needFgr = needAlpha + plane * 3;
    if (data.byteLength < needAlpha) return;

    const alpha = new Uint8Array(data, 12, plane);
    const hasFgr = data.byteLength >= needFgr;
    const fgr = hasFgr ? new Uint8Array(data, needAlpha, plane * 3) : null;

    if (this.maskCanvas.width !== w || this.maskCanvas.height !== h) {
      this.maskCanvas.width = w;
      this.maskCanvas.height = h;
    }
    if (this.personCanvas.width !== w || this.personCanvas.height !== h) {
      this.personCanvas.width = w;
      this.personCanvas.height = h;
    }

    const maskImg = this.maskCtx.createImageData(w, h);
    const personImg = this.personCtx.createImageData(w, h);
    const md = maskImg.data;
    const pd = personImg.data;

    for (let i = 0; i < plane; i++) {
      const a = alpha[i]!;
      const o = i * 4;
      md[o] = 255;
      md[o + 1] = 255;
      md[o + 2] = 255;
      md[o + 3] = a;

      if (fgr) {
        const fo = i * 3;
        pd[o] = fgr[fo]!;
        pd[o + 1] = fgr[fo + 1]!;
        pd[o + 2] = fgr[fo + 2]!;
      } else {
        pd[o] = 255;
        pd[o + 1] = 255;
        pd[o + 2] = 255;
      }
      pd[o + 3] = a;
    }

    this.maskCtx.putImageData(maskImg, 0, 0);
    this.personCtx.putImageData(personImg, 0, 0);
    this.hasMask = true;
    this.hasPerson = !!fgr;

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

  /** Despilled foreground RGBA from BGM fgr×pha. */
  getPersonCanvas() {
    return this.hasPerson ? this.personCanvas : null;
  }

  getState() {
    return {
      status: this.status,
      errorMessage: this.errorMessage || (this.hasBgr ? '' : 'empty bg required'),
      lastInferMs: this.lastInferMs,
      inferFps: this.inferFps,
      busy: this.busy,
      profile: this.profile,
      hasMask: this.hasMask,
      featherPx: 0,
      growPx: 0,
    };
  }
}
