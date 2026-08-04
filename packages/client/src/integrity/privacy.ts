/** Privacy hardening / anti-fingerprinting heuristics (RFP, resists). */
export function detectPrivacyHardening(
  raw: Readonly<Record<string, unknown>>,
): { hardening: boolean; details: Record<string, unknown> } {
  const flags: string[] = [];

  const display = raw['display'] as
    | { width?: number; height?: number; devicePixelRatio?: number; colorDepth?: number }
    | undefined;
  if (display?.devicePixelRatio === 1 && display.width === 1000 && display.height === 1000) {
    flags.push('rfp_screen_1000');
  }
  if (display?.colorDepth === 24 && display.width === 1000) {
    flags.push('possible_rfp_screen');
  }

  const uaCh = raw['ua_ch_high'] as { available?: boolean } | undefined;
  if (
    uaCh &&
    uaCh.available === false &&
    typeof navigator !== 'undefined' &&
    /Chrome\/\d+/i.test(navigator.userAgent)
  ) {
    // UA-CH absent on Chromium can indicate spoofing or old engine — soft
  }

  const canvas = raw['canvas_render'];
  const webgl = raw['webgl_gpu'];
  if (canvas == null && webgl == null) {
    flags.push('graphics_blocked');
  }

  // Firefox resistFingerprinting often reports UTC timezone
  const tz = raw['timezone'] as { timeZone?: string; offsetMin?: number } | undefined;
  if (tz?.timeZone === 'UTC' && tz.offsetMin === 0) {
    flags.push('utc_timezone');
  }

  try {
    if (typeof navigator !== 'undefined') {
      const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl;
      if (gpc === true) flags.push('gpc');
    }
  } catch {
    /* ignore */
  }

  return {
    hardening: flags.length > 0,
    details: { flags },
  };
}
