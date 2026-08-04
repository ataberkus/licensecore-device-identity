import { describe, expect, it } from 'vitest';
import { bindingMessage, signBinding } from '../../packages/client/src/anchors/sign.js';
import { bytesToB64Url, b64UrlToBytes } from '../../packages/client/src/util/b64url.js';
import { concatUtf8 } from '../../packages/client/src/collect/hash.js';

describe('anchors/sign + b64url', () => {
  it('roundtrips b64url', () => {
    const src = new Uint8Array([0, 1, 2, 250, 255]);
    const enc = bytesToB64Url(src);
    expect(enc).not.toMatch(/[+/=]/);
    expect([...b64UrlToBytes(enc)]).toEqual([...src]);
  });

  it('signs ECDSA P-256 P1363 binding (64-byte raw)', async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify'],
    );
    const parts = {
      nonce: 'a'.repeat(64),
      origin: 'https://example.com',
      stableHash: 'b'.repeat(32),
      keyId: 'c'.repeat(64),
    };
    const sigB64 = await signBinding(pair.privateKey, parts);
    const sig = b64UrlToBytes(sigB64);
    expect(sig.byteLength).toBe(64);

    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      sig,
      bindingMessage(parts),
    );
    expect(ok).toBe(true);

    const msg = concatUtf8(
      parts.nonce,
      parts.origin,
      parts.stableHash,
      parts.keyId,
    );
    expect([...msg]).toEqual([...bindingMessage(parts)]);
  });
});
