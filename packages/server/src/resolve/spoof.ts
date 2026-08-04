import type { IntegrityReport } from '@licensecore/shared';

/**
 * Server recomputes spoofScore from IntegrityReport flags.
 * Client spoofScore is advisory only — never trusted as authority.
 */
export function recomputeSpoofScore(integrity: IntegrityReport): number {
  let score = 0;
  if (integrity.nativeCodeTampering) score += 35;
  if (integrity.canvasNoise) score += 15;
  if (integrity.audioNoise) score += 15;
  if (integrity.crossSignalContradiction) score += 25;
  if (integrity.automationMarkers) score += 30;
  if (integrity.privacyHardening) score += 10;
  if (integrity.vmMarkers) score += 20;
  return Math.min(100, score);
}

export function privateContextHeuristic(integrity: IntegrityReport): boolean {
  if (integrity.privacyHardening) return true;
  const details = integrity.details;
  if (details && details['privateContext'] === true) return true;
  if (details && details['incognito'] === true) return true;
  return false;
}
