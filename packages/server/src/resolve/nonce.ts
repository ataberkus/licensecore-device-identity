import { randomBytes } from 'node:crypto';
import { NONCE_TTL_MS } from '@licensecore/shared';
import type { ErrorCode } from '@licensecore/shared';

export type NonceRecord = {
  nonce: string;
  origin: string;
  expiresAt: number;
  used: boolean;
};

export type NonceError = {
  code: Extract<
    ErrorCode,
    'NONCE_INVALID' | 'NONCE_EXPIRED' | 'NONCE_REPLAY' | 'ORIGIN_MISMATCH'
  >;
  message: string;
};

/**
 * In-memory single-use, origin-bound nonces (60s TTL).
 */
export class NonceStore {
  private readonly map = new Map<string, NonceRecord>();

  issue(origin: string, nowMs: number = Date.now()): {
    nonce: string;
    expiresAt: number;
    serverTimeMs: number;
  } {
    this.gc(nowMs);
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = nowMs + NONCE_TTL_MS;
    this.map.set(nonce, { nonce, origin, expiresAt, used: false });
    return { nonce, expiresAt, serverTimeMs: nowMs };
  }

  /**
   * Validate and burn nonce. On failure, burns if present (per plan step 1).
   */
  consume(
    nonce: string,
    origin: string,
    nowMs: number = Date.now(),
  ): { ok: true } | { ok: false; error: NonceError } {
    const rec = this.map.get(nonce);
    if (!rec) {
      return {
        ok: false,
        error: { code: 'NONCE_INVALID', message: 'nonce unknown' },
      };
    }
    // Burn on any failed consume attempt once looked up.
    if (rec.used) {
      return {
        ok: false,
        error: { code: 'NONCE_REPLAY', message: 'nonce already used' },
      };
    }
    if (nowMs > rec.expiresAt) {
      rec.used = true;
      this.map.set(nonce, rec);
      return {
        ok: false,
        error: { code: 'NONCE_EXPIRED', message: 'nonce expired' },
      };
    }
    if (rec.origin !== origin) {
      rec.used = true;
      this.map.set(nonce, rec);
      return {
        ok: false,
        error: { code: 'ORIGIN_MISMATCH', message: 'nonce origin mismatch' },
      };
    }
    rec.used = true;
    this.map.set(nonce, rec);
    return { ok: true };
  }

  /** Test helper — inspect without consuming. */
  peek(nonce: string): NonceRecord | undefined {
    return this.map.get(nonce);
  }

  private gc(nowMs: number): void {
    for (const [k, v] of this.map) {
      if (nowMs > v.expiresAt + 60_000) this.map.delete(k);
    }
  }
}
