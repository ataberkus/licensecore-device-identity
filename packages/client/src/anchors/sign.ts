import { concatUtf8 } from '../collect/hash.js';
import { asBufferSource, bytesToB64Url } from '../util/b64url.js';

/**
 * Canonical binding: ECDSA-P256-SHA256 over
 * utf8(nonce) || utf8(origin) || utf8(stableHash) || utf8(keyId)
 * Signature format: IEEE P1363 raw 64-byte (r||s), b64url on wire.
 *
 * WebCrypto ECDSA sign() returns P1363 and applies SHA-256 to the message.
 */
export async function signBinding(
  privateKey: CryptoKey,
  parts: {
    nonce: string;
    origin: string;
    stableHash: string;
    keyId: string;
  },
): Promise<string> {
  const message = asBufferSource(
    concatUtf8(parts.nonce, parts.origin, parts.stableHash, parts.keyId),
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    message,
  );
  return bytesToB64Url(sig);
}

/** Build the utf8 message bytes (for tests / server parity docs). */
export function bindingMessage(parts: {
  nonce: string;
  origin: string;
  stableHash: string;
  keyId: string;
}): Uint8Array {
  return concatUtf8(
    parts.nonce,
    parts.origin,
    parts.stableHash,
    parts.keyId,
  );
}
