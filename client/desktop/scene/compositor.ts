import type { QualityProfile } from './segmenter';
import { PersonSegmenter } from './segmenter';
import { VirtualRoom, type SceneId } from './room';

export type PreviewMode = 'final' | 'raw' | 'scene';
export type OutputProfile = 'portrait' | 'landscape';

export type CompositorOptions = {
  video: HTMLVideoElement;
  roomCanvas: HTMLCanvasElement;
  outputCanvas: HTMLCanvasElement;
  onDiag?: (diag: CompositorDiagnostics) => void;
};

export type CompositorDiagnostics = {
  videoFps: number;
  compositeFps: number;
  poseHz: number;
  segInferMs: number;
  segFps: number;
  segStatus: string;
  width: number;
  height: number;
  workWidth: number;
  workHeight: number;
  droppedLate: number;
  outputProfile: OutputProfile;
  hasSignal: boolean;
};

/**
 * Work buffer = source aspect composite.
 * Output canvas = OBS-facing present surface (portrait or 1280×720 landscape).
 * Same WebRTC/segmentation loop — only presentation changes.
 */
export class SceneCompositor {
  readonly room: VirtualRoom;
  readonly segmenter = new PersonSegmenter();

  private readonly video: HTMLVideoElement;
  private readonly output: HTMLCanvasElement;
  private readonly presentCtx: CanvasRenderingContext2D;
  private readonly composeCanvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly personCanvas = document.createElement('canvas');
  private readonly personCtx = this.personCanvas.getContext('2d')!;
  private readonly matteCanvas = document.createElement('canvas');
  private readonly matteCtx = this.matteCanvas.getContext('2d')!;
  private readonly featherCanvas = document.createElement('canvas');
  private readonly featherCtx = this.featherCanvas.getContext('2d')!;

  enabled3d = true;
  enabledSeg = true;
  previewMode: PreviewMode = 'final';
  trackingEnabled = true;
  outputProfile: OutputProfile = 'portrait';
  /** cover = crop center into 16:9; contain = letterbox (no crop). */
  landscapeFit: 'cover' | 'contain' = 'cover';

  private running = false;
  private raf = 0;
  private videoFrames = 0;
  private videoWindowStart = performance.now();
  private videoFps = 0;
  private compFrames = 0;
  private compWindowStart = performance.now();
  private compositeFps = 0;
  private poseUpdates = 0;
  private poseWindowStart = performance.now();
  private poseHz = 0;
  private droppedLate = 0;
  private lastVideoTime = -1;
  private rvfcHandle = 0;
  private workW = 720;
  private workH = 1280;
  private outW = 720;
  private outH = 1280;
  private lastCompAt = 0;
  private readonly targetFrameMs = 1000 / 30;
  private hasGoodFrame = false;
  private holdCanvas = document.createElement('canvas');
  private holdCtx = this.holdCanvas.getContext('2d')!;

  constructor(opts: CompositorOptions) {
    this.video = opts.video;
    this.output = opts.outputCanvas;
    this.presentCtx = this.output.getContext('2d')!;
    this.ctx = this.composeCanvas.getContext('2d')!;
    this.room = new VirtualRoom(opts.roomCanvas);
    this.onDiag = opts.onDiag;
    this.bindManualDrag(opts.outputCanvas);
    this.forceWorkSize(720, 1280);
    this.applyPresentSize();
  }

  private onDiag?: (diag: CompositorDiagnostics) => void;

  async init(onStatus?: (msg: string) => void) {
    try {
      await this.segmenter.init(onStatus);
    } catch {
      /* Stage A still works without seg */
    }
  }

  setScene(id: SceneId) {
    this.room.setScene(id);
  }

  setQuality(profile: QualityProfile) {
    this.segmenter.setProfile(profile);
  }

  setTracking(enabled: boolean) {
    this.trackingEnabled = enabled;
    this.room.orientation.trackingEnabled = enabled;
    this.room.preferSixDof = enabled;
  }

  setOutputProfile(profile: OutputProfile) {
    this.outputProfile = profile;
    this.applyPresentSize();
  }

  recenter() {
    this.room.recenter();
  }

  private bumpPoseHz() {
    this.poseUpdates += 1;
    const elapsed = performance.now() - this.poseWindowStart;
    if (elapsed >= 1000) {
      this.poseHz = Math.round((this.poseUpdates * 1000) / elapsed);
      this.poseUpdates = 0;
      this.poseWindowStart = performance.now();
    }
  }

  pushSensors(alpha: number | null, beta: number | null, gamma: number | null) {
    this.room.orientation.updateFromSensors(alpha, beta, gamma);
    this.bumpPoseHz();
  }

  pushPose(payload: {
    mode: '6dof' | '3dof';
    px?: number | null;
    py?: number | null;
    pz?: number | null;
    qx: number;
    qy: number;
    qz: number;
    qw: number;
    trackingState?: string;
    alpha?: number | null;
    beta?: number | null;
    gamma?: number | null;
    fovY?: number | null;
  }) {
    if (payload.mode === '6dof' && payload.px != null && payload.py != null && payload.pz != null) {
      this.room.pushSixDof({
        px: payload.px,
        py: payload.py,
        pz: payload.pz,
        qx: payload.qx,
        qy: payload.qy,
        qz: payload.qz,
        qw: payload.qw,
        trackingState: payload.trackingState,
      });
    } else if (payload.alpha != null || payload.beta != null || payload.gamma != null) {
      this.room.orientation.updateFromSensors(payload.alpha ?? null, payload.beta ?? null, payload.gamma ?? null);
    }
    if (payload.fovY != null) this.room.setFovY(payload.fovY);
    this.bumpPoseHz();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
    this.attachVideoCallback();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    const v = this.video as HTMLVideoElement & {
      cancelVideoFrameCallback?: (h: number) => void;
    };
    v.cancelVideoFrameCallback?.(this.rvfcHandle);
  }

  private attachVideoCallback() {
    const v = this.video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number) => void) => number;
    };
    if (typeof v.requestVideoFrameCallback !== 'function') return;
    const onFrame = () => {
      if (!this.running) return;
      this.videoFrames += 1;
      const elapsed = performance.now() - this.videoWindowStart;
      if (elapsed >= 1000) {
        this.videoFps = Math.round((this.videoFrames * 1000) / elapsed);
        this.videoFrames = 0;
        this.videoWindowStart = performance.now();
      }
      if (this.video.currentTime === this.lastVideoTime) this.droppedLate += 1;
      this.lastVideoTime = this.video.currentTime;
      if (this.enabledSeg) this.segmenter.maybeSegment(this.video);
      this.rvfcHandle = v.requestVideoFrameCallback!(onFrame);
    };
    this.rvfcHandle = v.requestVideoFrameCallback(onFrame);
  }

  private loop = () => {
    if (!this.running) return;
    const now = performance.now();
    if (now - this.lastCompAt >= this.targetFrameMs - 1) {
      this.lastCompAt = now;
      if (this.enabledSeg && this.video.readyState >= 2) {
        this.segmenter.maybeSegment(this.video);
      }
      this.renderFrame();
      this.compFrames += 1;
      const elapsed = now - this.compWindowStart;
      if (elapsed >= 1000) {
        this.compositeFps = Math.round((this.compFrames * 1000) / elapsed);
        this.compFrames = 0;
        this.compWindowStart = now;
        this.emitDiag();
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private emitDiag() {
    const seg = this.segmenter.getState();
    this.onDiag?.({
      videoFps: this.videoFps,
      compositeFps: this.compositeFps,
      poseHz: this.poseHz,
      segInferMs: Math.round(seg.lastInferMs),
      segFps: seg.inferFps,
      segStatus: seg.status,
      width: this.outW,
      height: this.outH,
      workWidth: this.workW,
      workHeight: this.workH,
      droppedLate: this.droppedLate,
      outputProfile: this.outputProfile,
      hasSignal: this.video.readyState >= 2 && !!this.video.srcObject,
    });
  }

  private forceWorkSize(vw: number, vh: number) {
    this.workW = vw;
    this.workH = vh;
    this.composeCanvas.width = vw;
    this.composeCanvas.height = vh;
    this.personCanvas.width = vw;
    this.personCanvas.height = vh;
    this.matteCanvas.width = vw;
    this.matteCanvas.height = vh;
    this.featherCanvas.width = vw;
    this.featherCanvas.height = vh;
    this.room.setSize(vw, vh);
  }

  private applyPresentSize() {
    if (this.outputProfile === 'landscape') {
      this.outW = 1280;
      this.outH = 720;
    } else {
      // Always lock OBS/broadcast canvas to 9:16 (720×1280).
      this.outW = 720;
      this.outH = 1280;
    }
    this.output.width = this.outW;
    this.output.height = this.outH;
  }

  private syncSizes() {
    const vw = this.video.videoWidth || 720;
    const vh = this.video.videoHeight || 1280;
    if (vw !== this.workW || vh !== this.workH) {
      this.forceWorkSize(vw, vh);
      if (this.outputProfile === 'portrait') this.applyPresentSize();
    }
  }

  private renderFrame() {
    this.syncSizes();
    const w = this.workW;
    const h = this.workH;
    const hasVideo = this.video.readyState >= 2 && this.video.videoWidth > 0;

    if (!hasVideo && this.hasGoodFrame) {
      this.presentHoldOrCompose();
      return;
    }

    if (this.previewMode === 'raw') {
      this.ctx.fillStyle = '#090d0b';
      this.ctx.fillRect(0, 0, w, h);
      if (hasVideo) this.ctx.drawImage(this.video, 0, 0, w, h);
      this.finishPresent(hasVideo);
      return;
    }

    if (this.enabled3d) this.room.render();

    this.ctx.fillStyle = '#0b1012';
    this.ctx.fillRect(0, 0, w, h);

    if (this.enabled3d) {
      this.ctx.drawImage(this.room.renderer.domElement, 0, 0, w, h);
    }

    if (this.previewMode === 'scene') {
      this.finishPresent(true);
      return;
    }

    if (hasVideo) {
      if (this.enabledSeg && this.segmenter.getMaskCanvas()) {
        this.drawPersonMasked(w, h);
      } else {
        // Seg off or mask warming up — still show person (controlled fallback).
        this.ctx.drawImage(this.video, 0, 0, w, h);
      }
    } else {
      this.ctx.fillStyle = '#111814';
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.fillStyle = '#9aab9f';
      this.ctx.font = '28px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Waiting for phone…', w / 2, h / 2);
    }

    this.finishPresent(hasVideo || this.enabled3d);
  }

  private finishPresent(good: boolean) {
    if (good) {
      this.hasGoodFrame = true;
      if (this.holdCanvas.width !== this.workW || this.holdCanvas.height !== this.workH) {
        this.holdCanvas.width = this.workW;
        this.holdCanvas.height = this.workH;
      }
      this.holdCtx.drawImage(this.composeCanvas, 0, 0);
    }
    this.presentToOutput(this.composeCanvas);
  }

  private presentHoldOrCompose() {
    const src = this.hasGoodFrame ? this.holdCanvas : this.composeCanvas;
    this.presentToOutput(src);
  }

  private presentToOutput(src: HTMLCanvasElement) {
    const dw = this.outW;
    const dh = this.outH;
    const sw = src.width;
    const sh = src.height;
    this.presentCtx.fillStyle = '#000';
    this.presentCtx.fillRect(0, 0, dw, dh);
    this.presentCtx.imageSmoothingEnabled = true;
    this.presentCtx.imageSmoothingQuality = 'high';

    if (sw === dw && sh === dh) {
      this.presentCtx.drawImage(src, 0, 0);
      return;
    }

    const scale =
      this.landscapeFit === 'contain'
        ? Math.min(dw / sw, dh / sh)
        : Math.max(dw / sw, dh / sh);
    const rw = sw * scale;
    const rh = sh * scale;
    const ox = (dw - rw) / 2;
    const oy = (dh - rh) / 2;
    this.presentCtx.drawImage(src, ox, oy, rw, rh);
  }

  private buildFeatheredMatte(mask: HTMLCanvasElement, w: number, h: number) {
    const { featherPx, growPx } = this.segmenter.getEdgeParams();
    const scale = w / 720;
    const feather = Math.max(1.2, featherPx * scale);
    const grow = Math.max(1, growPx * scale);

    const m = this.matteCtx;
    m.clearRect(0, 0, w, h);
    m.imageSmoothingEnabled = true;
    m.imageSmoothingQuality = 'high';
    const offsets: Array<[number, number]> = [
      [0, 0],
      [grow, 0],
      [-grow, 0],
      [0, grow],
      [0, -grow],
      [grow * 0.7, grow * 0.7],
      [-grow * 0.7, grow * 0.7],
      [grow * 0.7, -grow * 0.7],
      [-grow * 0.7, -grow * 0.7],
    ];
    for (const [dx, dy] of offsets) m.drawImage(mask, dx, dy, w, h);

    const f = this.featherCtx;
    f.clearRect(0, 0, w, h);
    f.imageSmoothingEnabled = true;
    f.imageSmoothingQuality = 'high';
    f.filter = `blur(${feather.toFixed(2)}px)`;
    f.drawImage(this.matteCanvas, 0, 0);
    f.filter = 'none';
  }

  private drawPersonMasked(w: number, h: number) {
    const mask = this.segmenter.getMaskCanvas();
    if (!mask) return;
    this.buildFeatheredMatte(mask, w, h);
    this.personCtx.clearRect(0, 0, w, h);
    this.personCtx.imageSmoothingEnabled = true;
    this.personCtx.imageSmoothingQuality = 'high';
    this.personCtx.drawImage(this.video, 0, 0, w, h);
    this.personCtx.globalCompositeOperation = 'destination-in';
    this.personCtx.drawImage(this.featherCanvas, 0, 0, w, h);
    this.personCtx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.personCanvas, 0, 0, w, h);
  }

  private bindManualDrag(el: HTMLElement) {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    el.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging || this.trackingEnabled) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.room.orientation.addManualDelta(-dx * 0.005, -dy * 0.005);
    });
    el.addEventListener('pointerup', () => {
      dragging = false;
    });
  }

  dispose() {
    this.stop();
    this.room.dispose();
  }
}
