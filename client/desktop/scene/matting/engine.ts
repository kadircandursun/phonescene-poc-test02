import { MediaPipeMattingBackend } from './mediapipeBackend';
import { ModNetMattingBackend } from './modnetBackend';
import { NativeBgmMattingBackend } from './nativeBgmBackend';
import { NativeRvmMattingBackend } from './nativeRvmBackend';
import { PhoneAlphaMattingBackend } from './phoneAlphaBackend';
import { RtxMattingBackend } from './rtxBackend';
import type { MatteBackend, MatteState, MattingBackendId, QualityProfile } from './types';

export type { QualityProfile, MattingBackendId, MatteState } from './types';

/**
 * Product default (moving phone/user): phone Vision alpha → RVM → MediaPipe.
 * Empty-bg BGM is opt-in only (fixed camera); not preferred.
 */
export class MattingEngine {
  private backend: MatteBackend | null = null;
  private phoneBackend: PhoneAlphaMattingBackend | null = null;
  private preferred: MattingBackendId = 'phone';

  maybeSegment(video: HTMLVideoElement) {
    // Prefer live phone alpha when track is producing masks.
    if (this.phoneBackend?.hasAlphaTrack()) {
      this.phoneBackend.maybeMatte(video);
      if (this.phoneBackend.getMaskCanvas()) return;
    }
    this.backend?.maybeMatte(video);
  }

  getMaskCanvas() {
    return this.phoneBackend?.getMaskCanvas() ?? this.backend?.getMaskCanvas() ?? null;
  }

  getPersonCanvas() {
    return this.backend?.getPersonCanvas?.() ?? null;
  }

  getEdgeParams() {
    const active = this.phoneBackend?.getMaskCanvas() ? this.phoneBackend : this.backend;
    const s = active?.getState();
    return {
      featherPx: s?.featherPx ?? 1.2,
      growPx: s?.growPx ?? 0,
      softAlpha: active?.softAlpha ?? false,
    };
  }

  get softAlpha() {
    const active = this.phoneBackend?.getMaskCanvas() ? this.phoneBackend : this.backend;
    return active?.softAlpha ?? false;
  }

  getBackend() {
    return this.phoneBackend?.getMaskCanvas() ? this.phoneBackend : this.backend;
  }

  attachPhoneAlphaTrack(track: MediaStreamTrack) {
    if (!this.phoneBackend) this.phoneBackend = new PhoneAlphaMattingBackend();
    this.phoneBackend.attachAlphaTrack(track);
  }

  /** BGM-only (fixed camera). Not used for moving PhoneScene. */
  async captureEmptyBackground(video: HTMLVideoElement): Promise<boolean> {
    const b = this.backend;
    if (b && 'captureEmptyBackground' in b && typeof (b as NativeBgmMattingBackend).captureEmptyBackground === 'function') {
      return (b as NativeBgmMattingBackend).captureEmptyBackground(video);
    }
    return false;
  }

  backgroundReady() {
    return true;
  }

  getState(): MatteState {
    const active = this.phoneBackend?.getMaskCanvas() ? this.phoneBackend : this.backend;
    const s = active?.getState();
    return {
      status: s?.status ?? 'idle',
      errorMessage: s?.errorMessage ?? '',
      lastInferMs: s?.lastInferMs ?? 0,
      inferFps: s?.inferFps ?? 0,
      busy: s?.busy ?? false,
      profile: s?.profile ?? 'balanced',
      hasMask: s?.hasMask ?? false,
      backend: active?.id ?? 'mediapipe',
      softAlpha: active?.softAlpha ?? false,
      featherPx: s?.featherPx ?? 1.2,
      growPx: s?.growPx ?? 0,
    };
  }

  setProfile(profile: QualityProfile) {
    this.backend?.setProfile(profile);
    this.phoneBackend?.setProfile(profile);
  }

  setPreferredBackend(id: MattingBackendId) {
    this.preferred = id;
  }

  async init(onStatus?: (msg: string) => void): Promise<void> {
    this.phoneBackend = new PhoneAlphaMattingBackend();
    await this.phoneBackend.init(onStatus);

    const order: MattingBackendId[] =
      this.preferred === 'phone'
        ? ['rvm', 'mediapipe']
        : this.preferred === 'rvm'
          ? ['rvm', 'mediapipe']
          : this.preferred === 'bgm'
            ? ['bgm', 'mediapipe']
            : this.preferred === 'modnet'
              ? ['modnet', 'mediapipe']
              : this.preferred === 'rtx'
                ? ['rtx', 'mediapipe']
                : ['mediapipe'];

    let lastError: unknown;
    for (const id of order) {
      try {
        const b = this.create(id);
        await b.init(onStatus);
        this.backend = b;
        onStatus?.(`Fallback matting: ${id} (phone Vision alpha overrides when present)`);
        return;
      } catch (error) {
        lastError = error;
        onStatus?.(`${id} yok, sıradaki…`);
      }
    }
    // Phone-only still OK if Vision track arrives.
    this.backend = this.phoneBackend;
    onStatus?.('Yalnız phone alpha / MediaPipe yok — Vision track bekleniyor');
    if (!this.backend) {
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
  }

  private create(id: MattingBackendId): MatteBackend {
    switch (id) {
      case 'phone':
        return new PhoneAlphaMattingBackend();
      case 'bgm':
        return new NativeBgmMattingBackend();
      case 'rvm':
        return new NativeRvmMattingBackend();
      case 'rtx':
        return new RtxMattingBackend();
      case 'mediapipe':
        return new MediaPipeMattingBackend();
      case 'modnet':
        return new ModNetMattingBackend();
      default:
        return new NativeRvmMattingBackend();
    }
  }
}
