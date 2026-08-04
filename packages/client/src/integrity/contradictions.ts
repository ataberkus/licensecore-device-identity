/**
 * Cross-signal contradictions (UA vs platform, touch vs pointer, etc.).
 * `raw` maps collector id → successful raw value (errors omitted).
 */
export function detectContradictions(
  raw: Readonly<Record<string, unknown>>,
): { contradiction: boolean; details: Record<string, unknown> } {
  const flags: string[] = [];

  const ua = (raw['ua_string'] as { ua?: string } | undefined)?.ua ?? '';
  const cpu = raw['cpu_mem'] as
    | { platform?: string; hardwareConcurrency?: number | null }
    | undefined;
  const pointer = raw['pointer'] as
    | { maxTouchPoints?: number; pointerFine?: boolean }
    | undefined;
  const prefs = raw['prefs'] as { maxTouchPoints?: number } | undefined;
  if (ua && cpu?.platform) {
    const platform = cpu.platform.trim();
    if (platform.length > 0) {
      // Strong spoof only: mobile UA on clear desktop OS tokens.
      // Do not flag Mac↔Win — Playwright WebKit on Windows often ships a
      // Macintosh-like UA with Win32 platform (false positive that blocked T4).
      if (/Android/i.test(ua) && /Win|Mac/i.test(platform)) {
        flags.push('android_ua_desktop_platform');
      }
      if (/iPhone|iPad/i.test(ua) && /Win/i.test(platform)) {
        flags.push('ios_ua_windows_platform');
      }
    }
  }

  const touch =
    pointer?.maxTouchPoints ??
    prefs?.maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0);
  if (touch === 0 && /Mobile|Android|iPhone/i.test(ua)) {
    flags.push('mobile_ua_zero_touch');
  }
  if ((touch ?? 0) > 0 && pointer?.pointerFine === true && /Mobile/i.test(ua) === false) {
    // desktop with touch is ok; skip
  }

  if (cpu && typeof cpu.hardwareConcurrency === 'number' && cpu.hardwareConcurrency <= 0) {
    flags.push('invalid_concurrency');
  }

  return {
    contradiction: flags.length > 0,
    details: { flags },
  };
}
