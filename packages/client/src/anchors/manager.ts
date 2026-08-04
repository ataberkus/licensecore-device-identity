import type { AnchorProof } from '@licensecore/shared';
import { proveTier1, wipeTier1Local } from './tier1_webauthn.js';
import {
  getTier2KeyId,
  proveTier2,
  proveTier2WithSpki,
  wipeTier2,
} from './tier2_subtle.js';
import { clearMirrors } from './storage.js';

export interface AnchorManagerOptions {
  /**
   * When true, attempt WebAuthn platform enrollment (Tier 1).
   * Default false — never prompts unless opted in.
   */
  enrollHardwareAnchor?: boolean;
  /** Force include Tier 2 SPKI on prove (first enroll to server). */
  includeSpki?: boolean;
}

/**
 * Try Tier 1 → Tier 2 → Tier 3 (null proof).
 * Client never invents a device_id.
 */
export async function obtainAnchorProof(
  parts: {
    nonce: string;
    origin: string;
    stableHash: string;
  },
  options: AnchorManagerOptions = {},
): Promise<AnchorProof | null> {
  const enroll = options.enrollHardwareAnchor === true;

  if (enroll || hasLocalTier1()) {
    const t1 = await proveTier1({
      nonce: parts.nonce,
      origin: parts.origin,
      enroll,
    });
    if (t1) return t1;
  }

  try {
    if (options.includeSpki) {
      return await proveTier2WithSpki(parts);
    }
    return await proveTier2(parts);
  } catch {
    // Tier 3 — evidence only
    return null;
  }
}

function hasLocalTier1(): boolean {
  try {
    return Boolean(localStorage.getItem('lc.di.t1.cred'));
  } catch {
    return false;
  }
}

/** Wipe Tier 1+2 local material and thumbprint mirrors. */
export async function wipeAllAnchors(): Promise<void> {
  wipeTier1Local();
  await wipeTier2();
  await clearMirrors();
}

export async function wipeLocalState(): Promise<void> {
  await wipeAllAnchors();
}

export { getTier2KeyId };
