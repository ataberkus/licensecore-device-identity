/**
 * WebAuthn attestation / authenticatorData helpers.
 * Uses @simplewebauthn/server (MIT) for CBOR attestation decode;
 * BE===0 required for hardwareBacked Tier 1 (reject syncable passkeys).
 */

import { decodeAttestationObject } from '@simplewebauthn/server/helpers';
import { createHash } from 'node:crypto';

export type AuthDataFlags = {
  up: boolean;
  uv: boolean;
  be: boolean;
  bs: boolean;
  at: boolean;
  ed: boolean;
};

/** Parse flags from authenticatorData (WebAuthn L3 BE/BS bits). */
export function parseAuthenticatorDataFlags(
  authenticatorData: Uint8Array,
): AuthDataFlags {
  if (authenticatorData.length < 37) {
    throw new Error('authenticatorData too short');
  }
  const flags = authenticatorData[32]!;
  return {
    up: (flags & 0x01) !== 0,
    uv: (flags & 0x04) !== 0,
    be: (flags & 0x08) !== 0,
    bs: (flags & 0x10) !== 0,
    at: (flags & 0x40) !== 0,
    ed: (flags & 0x80) !== 0,
  };
}

export function extractAaguid(authenticatorData: Uint8Array): string | null {
  if (authenticatorData.length < 53) return null;
  const flags = authenticatorData[32]!;
  if ((flags & 0x40) === 0) return null; // AT not set
  const aaguid = authenticatorData.slice(37, 53);
  return Buffer.from(aaguid).toString('hex');
}

/**
 * Decode attestationObject via @simplewebauthn/server and return authData + fmt.
 */
export function parseAttestationObject(attestationObjectB64url: string): {
  fmt: string;
  authData: Uint8Array;
  flags: AuthDataFlags;
  aaguid: string | null;
} {
  const bytes = b64urlToBytes(attestationObjectB64url);
  const decoded = decodeAttestationObject(
    bytes as Uint8Array<ArrayBuffer>,
  );
  const authData = decoded.get('authData');
  const fmt = decoded.get('fmt');
  const flags = parseAuthenticatorDataFlags(authData);
  return {
    fmt: String(fmt),
    authData,
    flags,
    aaguid: extractAaguid(authData),
  };
}

export function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function bytesToB64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/** SHA-256 digest of clientDataJSON bytes (WebAuthn). */
export function clientDataHash(clientDataJSON: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(clientDataJSON).digest());
}

/**
 * hardwareBacked is true only when Tier 1 and BE===0.
 */
export function isHardwareBacked(
  tier: 1 | 2 | 3,
  beFlag: boolean | null,
): boolean {
  return tier === 1 && beFlag === false;
}
