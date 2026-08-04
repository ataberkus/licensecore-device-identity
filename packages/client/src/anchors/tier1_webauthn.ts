import type { AnchorProof } from '@licensecore/shared';
import { asBufferSource, bytesToB64Url, b64UrlToBytes } from '../util/b64url.js';

const LS_CRED_ID = 'lc.di.t1.cred';
const RP_NAME = 'LicenseCore Device Identity';

/**
 * Tier 1 — WebAuthn platform authenticator.
 *
 * **BE===0 gate:** WebAuthn L3 Backup Eligibility (BE) bit in authenticator
 * data flags must be 0 (device-bound, non-syncable). Syncable passkeys
 * (iCloud/Google Password Manager, BE=1) are rejected here; caller falls
 * back to Tier 2. Server also enforces BE===0.
 *
 * Enrollment is opt-in only (`enrollHardwareAnchor: true`). Default SDK
 * path never prompts for WebAuthn.
 */
export async function proveTier1(parts: {
  nonce: string;
  origin: string;
  enroll: boolean;
}): Promise<AnchorProof | null> {
  if (typeof PublicKeyCredential === 'undefined') return null;
  if (typeof window !== 'undefined' && !window.isSecureContext) return null;

  const existingId = readCredId();
  if (existingId) {
    return assertExisting(existingId, parts.nonce, parts.origin);
  }
  if (!parts.enroll) return null;
  return enrollNew(parts.nonce, parts.origin);
}

async function enrollNew(
  nonce: string,
  origin: string,
): Promise<AnchorProof | null> {
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = challengeFromNonce(nonce);

  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: RP_NAME, id: rpIdFromOrigin(origin) },
        user: {
          id: userId,
          name: 'device-anchor',
          displayName: 'Device Anchor',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          requireResidentKey: false,
          userVerification: 'preferred',
        },
        attestation: 'direct',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
  } catch {
    return null;
  }
  if (!cred) return null;

  const att = cred.response as AuthenticatorAttestationResponse;
  const authData = new Uint8Array(
    typeof att.getAuthenticatorData === 'function'
      ? att.getAuthenticatorData()
      : new ArrayBuffer(0),
  );
  if (!authData.length) return null;

  if (isBackupEligible(authData)) {
    return null;
  }

  const credId = bytesToB64Url(cred.rawId);
  writeCredId(credId);

  return {
    tier: 1,
    keyId: credId,
    signature: bytesToB64Url(att.attestationObject),
    attestationObject: bytesToB64Url(att.attestationObject),
    clientDataJSON: bytesToB64Url(att.clientDataJSON),
  };
}

async function assertExisting(
  credIdB64: string,
  nonce: string,
  origin: string,
): Promise<AnchorProof | null> {
  const challenge = challengeFromNonce(nonce);
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: rpIdFromOrigin(origin),
        allowCredentials: [
          {
            type: 'public-key',
            id: asBufferSource(b64UrlToBytes(credIdB64)),
            transports: ['internal'],
          },
        ],
        userVerification: 'preferred',
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
  } catch {
    return null;
  }
  if (!cred) return null;

  const resp = cred.response as AuthenticatorAssertionResponse;
  const authData = new Uint8Array(resp.authenticatorData);
  if (isBackupEligible(authData)) {
    return null;
  }

  const signCount =
    authData.length >= 37
      ? ((authData[33]! << 24) |
          (authData[34]! << 16) |
          (authData[35]! << 8) |
          authData[36]!) >>>
        0
      : 0;

  return {
    tier: 1,
    keyId: credIdB64,
    signature: bytesToB64Url(resp.signature),
    clientDataJSON: bytesToB64Url(resp.clientDataJSON),
    authenticatorData: bytesToB64Url(resp.authenticatorData),
    signCount,
  };
}

/**
 * Flags byte is at index 32 of authenticatorData.
 * Bit 3 = BE (Backup Eligibility), bit 4 = BS (Backup State) — WebAuthn L3.
 */
export function isBackupEligible(authenticatorData: Uint8Array): boolean {
  if (authenticatorData.length < 33) return false;
  const flags = authenticatorData[32] ?? 0;
  return (flags & 0b0000_1000) !== 0;
}

function challengeFromNonce(nonce: string): ArrayBuffer {
  if (/^[0-9a-f]{64}$/i.test(nonce)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      out[i] = parseInt(nonce.slice(i * 2, i * 2 + 2), 16);
    }
    return out.buffer;
  }
  return new TextEncoder().encode(nonce).buffer;
}

function rpIdFromOrigin(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return typeof location !== 'undefined' ? location.hostname : 'localhost';
  }
}

function readCredId(): string | null {
  try {
    return localStorage.getItem(LS_CRED_ID);
  } catch {
    return null;
  }
}

function writeCredId(id: string): void {
  try {
    localStorage.setItem(LS_CRED_ID, id);
  } catch {
    /* ignore */
  }
}

export function wipeTier1Local(): void {
  try {
    localStorage.removeItem(LS_CRED_ID);
  } catch {
    /* ignore */
  }
}
