import { uuidv7 } from 'uuidv7';
import type { AnchorTier, Confidence } from '@licensecore/shared';

export function newDeviceId(): string {
  return uuidv7();
}

export function confidenceForEnroll(
  tier: AnchorTier,
  hardwareBacked: boolean,
): Confidence {
  if (tier === 3) return 'low';
  if (tier === 1 && hardwareBacked) return 'high';
  if (tier === 1 || tier === 2) return 'medium';
  return 'low';
}

export function confidenceForRecognize(tier: AnchorTier): Confidence {
  if (tier === 1 || tier === 2) return 'high';
  return 'medium';
}
