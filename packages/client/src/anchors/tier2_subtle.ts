import type { AnchorProof } from '@licensecore/shared';
import { signBinding } from './sign.js';
import {
  exportSpkiB64Url,
  idbClearTier2,
  idbGetTier2,
  idbPutTier2,
  mirrorThumbprint,
  thumbprintFromSpki,
  type Tier2Record,
} from './storage.js';

const ECDSA_PARAMS: EcKeyGenParams = {
  name: 'ECDSA',
  namedCurve: 'P-256',
};

/**
 * Tier 2: non-extractable ECDSA P-256 CryptoKey in IndexedDB.
 * SPKI exported once at creation; mirrors store thumbprint only.
 */
export async function ensureTier2Key(): Promise<{
  key: CryptoKey;
  meta: Tier2Record;
  isNew: boolean;
}> {
  const existing = await idbGetTier2();
  if (existing) {
    await mirrorThumbprint(existing.meta.keyId);
    return { ...existing, isNew: false };
  }

  const pair = await crypto.subtle.generateKey(ECDSA_PARAMS, false, [
    'sign',
    'verify',
  ]);
  const publicKeySpkiB64Url = await exportSpkiB64Url(pair.publicKey);
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  const keyId = await thumbprintFromSpki(spki);
  const meta: Tier2Record = {
    keyId,
    publicKeySpkiB64Url,
    createdAtMs: Date.now(),
  };
  await idbPutTier2(pair.privateKey, meta);
  await mirrorThumbprint(keyId);
  return { key: pair.privateKey, meta, isNew: true };
}

export async function proveTier2(parts: {
  nonce: string;
  origin: string;
  stableHash: string;
}): Promise<AnchorProof> {
  const { key, meta, isNew } = await ensureTier2Key();
  const signature = await signBinding(key, {
    nonce: parts.nonce,
    origin: parts.origin,
    stableHash: parts.stableHash,
    keyId: meta.keyId,
  });
  const proof: AnchorProof = {
    tier: 2,
    keyId: meta.keyId,
    signature,
  };
  if (isNew) {
    return { ...proof, publicKeySpki: meta.publicKeySpkiB64Url };
  }
  // Re-send SPKI when server may not have it yet — still OK to include on first
  // session after enroll. For subsequent proves we omit unless caller wants it.
  return proof;
}

/** Always include SPKI (e.g. first resolve after local enroll). */
export async function proveTier2WithSpki(parts: {
  nonce: string;
  origin: string;
  stableHash: string;
}): Promise<AnchorProof> {
  const { key, meta } = await ensureTier2Key();
  const signature = await signBinding(key, {
    nonce: parts.nonce,
    origin: parts.origin,
    stableHash: parts.stableHash,
    keyId: meta.keyId,
  });
  return {
    tier: 2,
    keyId: meta.keyId,
    signature,
    publicKeySpki: meta.publicKeySpkiB64Url,
  };
}

export async function wipeTier2(): Promise<void> {
  await idbClearTier2();
}

export async function getTier2KeyId(): Promise<string | null> {
  const row = await idbGetTier2();
  return row?.meta.keyId ?? null;
}
