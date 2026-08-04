/**
 * Local Node listener for `pnpm dev` (playground proxies /v1 here).
 * Uses env secrets when set; otherwise deterministic testEnv + on-disk sqlite.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp, loadEnv, testEnv, type ServerEnv } from './index.js';

const PORT = Number(process.env['PORT'] ?? 8787);
const here = dirname(fileURLToPath(import.meta.url));
const defaultDbPath = resolve(here, '../../../data/device-identity.sqlite');

function resolveEnv(): ServerEnv {
  try {
    return loadEnv();
  } catch {
    mkdirSync(dirname(defaultDbPath), { recursive: true });
    return testEnv({
      databaseUrl: `file:${defaultDbPath}`,
      databaseDialect: 'sqlite',
    });
  }
}

const env = resolveEnv();
const app = createApp({ env });

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[licensecore-server] http://127.0.0.1:${info.port}`);
  console.log(`[licensecore-server] health → /health`);
});
