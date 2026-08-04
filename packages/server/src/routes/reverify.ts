import { Hono } from 'hono';
import {
  ReverifyRequestSchema,
  type ErrorResponse,
  type ReverifyResponse,
} from '@licensecore/shared';
import type { AppVariables } from '../app-types.js';
import { mintDeviceToken } from '../crypto/jwt.js';
import { signatureMessage, verifyEcdsaP1363 } from '../resolve/verify-anchor.js';

export function reverifyRoutes(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  app.post('/v1/device/reverify', async (c) => {
    const deps = c.get('deps');
    const ip = c.get('clientIp');

    const ipLimit = deps.rateLimits.perIp.check(`reverify:${ip}`);
    if (!ipLimit.ok) {
      const body: ErrorResponse = {
        error: { code: 'RATE_LIMITED', message: 'too many reverify requests' },
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

    const parsed = ReverifyRequestSchema.safeParse(json);
    if (!parsed.success) {
      const body: ErrorResponse = {
        error: { code: 'PAYLOAD_INVALID', message: parsed.error.message },
      };
      return c.json(body, 400);
    }

    const req = parsed.data;
    const nonceResult = deps.nonces.consume(req.nonce, req.origin);
    if (!nonceResult.ok) {
      const body: ErrorResponse = {
        error: {
          code: nonceResult.error.code,
          message: nonceResult.error.message,
        },
      };
      return c.json(body, 400);
    }

    const anchor = await deps.store.findAnchorByKeyId(req.keyId);
    if (!anchor || !anchor.publicKeySpki) {
      const body: ErrorResponse = {
        error: { code: 'UNAUTHORIZED', message: 'unknown keyId' },
      };
      return c.json(body, 401);
    }

    const latest = await deps.store.latestEvidence(anchor.deviceId);
    const stableHash = latest?.stableHash ?? '';
    const message = signatureMessage({
      nonce: req.nonce,
      origin: req.origin,
      stableHash,
      keyId: req.keyId,
    });
    const ok = verifyEcdsaP1363({
      publicKeySpkiB64url: anchor.publicKeySpki,
      message,
      signatureB64url: req.signature,
    });
    if (!ok) {
      const body: ErrorResponse = {
        error: { code: 'SIGNATURE_INVALID', message: 'reverify signature failed' },
      };
      return c.json(body, 401);
    }

    const { token, expiresAt } = await mintDeviceToken({
      deviceId: anchor.deviceId,
      jkt: req.keyId,
      secret: deps.env.jwtSecret,
    });

    const response: ReverifyResponse = {
      deviceToken: token,
      deviceId: anchor.deviceId,
      expiresAt,
    };
    return c.json(response, 200);
  });

  return app;
}
