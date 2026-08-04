import type { CollectorDefinition } from '../types.js';
import { collectWebglGpu } from './s1_webgl_gpu.js';
import { collectWebgpuAdapter } from './s2_webgpu_adapter.js';
import { collectCanvasRender } from './s3_canvas_render.js';
import { collectWebglRender } from './s4_webgl_render.js';
import { collectAudioDsp } from './s5_audio_dsp.js';
import { collectCpuMem } from './s6_cpu_mem.js';
import { collectUaChHigh } from './s7_ua_ch_high.js';
import { collectDisplay } from './s8_display.js';
import { collectMediaHwDecode } from './s9_media_hw_decode.js';
import { collectFontMetrics } from './s10_font_metrics.js';
import { collectMathFp } from './s12_math_fp.js';
import { collectStorageQuota } from './s13_storage_quota.js';
import { collectTimingProfile } from './s14_timing_profile.js';
import { collectUaString } from './v1_ua.js';
import { collectLanguages } from './v2_languages.js';
import { collectTimezone } from './v3_timezone.js';
import { collectNetwork } from './v5_network.js';
import { collectPrefs } from './v6_prefs.js';
import { collectPointer } from './v7_pointer.js';
import { collectPlugins } from './v8_plugins.js';

/** All CLASS S and V collectors. */
export const ALL_COLLECTORS: readonly CollectorDefinition[] = [
  { id: 'webgl_gpu', class: 'S', timeoutMs: 50, collect: collectWebglGpu },
  { id: 'webgpu_adapter', class: 'S', timeoutMs: 80, collect: collectWebgpuAdapter },
  { id: 'canvas_render', class: 'S', timeoutMs: 40, collect: collectCanvasRender },
  { id: 'webgl_render', class: 'S', timeoutMs: 50, collect: collectWebglRender },
  { id: 'audio_dsp', class: 'S', timeoutMs: 80, collect: collectAudioDsp },
  { id: 'cpu_mem', class: 'S', timeoutMs: 20, collect: collectCpuMem },
  { id: 'ua_ch_high', class: 'S', timeoutMs: 50, collect: collectUaChHigh },
  { id: 'display', class: 'S', timeoutMs: 20, collect: collectDisplay },
  { id: 'media_hw_decode', class: 'S', timeoutMs: 40, collect: collectMediaHwDecode },
  { id: 'font_metrics', class: 'S', timeoutMs: 60, collect: collectFontMetrics },
  { id: 'math_fp', class: 'S', timeoutMs: 20, collect: collectMathFp },
  { id: 'storage_quota', class: 'S', timeoutMs: 50, collect: collectStorageQuota },
  { id: 'timing_profile', class: 'S', timeoutMs: 25, collect: collectTimingProfile },
  { id: 'ua_string', class: 'V', timeoutMs: 10, collect: collectUaString },
  { id: 'languages', class: 'V', timeoutMs: 10, collect: collectLanguages },
  { id: 'timezone', class: 'V', timeoutMs: 10, collect: collectTimezone },
  { id: 'network', class: 'V', timeoutMs: 15, collect: collectNetwork },
  { id: 'prefs', class: 'V', timeoutMs: 10, collect: collectPrefs },
  { id: 'pointer', class: 'V', timeoutMs: 10, collect: collectPointer },
  { id: 'plugins', class: 'V', timeoutMs: 15, collect: collectPlugins },
];
