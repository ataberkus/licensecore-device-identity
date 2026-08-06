import { Hono } from 'hono';
import type { ErrorResponse, EvidenceRevision } from '@licensecore/shared';
import type { AppVariables } from '../app-types.js';

export function evidenceRoutes(): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  app.get('/v1/device/:id/evidence', async (c) => {
    const deps = c.get('deps');
    const auth = c.req.header('authorization') ?? '';
    const expected = `Bearer ${deps.env.adminApiKey}`;
    if (auth !== expected) {
      const body: ErrorResponse = {
        error: { code: 'UNAUTHORIZED', message: 'admin bearer required' },
      };
      return c.json(body, 401);
    }

    const id = c.req.param('id');
    const device = await deps.store.findDeviceById(id);
    if (!device) {
      const body: ErrorResponse = {
        error: { code: 'PAYLOAD_INVALID', message: 'device not found' },
      };
      return c.json(body, 404);
    }

    const rows = await deps.store.listEvidence(id);
    const revisions: EvidenceRevision[] = rows.map((r) => ({
      revision: r.revision,
      profile: r.profile,
      stableHash: r.stableHash,
      volatileHash: r.volatileHash,
      componentHashes: r.componentHashes,
      integrity: r.integrity,
      serverSignals: r.serverSignals,
      createdAt: r.createdAt,
    }));

    return c.json({ deviceId: id, revisions }, 200);
  });

  return app;
}
