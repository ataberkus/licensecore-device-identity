import { Hono } from 'hono';
import type { ServerEnv } from './env.js';
import { loadEnv, testEnv } from './env.js';
import { createDb } from './db/index.js';
import {
  createStore,
  createStoreAsync,
  MemoryDeviceStore,
} from './db/migrate.js';
import type { DeviceStore } from './db/store.js';
import type { AppDeps, AppVariables } from './app-types.js';
import {
  createDeviceRateLimiters,
  type DeviceRateLimiters,
} from './rate-limit.js';
import { NonceStore } from './resolve/nonce.js';
import { challengeRoutes } from './routes/challenge.js';
import { resolveRoutes } from './routes/resolve.js';
import { reverifyRoutes } from './routes/reverify.js';
import { evidenceRoutes } from './routes/evidence.js';
import { clientIpFromHeaders } from './signals/server-signals.js';

export type CreateAppOptions = {
  env?: ServerEnv;
  store?: DeviceStore;
  nonces?: NonceStore;
  rateLimits?: DeviceRateLimiters;
  /** When true and no store provided, use MemoryDeviceStore (tests). */
  memory?: boolean;
};

function buildApp(deps: AppDeps): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    c.set('clientIp', clientIpFromHeaders(c.req.raw.headers));
    await next();
  });

  app.route('/', challengeRoutes());
  app.route('/', resolveRoutes());
  app.route('/', reverifyRoutes());
  app.route('/', evidenceRoutes());

  app.get('/health', (c) => c.json({ ok: true }));

  return app;
}

/**
 * Runtime-agnostic Hono app factory for device-identity APIs.
 * Sync path: memory, injected store, or sqlite.
 */
export function createApp(opts: CreateAppOptions = {}): Hono<{
  Variables: AppVariables;
}> {
  const env = opts.env ?? loadEnv();
  const nonces = opts.nonces ?? new NonceStore();
  const rateLimits = opts.rateLimits ?? createDeviceRateLimiters();

  let store = opts.store;
  if (!store) {
    if (opts.memory || env.databaseUrl === ':memory:') {
      store = new MemoryDeviceStore();
    } else if (env.databaseDialect === 'postgres') {
      throw new Error(
        'createApp() cannot open postgres synchronously; use createAppAsync()',
      );
    } else {
      const db = createDb(env);
      store = createStore(db);
    }
  }

  return buildApp({ env, store, nonces, rateLimits });
}

/** Async factory — required for postgres migrations. */
export async function createAppAsync(
  opts: CreateAppOptions = {},
): Promise<Hono<{ Variables: AppVariables }>> {
  const env = opts.env ?? loadEnv();
  const nonces = opts.nonces ?? new NonceStore();
  const rateLimits = opts.rateLimits ?? createDeviceRateLimiters();

  let store = opts.store;
  if (!store) {
    if (opts.memory || env.databaseUrl === ':memory:') {
      store = new MemoryDeviceStore();
    } else {
      const db = createDb(env);
      store = await createStoreAsync(db);
    }
  }

  return buildApp({ env, store, nonces, rateLimits });
}

export { loadEnv, testEnv };
export type { ServerEnv } from './env.js';
export { MemoryDeviceStore };
export { NonceStore };
export { runResolve } from './resolve/algorithm.js';
export type { AppDeps, AppVariables };
export type { DeviceStore };
