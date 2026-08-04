import { Hono } from 'hono';
import {
  ResolveRequestSchema,
  type ErrorResponse,
} from '@licensecore/shared';
import type { AppVariables } from '../app-types.js';
import { runResolve } from '../resolve/algorithm.js';
import {
  buildServerSignals,
  headerNamesInOrder,
} from '../signals/server-signals.js';

export function resolveRoutes(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  app.post('/v1/device/resolve', async (c) => {
    const deps = c.get('deps');
    const ip = c.get('clientIp');

    const ipLimit = deps.rateLimits.perIp.check(`resolve:${ip}`);
    if (!ipLimit.ok) {
      const body: ErrorResponse = {
        error: { code: 'RATE_LIMITED', message: 'too many resolve requests' },
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

    const parsed = ResolveRequestSchema.safeParse(json);
    if (!parsed.success) {
      const body: ErrorResponse = {
        error: { code: 'PAYLOAD_INVALID', message: parsed.error.message },
      };
      return c.json(body, 400);
    }

    const req = parsed.data;
    if (req.anchor) {
      const anchorLimit = deps.rateLimits.perAnchor.check(
        `anchor:${req.anchor.keyId}`,
      );
      if (!anchorLimit.ok) {
        const body: ErrorResponse = {
          error: { code: 'RATE_LIMITED', message: 'anchor rate limited' },
        };
        return c.json(body, 429);
      }
    } else {
      const enrollLimit = deps.rateLimits.enrollIp.check(`enroll:${ip}`);
      if (!enrollLimit.ok) {
        const body: ErrorResponse = {
          error: {
            code: 'RATE_LIMITED',
            message: 'enrollment rate limited',
          },
        };
        return c.json(body, 429);
      }
    }

    const asnHeader = c.req.header('x-asn');
    const asnParsed = asnHeader ? Number.parseInt(asnHeader, 10) : undefined;
    // Private-use ASN fallback when upstream does not provide one — keeps
    // candidate search (ASN OR stableHash-prefix) usable on localhost / e2e
    // where timing noise would otherwise miss the prefix bucket (T4).
    const asn =
      asnParsed !== undefined && !Number.isNaN(asnParsed) ? asnParsed : 64512;
    const ja4 = c.req.header('x-ja4') ?? undefined;

    const serverSignals = buildServerSignals({
      ip,
      pepper: deps.env.ipPepper,
      acceptLanguage: c.req.header('accept-language') ?? '',
      userAgent: c.req.header('user-agent') ?? '',
      headerNames: headerNamesInOrder(c.req.raw.headers),
      asn,
      ja4: ja4 ?? null,
    });

    // Unknown key enroll also throttled
    if (req.anchor) {
      const known = await deps.store.findAnchorByKeyId(req.anchor.keyId);
      if (!known) {
        const enrollLimit = deps.rateLimits.enrollIp.check(`enroll:${ip}`);
        if (!enrollLimit.ok) {
          const body: ErrorResponse = {
            error: {
              code: 'RATE_LIMITED',
              message: 'enrollment rate limited',
            },
          };
          return c.json(body, 429);
        }
      }
    }

    const result = await runResolve(req, serverSignals, {
      store: deps.store,
      nonces: deps.nonces,
      jwtSecret: deps.env.jwtSecret,
    });

    if (!result.ok) {
      const body: ErrorResponse = {
        error: { code: result.code, message: result.message },
      };
      return c.json(body, result.status);
    }

    return c.json(result.response, 200);
  });

  return app;
}
