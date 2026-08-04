import { createHash, createPublicKey, verify } from 'node:crypto';
import type { AnchorProof } from '@licensecore/shared';
import {
  b64urlToBytes,
  extractAaguid,
  parseAttestationObject,
  parseAuthenticatorDataFlags,
} from '../crypto/webauthn.js';
import type { AnchorRecord } from '../db/store.js';

export type VerifyAnchorOk = {
  ok: true;
  keyId: string;
  tier: 1 | 2 | 3;
  publicKeySpki: string | null;
  aaguid: string | null;
  beFlag: boolean | null;
  bsFlag: boolean | null;
  signCount: number;
  hardwareBacked: boolean;
};

export type VerifyAnchorFail = {
  ok: false;
  reason: string;
};

/**
 * Canonical signature message:
 * utf8(nonce) || utf8(origin) || utf8(stableHash) || utf8(keyId)
 *
 * WebCrypto ECDSA-SHA256 signs this message (hashing internally).
 * Node must verify with algorithm `'sha256'` over the same bytes —
 * `verify(null, prehash, …)` does NOT accept WebCrypto P1363 signatures.
 */
export function signatureMessage(opts: {
  nonce: string;
  origin: string;
  stableHash: string;
  keyId: string;
}): Buffer {
  return Buffer.concat([
    Buffer.from(opts.nonce, 'utf8'),
    Buffer.from(opts.origin, 'utf8'),
    Buffer.from(opts.stableHash, 'utf8'),
    Buffer.from(opts.keyId, 'utf8'),
  ]);
}

/** @deprecated Use signatureMessage + verify with sha256; kept for digest helpers. */
export function signatureDigest(opts: {
  nonce: string;
  origin: string;
  stableHash: string;
  keyId: string;
}): Buffer {
  return createHash('sha256').update(signatureMessage(opts)).digest();
}

export function verifyEcdsaP1363(opts: {
  publicKeySpkiB64url: string;
  message: Buffer;
  signatureB64url: string;
}): boolean {
  try {
    const spki = Buffer.from(b64urlToBytes(opts.publicKeySpkiB64url));
    const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    const sig = Buffer.from(b64urlToBytes(opts.signatureB64url));
    return verify(
      'sha256',
      opts.message,
      { key, dsaEncoding: 'ieee-p1363' },
      sig,
    );
  } catch {
    return false;
  }
}

/**
 * Verify anchor proof. Fail closed — never auto-enroll on bad sig.
 *
 * Tier 2: ECDSA P-256 P1363 over canonical digest.
 * Tier 1: WebAuthn assertion (challenge = nonce); BE===0 for hardwareBacked.
 * Tier 3: no crypto (anchor should be null at call site).
 */
export async function verifyAnchor(opts: {
  anchor: AnchorProof;
  nonce: string;
  origin: string;
  stableHash: string;
  existing: AnchorRecord | null;
  expectedRpId?: string;
}): Promise<VerifyAnchorOk | VerifyAnchorFail> {
  const { anchor } = opts;

  if (anchor.tier === 3) {
    return { ok: false, reason: 'tier 3 should not carry a signature proof' };
  }

  if (anchor.tier === 2) {
    const spki =
      opts.existing?.publicKeySpki ?? anchor.publicKeySpki ?? null;
    if (!spki) {
      return { ok: false, reason: 'missing publicKeySpki for Tier 2' };
    }
    const message = signatureMessage({
      nonce: opts.nonce,
      origin: opts.origin,
      stableHash: opts.stableHash,
      keyId: anchor.keyId,
    });
    const ok = verifyEcdsaP1363({
      publicKeySpkiB64url: spki,
      message,
      signatureB64url: anchor.signature,
    });
    if (!ok) return { ok: false, reason: 'ECDSA signature invalid' };
    return {
      ok: true,
      keyId: anchor.keyId,
      tier: 2,
      publicKeySpki: spki,
      aaguid: null,
      beFlag: null,
      bsFlag: null,
      signCount: anchor.signCount ?? opts.existing?.signCount ?? 0,
      hardwareBacked: false,
    };
  }

  // Tier 1 WebAuthn
  if (!anchor.clientDataJSON || !anchor.authenticatorData) {
    return {
      ok: false,
      reason: 'Tier 1 requires clientDataJSON and authenticatorData',
    };
  }

  let clientData: { type?: string; challenge?: string; origin?: string };
  try {
    const raw = b64urlToBytes(anchor.clientDataJSON);
    clientData = JSON.parse(Buffer.from(raw).toString('utf8')) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };
  } catch {
    return { ok: false, reason: 'invalid clientDataJSON' };
  }

  if (clientData.origin !== opts.origin) {
    return { ok: false, reason: 'clientDataJSON origin mismatch' };
  }

  // challenge = base64url(nonce) where nonce is 64 hex chars → encode hex bytes? 
  // Plan: clientDataJSON.challenge = base64url(nonce)
  // Interpret nonce as utf8 string for challenge binding.
  const expectedChallenge = Buffer.from(opts.nonce, 'utf8').toString('base64url');
  // Also accept hex-decoded 32-byte form:
  const expectedChallengeHex = Buffer.from(opts.nonce, 'hex').toString('base64url');
  if (
    clientData.challenge !== expectedChallenge &&
    clientData.challenge !== expectedChallengeHex &&
    clientData.challenge !== opts.nonce
  ) {
    return { ok: false, reason: 'clientDataJSON challenge mismatch' };
  }

  const authData = b64urlToBytes(anchor.authenticatorData);
  let flags;
  try {
    flags = parseAuthenticatorDataFlags(authData);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'bad authenticatorData',
    };
  }

  // Verify ECDSA over authenticatorData || SHA256(clientDataJSON) if public key known,
  // or accept attestationObject on create. For get assertions with stored key:
  const spki = opts.existing?.publicKeySpki ?? anchor.publicKeySpki ?? null;
  if (spki) {
    const cdHash = createHash('sha256')
      .update(b64urlToBytes(anchor.clientDataJSON))
      .digest();
    const msg = Buffer.concat([Buffer.from(authData), cdHash]);
    // WebAuthn signatures are DER-encoded ECDSA, not P1363 — convert attempt both.
    const sigBytes = Buffer.from(b64urlToBytes(anchor.signature));
    let ok = false;
    try {
      const key = createPublicKey({
        key: Buffer.from(b64urlToBytes(spki)),
        format: 'der',
        type: 'spki',
      });
      ok = verify('SHA-256', msg, { key, dsaEncoding: 'der' }, sigBytes);
      if (!ok) {
        ok = verify('SHA-256', msg, { key, dsaEncoding: 'ieee-p1363' }, sigBytes);
      }
    } catch {
      ok = false;
    }
    if (!ok) return { ok: false, reason: 'WebAuthn assertion signature invalid' };
  } else if (!anchor.attestationObject) {
    // First enroll without stored key requires attestationObject
    return {
      ok: false,
      reason: 'Tier 1 enroll requires attestationObject or known public key',
    };
  } else {
    // Parse attestation via @simplewebauthn/server; BE gate from authData.
    try {
      const att = parseAttestationObject(anchor.attestationObject);
      flags = att.flags;
    } catch {
      return { ok: false, reason: 'invalid attestationObject' };
    }
  }

  const aaguid = extractAaguid(authData);
  const beFlag = flags.be;
  const hardwareBacked = beFlag === false;

  if (opts.existing && anchor.signCount != null) {
    if (anchor.signCount < opts.existing.signCount) {
      return { ok: false, reason: 'signCount rollback' };
    }
  }

  return {
    ok: true,
    keyId: anchor.keyId,
    tier: 1,
    publicKeySpki: spki,
    aaguid,
    beFlag,
    bsFlag: flags.bs,
    signCount: anchor.signCount ?? opts.existing?.signCount ?? 0,
    hardwareBacked,
  };
}
