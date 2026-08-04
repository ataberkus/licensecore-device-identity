/**
 * In-memory sliding-window rate limiter (phase 1).
 * Same interface can later wrap Redis.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, nowMs: number = Date.now()): RateLimitResult {
    const cutoff = nowMs - this.windowMs;
    const prev = this.hits.get(key) ?? [];
    const recent = prev.filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      const oldest = recent[0]!;
      this.hits.set(key, recent);
      return { ok: false, retryAfterMs: Math.max(0, oldest + this.windowMs - nowMs) };
    }
    recent.push(nowMs);
    this.hits.set(key, recent);
    return { ok: true };
  }
}

export type DeviceRateLimiters = {
  /** Per-IP resolve/challenge. */
  perIp: SlidingWindowRateLimiter;
  /** Per-anchor keyId. */
  perAnchor: SlidingWindowRateLimiter;
  /** Enrollment (unknown key / tier3) — throttled hardest. */
  enrollIp: SlidingWindowRateLimiter;
};

export function createDeviceRateLimiters(opts?: {
  /** Relaxed limits for e2e / local acceptance matrix. */
  relaxed?: boolean;
}): DeviceRateLimiters {
  if (opts?.relaxed || process.env['E2E_RELAX_RATE_LIMIT'] === '1') {
    return {
      perIp: new SlidingWindowRateLimiter(10_000, 60_000),
      perAnchor: new SlidingWindowRateLimiter(10_000, 60_000),
      enrollIp: new SlidingWindowRateLimiter(10_000, 60_000),
    };
  }
  return {
    perIp: new SlidingWindowRateLimiter(60, 60_000),
    perAnchor: new SlidingWindowRateLimiter(30, 60_000),
    enrollIp: new SlidingWindowRateLimiter(10, 60_000),
  };
}
