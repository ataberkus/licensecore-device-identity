import { Hono } from 'hono';
import {
  ChallengeRequestSchema,
  type ChallengeResponse,
  type ErrorResponse,
} from '@licensecore/shared';
import type { AppVariables } from '../app-types.js';

export function challengeRoutes(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  app.post('/v1/device/challenge', async (c) => {
    const deps = c.get('deps');
    const ip = c.get('clientIp');

    const ipLimit = deps.rateLimits.perIp.check(`challenge:${ip}`);
    if (!ipLimit.ok) {
      const body: ErrorResponse = {
        error: { code: 'RATE_LIMITED', message: 'too many challenges' },
      };
      return c.json(body, 429);
    }

    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      const body: ErrorResponse = {
        error: { code: 'PAYLOAD_INVALID', message: 'invalid JSON' },
      };
      return c.json(body, 400);
    }

    const parsed = ChallengeRequestSchema.safeParse(json);
    if (!parsed.success) {
      const body: ErrorResponse = {
        error: { code: 'PAYLOAD_INVALID', message: parsed.error.message },
      };
      return c.json(body, 400);
    }

    const headerOrigin = c.req.header('origin');
    const origin = headerOrigin ?? parsed.data.origin;
    if (headerOrigin && headerOrigin !== parsed.data.origin) {
      const body: ErrorResponse = {
        error: {
          code: 'ORIGIN_MISMATCH',
          message: 'Origin header does not match body.origin',
        },
      };
      return c.json(body, 400);
    }

    const issued = deps.nonces.issue(origin);
    const response: ChallengeResponse = {
      nonce: issued.nonce,
      expiresAt: issued.expiresAt,
      serverTimeMs: issued.serverTimeMs,
    };
    return c.json(response, 200);
  });

  return app;
}
