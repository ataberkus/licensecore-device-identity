import type { ServerEnv } from './env.js';
import type { DeviceStore } from './db/store.js';
import type { NonceStore } from './resolve/nonce.js';
import type { DeviceRateLimiters } from './rate-limit.js';

export type AppDeps = {
  env: ServerEnv;
  store: DeviceStore;
  nonces: NonceStore;
  rateLimits: DeviceRateLimiters;
};

export type AppVariables = {
  deps: AppDeps;
  clientIp: string;
};
