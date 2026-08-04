/**
 * Rebind / match / blend thresholds from the Phase 1 decision table.
 */

/** Minimum blended score to rebind an unknown keyId to an existing device. */
export const REBIND_SCORE = 0.9;

/** Minimum score for a device to count as a rebind candidate. */
export const CANDIDATE_SCORE = 0.75;

/**
 * Fingerprint base must be ≥ this before server-signal blend may push
 * the score across REBIND_SCORE (anti-IP-farm rebind).
 */
export const BLEND_MIN_BASE_FOR_REBIND = 0.85;

/** Server spoofScore at/above this blocks rebind (T9). */
export const SPOOF_SCORE_REBIND_BLOCK = 40;

/**
 * Recognize-path drift: fraction of S weights that changed above this
 * ⇒ emit `drift` + store revision; device_id unchanged.
 */
export const DRIFT_TOLERANCE = 0.25;

/** Candidate search lookback window (days). */
export const CANDIDATE_LOOKBACK_DAYS = 180;

/**
 * Unknown keys are not rebound onto a device seen more recently than this.
 * Separates concurrent second profiles (T5/T14) from post-wipe recovery (T4),
 * which should wait briefly after last recognize/enroll before re-resolving.
 */
export const REBIND_MIN_IDLE_MS = 3_000;

/** Hex prefix length of stableHash used for candidate bucket index. */
export const STABLE_HASH_BUCKET_PREFIX_LEN = 8;

/** Client collection hard budget (ms). */
export const COLLECTION_BUDGET_MS = 400;

/** Challenge nonce TTL (ms). */
export const NONCE_TTL_MS = 60_000;

/** Device JWT lifetime (ms). */
export const DEVICE_TOKEN_TTL_MS = 10 * 60_000;

/** Additive server-signal blend (capped via clamp01 after sum). */
export const SERVER_BLEND = {
  ip24Match: 0.03,
  asnMatch: 0.02,
  langOrderMatch: 0.01,
  headerOrderMatch: 0.01,
  ja4MatchIfPresent: 0.02,
} as const;

export const SCHEMA_VERSION = 1 as const;
