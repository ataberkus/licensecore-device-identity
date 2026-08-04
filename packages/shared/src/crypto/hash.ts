/**
 * Shared hash util types / helpers.
 * Wire component hashes are SHA-256 truncated to 128-bit (32 hex chars).
 */

/** Hex length of a truncated component / stable / volatile hash on the wire. */
export const HASH_HEX_LEN = 32;

/** Full SHA-256 hex length before truncation. */
export const SHA256_HEX_LEN = 64;

const HEX_RE = /^[0-9a-f]+$/i;

export function isHashHex128(value: string): boolean {
  return value.length === HASH_HEX_LEN && HEX_RE.test(value);
}

/**
 * Truncate a full SHA-256 hex digest to the 128-bit wire form (first 32 hex chars).
 * Does not perform hashing — callers supply the digest hex.
 */
export function truncateSha256HexTo128(sha256Hex: string): string {
  if (sha256Hex.length !== SHA256_HEX_LEN || !HEX_RE.test(sha256Hex)) {
    throw new Error('expected 64-char SHA-256 hex digest');
  }
  return sha256Hex.slice(0, HASH_HEX_LEN).toLowerCase();
}

/**
 * Canonical signature payload binding (logical):
 * SHA-256(utf8(nonce) || utf8(origin) || utf8(stableHash) || utf8(keyId))
 * ECDSA-P256 over that digest as IEEE P1363 raw 64-byte (r||s), b64url on wire.
 */
export const SIGNATURE_ENCODING = 'P1363' as const;
