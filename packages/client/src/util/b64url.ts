/** Base64url (no padding) encode/decode — browser-safe, no Node Buffer. */

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/** Base64url (no padding) encode. */
export function bytesToB64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < view.length; i++) {
    bin += String.fromCharCode(view[i] ?? 0);
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

/** Base64url decode to Uint8Array backed by ArrayBuffer. */
export function b64UrlToBytes(b64url: string): Uint8Array {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(padLen);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function utf8ToB64Url(text: string): string {
  return bytesToB64Url(new TextEncoder().encode(text));
}

/** Copy into a fresh ArrayBuffer-backed Uint8Array (BufferSource-safe). */
export function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const ab = toArrayBuffer(bytes);
  return new Uint8Array(ab);
}
