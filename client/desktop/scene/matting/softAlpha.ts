/**
 * Soft-alpha edge refinement for continuous mattes (MODNet).
 * Avoids binary grow/scissors that leave white fringes.
 */

export type SoftAlphaParams = {
  /** Temporal blend toward new alpha (0..1). Higher = smoother, more lag. */
  temporal: number;
  /** Small Gaussian blur on alpha only (px at work res). */
  blurPx: number;
  /** Contrast around midtones: >1 tightens; <1 softens. */
  contrast: number;
  /** Crush near-zero dust. */
  blackPoint: number;
  /** Lift near-one fill. */
  whitePoint: number;
};

export const SOFT_ALPHA_BY_PROFILE: Record<'performance' | 'balanced' | 'quality', SoftAlphaParams> = {
  performance: { temporal: 0.45, blurPx: 0, contrast: 1.05, blackPoint: 0.05, whitePoint: 0.95 },
  balanced: { temporal: 0.35, blurPx: 0.5, contrast: 1.08, blackPoint: 0.04, whitePoint: 0.96 },
  quality: { temporal: 0.3, blurPx: 0.9, contrast: 1.1, blackPoint: 0.03, whitePoint: 0.97 },
};

/** Map raw alpha 0..1 through black/white points + contrast around 0.5. */
export function refineAlphaUnit(a: number, p: SoftAlphaParams): number {
  const t = (a - p.blackPoint) / Math.max(1e-6, p.whitePoint - p.blackPoint);
  const clipped = Math.min(1, Math.max(0, t));
  const centered = (clipped - 0.5) * p.contrast + 0.5;
  return Math.min(1, Math.max(0, centered));
}

/**
 * Build a soft matte canvas from float alpha (row-major, length = w*h).
 * Writes RGBA where RGB=255 and A = refined alpha.
 */
export function writeSoftMatte(
  alpha: Float32Array,
  w: number,
  h: number,
  params: SoftAlphaParams,
  prev: Float32Array | null,
  target: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): Float32Array {
  const n = w * h;
  const smoothed = prev && prev.length === n ? prev : new Float32Array(n);
  const keep = params.temporal;
  const mix = 1 - keep;

  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }

  const img = ctx.createImageData(w, h);
  const out = img.data;

  for (let i = 0; i < n; i++) {
    const raw = alpha[i] ?? 0;
    const blended = smoothed[i] * keep + raw * mix;
    smoothed[i] = blended;
    const a = Math.round(refineAlphaUnit(blended, params) * 255);
    const o = i * 4;
    out[o] = 255;
    out[o + 1] = 255;
    out[o + 2] = 255;
    out[o + 3] = a;
  }

  ctx.putImageData(img, 0, 0);
  return smoothed;
}

/** Optional tiny blur pass for edge softness (canvas filter). */
export function blurMatteInPlace(
  src: HTMLCanvasElement,
  dest: HTMLCanvasElement,
  destCtx: CanvasRenderingContext2D,
  blurPx: number,
) {
  if (dest.width !== src.width || dest.height !== src.height) {
    dest.width = src.width;
    dest.height = src.height;
  }
  destCtx.clearRect(0, 0, dest.width, dest.height);
  if (blurPx <= 0.05) {
    destCtx.drawImage(src, 0, 0);
    return;
  }
  destCtx.filter = `blur(${blurPx.toFixed(2)}px)`;
  destCtx.drawImage(src, 0, 0);
  destCtx.filter = 'none';
}

/**
 * Light edge despill: pull fringe RGB toward neutral using alpha gradient.
 * Operates on person RGBA canvas already masked.
 */
export function despillFringe(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength = 0.35,
) {
  if (strength <= 0) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a <= 0.02 || a >= 0.98) continue;
    // Edge band: reduce chroma toward luminance (kills green/white halo).
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const edge = 1 - Math.abs(a - 0.5) * 2;
    const t = strength * edge;
    d[i] = Math.round(r + (y - r) * t);
    d[i + 1] = Math.round(g + (y - g) * t);
    d[i + 2] = Math.round(b + (y - b) * t);
  }
  ctx.putImageData(img, 0, 0);
}
