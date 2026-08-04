/**
 * Collector IDs and class map (S = stable, V = volatile).
 */

export const S_COLLECTOR_IDS = [
  'webgl_gpu',
  'webgpu_adapter',
  'canvas_render',
  'webgl_render',
  'audio_dsp',
  'cpu_mem',
  'ua_ch_high',
  'display',
  'media_hw_decode',
  'font_metrics',
  'math_fp',
  'storage_quota',
  'timing_profile',
] as const;

export const V_COLLECTOR_IDS = [
  'ua_string',
  'languages',
  'timezone',
  'network',
  'prefs',
  'pointer',
  'plugins',
] as const;

export const COLLECTOR_IDS = [...S_COLLECTOR_IDS, ...V_COLLECTOR_IDS] as const;

export type SCollectorId = (typeof S_COLLECTOR_IDS)[number];
export type VCollectorId = (typeof V_COLLECTOR_IDS)[number];
export type CollectorId = (typeof COLLECTOR_IDS)[number];

export type CollectorClass = 'S' | 'V';

export const COLLECTOR_CLASS: Readonly<Record<CollectorId, CollectorClass>> = {
  webgl_gpu: 'S',
  webgpu_adapter: 'S',
  canvas_render: 'S',
  webgl_render: 'S',
  audio_dsp: 'S',
  cpu_mem: 'S',
  ua_ch_high: 'S',
  display: 'S',
  media_hw_decode: 'S',
  font_metrics: 'S',
  math_fp: 'S',
  storage_quota: 'S',
  timing_profile: 'S',
  ua_string: 'V',
  languages: 'V',
  timezone: 'V',
  network: 'V',
  prefs: 'V',
  pointer: 'V',
  plugins: 'V',
};

export function isSCollectorId(id: string): id is SCollectorId {
  return (S_COLLECTOR_IDS as readonly string[]).includes(id);
}

export function isVCollectorId(id: string): id is VCollectorId {
  return (V_COLLECTOR_IDS as readonly string[]).includes(id);
}

export function isCollectorId(id: string): id is CollectorId {
  return (COLLECTOR_IDS as readonly string[]).includes(id);
}
