import {
  CANDIDATE_SCORE,
  REBIND_SCORE,
  SPOOF_SCORE_REBIND_BLOCK,
} from '@licensecore/shared';

export type ScoredCandidate = {
  deviceId: string;
  score: number;
  baseScore: number;
};

/**
 * Rebind gate (plan 4a):
 * blended score ≥ 0.90 AND exactly one candidate ≥ 0.75 AND spoofScore < 40.
 */
export function decideRebind(opts: {
  spoofScore: number;
  candidates: ScoredCandidate[];
}):
  | { action: 'rebind'; deviceId: string; score: number }
  | { action: 'ambiguous'; deviceIds: string[] }
  | { action: 'enroll' } {
  if (opts.spoofScore >= SPOOF_SCORE_REBIND_BLOCK) {
    return { action: 'enroll' };
  }

  const strong = opts.candidates.filter((c) => c.score >= CANDIDATE_SCORE);
  const rebindable = strong.filter((c) => c.score >= REBIND_SCORE);

  if (rebindable.length === 1 && strong.length === 1) {
    const top = rebindable[0]!;
    return { action: 'rebind', deviceId: top.deviceId, score: top.score };
  }

  if (strong.length >= 2 && rebindable.length >= 1) {
    // score ≥ 0.90 but ≥2 candidates ≥ 0.75
    return {
      action: 'ambiguous',
      deviceIds: strong.map((c) => c.deviceId),
    };
  }

  // Also ambiguous when multiple ≥ 0.90
  if (rebindable.length >= 2) {
    return {
      action: 'ambiguous',
      deviceIds: rebindable.map((c) => c.deviceId),
    };
  }

  return { action: 'enroll' };
}
