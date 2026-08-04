/**
 * Per-collector CLASS S match weights (sum = 1.0).
 * Matching uses CLASS S only; `error: true` components are excluded from
 * both numerator and denominator at score time.
 */
import type { SCollectorId } from './collectors.js';

export const S_WEIGHTS: Readonly<Record<SCollectorId, number>> = {
  webgl_gpu: 0.13,
  webgpu_adapter: 0.1,
  canvas_render: 0.11,
  webgl_render: 0.09,
  audio_dsp: 0.09,
  cpu_mem: 0.06,
  ua_ch_high: 0.09,
  display: 0.05,
  media_hw_decode: 0.06,
  font_metrics: 0.09,
  math_fp: 0.05,
  storage_quota: 0.04,
  timing_profile: 0.04,
};

/** Sum of S_WEIGHTS — must stay 1.0. */
export const S_WEIGHTS_SUM = (
  Object.values(S_WEIGHTS) as number[]
).reduce((a, b) => a + b, 0);
