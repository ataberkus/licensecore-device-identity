import { createHash } from 'node:crypto';
import type { ServerSignals } from '@licensecore/shared';
import { hashIp, hashIp24 } from '../crypto/ip-hash.js';

export type RequestSignalInput = {
  ip: string;
  pepper: string;
  acceptLanguage: string;
  userAgent: string;
  /** Header names in arrival order (lowercase). */
  headerNames: string[];
  asn?: number | null;
  ja4?: string | null;
};

export function buildServerSignals(input: RequestSignalInput): ServerSignals {
  const headerOrderHash = createHash('sha256')
    .update(input.headerNames.join(','), 'utf8')
    .digest('hex')
    .slice(0, 32);

  const signals: ServerSignals = {
    ipHash: hashIp(input.ip, input.pepper),
    ip24Hash: hashIp24(input.ip, input.pepper),
    acceptLanguage: input.acceptLanguage,
    headerOrderHash,
    userAgent: input.userAgent,
  };

  if (input.asn !== undefined) {
    signals.asn = input.asn;
  }
  if (input.ja4 !== undefined) {
    signals.ja4 = input.ja4;
  }
  return signals;
}

/** Extract client IP from common proxy headers (first hop). */
export function clientIpFromHeaders(
  headers: Headers | Record<string, string | undefined>,
  fallback = '127.0.0.1',
): string {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name) ?? undefined;
    }
    return headers[name] ?? headers[name.toLowerCase()];
  };
  const xff = get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = get('x-real-ip');
  if (realIp) return realIp.trim();
  return fallback;
}

export function headerNamesInOrder(
  headers: Headers | Array<[string, string]>,
): string[] {
  if (Array.isArray(headers)) {
    return headers.map(([k]) => k.toLowerCase());
  }
  const names: string[] = [];
  headers.forEach((_v, k) => names.push(k.toLowerCase()));
  return names;
}
