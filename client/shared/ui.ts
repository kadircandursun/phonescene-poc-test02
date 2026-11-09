import type { StatusTone } from './types';
import { formatAngle } from './sensors';

export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

export function setText(id: string, value: string) {
  $(id).textContent = value;
}

export function setStatus(id: string, message: string, tone: StatusTone = 'idle') {
  const el = $(id);
  el.textContent = message;
  el.dataset.tone = tone;
}

export function renderAngles(
  alphaId: string,
  betaId: string,
  gammaId: string,
  alpha: number | null,
  beta: number | null,
  gamma: number | null,
) {
  setText(alphaId, formatAngle(alpha));
  setText(betaId, formatAngle(beta));
  setText(gammaId, formatAngle(gamma));
}

type VideoFrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** Counts decoded video frames — not display refresh rate (RAF). */
export function measureVideoFps(video: HTMLVideoElement, onFps: (fps: number) => void): () => void {
  const v = video as VideoFrameCallbackVideo;
  let frames = 0;
  let last = performance.now();
  let stopped = false;
  let handle = 0;
  let interval = 0;

  const report = (now: number) => {
    if (now - last < 1000) return;
    onFps(Math.round((frames * 1000) / (now - last)));
    frames = 0;
    last = now;
  };

  if (typeof v.requestVideoFrameCallback === 'function') {
    const onFrame = (now: number) => {
      if (stopped) return;
      frames += 1;
      report(now);
      handle = v.requestVideoFrameCallback!(onFrame);
    };
    handle = v.requestVideoFrameCallback(onFrame);
    return () => {
      stopped = true;
      v.cancelVideoFrameCallback?.(handle);
    };
  }

  // Fallback: poll currentTime changes (~actual playback progress).
  let prevTime = video.currentTime;
  interval = window.setInterval(() => {
    if (stopped) return;
    if (video.readyState < 2) return;
    if (video.currentTime !== prevTime) {
      frames += 1;
      prevTime = video.currentTime;
    }
    report(performance.now());
  }, 33);

  return () => {
    stopped = true;
    window.clearInterval(interval);
  };
}

export function appendDebug(panelId: string, line: string) {
  const panel = $(panelId) as HTMLPreElement;
  const stamp = new Date().toLocaleTimeString();
  panel.textContent = `[${stamp}] ${line}\n${panel.textContent || ''}`.slice(0, 4000);
}
