import {
  BLEND_MIN_BASE_FOR_REBIND,
  REBIND_SCORE,
  S_COLLECTOR_IDS,
  S_WEIGHTS,
  SERVER_BLEND,
  type ComponentHashes,
  type ServerSignals,
} from '@licensecore/shared';

export function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Weighted CLASS-S match. `error: true` excluded from numerator and denominator.
 */
export function scoreSComponents(
  a: ComponentHashes,
  b: ComponentHashes,
): number {
  let num = 0;
  let den = 0;
  for (const id of S_COLLECTOR_IDS) {
    const ca = a[id];
    const cb = b[id];
    if (!ca || !cb) continue;
    if (ca.error || cb.error) continue;
    const w = S_WEIGHTS[id];
    den += w;
    if (ca.h.toLowerCase() === cb.h.toLowerCase()) {
      num += w;
    }
  }
  if (den <= 0) return 0;
  return num / den;
}

/**
 * Fraction of S weights that changed (both sides present, non-error).
 */
export function driftFraction(
  a: ComponentHashes,
  b: ComponentHashes,
): number {
  let changed = 0;
  let den = 0;
  for (const id of S_COLLECTOR_IDS) {
    const ca = a[id];
    const cb = b[id];
    if (!ca || !cb) continue;
    if (ca.error || cb.error) continue;
    const w = S_WEIGHTS[id];
    den += w;
    if (ca.h.toLowerCase() !== cb.h.toLowerCase()) {
      changed += w;
    }
  }
  if (den <= 0) return 0;
  return changed / den;
}

export type BlendFlags = {
  ip24Match: boolean;
  asnMatch: boolean;
  langOrderMatch: boolean;
  headerOrderMatch: boolean;
  ja4Match: boolean;
};

export function compareServerSignals(
  incoming: ServerSignals,
  stored: ServerSignals,
): BlendFlags {
  return {
    ip24Match: incoming.ip24Hash === stored.ip24Hash,
    asnMatch:
      incoming.asn != null &&
      stored.asn != null &&
      incoming.asn === stored.asn,
    langOrderMatch: incoming.acceptLanguage === stored.acceptLanguage,
    headerOrderMatch: incoming.headerOrderHash === stored.headerOrderHash,
    ja4Match:
      incoming.ja4 != null &&
      stored.ja4 != null &&
      incoming.ja4 === stored.ja4,
  };
}

/**
 * s' = clamp01(s + blend…). Blend cannot alone push weak FP over 0.90;
 * base must be ≥ BLEND_MIN_BASE_FOR_REBIND before blend can cross REBIND_SCORE.
 */
export function blendScore(base: number, flags: BlendFlags): number {
  let add = 0;
  if (flags.ip24Match) add += SERVER_BLEND.ip24Match;
  if (flags.asnMatch) add += SERVER_BLEND.asnMatch;
  if (flags.langOrderMatch) add += SERVER_BLEND.langOrderMatch;
  if (flags.headerOrderMatch) add += SERVER_BLEND.headerOrderMatch;
  if (flags.ja4Match) add += SERVER_BLEND.ja4MatchIfPresent;

  const raw = clamp01(base + add);
  if (raw >= REBIND_SCORE && base < BLEND_MIN_BASE_FOR_REBIND) {
    return Math.min(raw, REBIND_SCORE - 0.0001);
  }
  return raw;
}
