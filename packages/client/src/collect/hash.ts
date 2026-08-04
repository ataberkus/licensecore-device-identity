import { truncateSha256HexTo128 } from '@licensecore/shared/crypto/hash';

const textEncoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    out += (view[i] ?? 0).toString(16).padStart(2, '0');
  }
  return out;
}

/** SHA-256 hex (64 chars) via SubtleCrypto. */
export async function sha256Hex(data: BufferSource | string): Promise<string> {
  const buf =
    typeof data === 'string' ? textEncoder.encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return bytesToHex(digest);
}

/** SHA-256 truncated to 128-bit hex (32 chars) — wire component / aggregate form. */
export async function sha256Truncate128(
  data: BufferSource | string,
): Promise<string> {
  const full = await sha256Hex(data);
  return truncateSha256HexTo128(full);
}

/**
 * Deterministic JSON for hashing: recursively sorted object keys,
 * arrays preserve order, `undefined` omitted.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined) {
      out[k] = canonicalize(v);
    }
  }
  return out;
}

/** Hash a collector value (or empty string for failures). */
export async function hashCollectorValue(value: unknown): Promise<string> {
  if (value === undefined) {
    return sha256Truncate128('');
  }
  return sha256Truncate128(canonicalJson(value));
}

/**
 * Aggregate hash over sorted component `h` values (errors already excluded by caller).
 * Format: id=h pairs joined by `\n`, sorted by id.
 */
export async function hashSortedComponentHs(
  entries: ReadonlyArray<readonly [string, string]>,
): Promise<string> {
  const sorted = [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const payload = sorted.map(([id, h]) => `${id}=${h}`).join('\n');
  return sha256Truncate128(payload);
}

/** Concatenate utf8 strings for signature binding. */
export function concatUtf8(...parts: string[]): Uint8Array {
  const encoded = parts.map((p) => textEncoder.encode(p));
  let len = 0;
  for (const e of encoded) len += e.length;
  const out = new Uint8Array(len);
  let offset = 0;
  for (const e of encoded) {
    out.set(e, offset);
    offset += e.length;
  }
  return out;
}
