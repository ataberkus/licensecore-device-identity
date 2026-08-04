/**
 * Server environment. Runtime-agnostic — callers inject values (Node process.env, Workers bindings, etc.).
 */

export type ServerEnv = {
  /** HMAC pepper for IP hashing — never store raw IPs. */
  ipPepper: string;
  /** HS256 secret for deviceToken JWTs. */
  jwtSecret: string;
  /** Admin Bearer token for GET /v1/device/:id/evidence. */
  adminApiKey: string;
  /** sqlite path or postgres connection string. */
  databaseUrl: string;
  /** 'sqlite' | 'postgres' */
  databaseDialect: 'sqlite' | 'postgres';
  /** Optional RP ID for WebAuthn (hostname). Defaults from request origin. */
  webauthnRpId?: string;
};

export function loadEnv(
  source: Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {},
): ServerEnv {
  const dialect =
    source['DATABASE_DIALECT'] === 'postgres' ? 'postgres' : 'sqlite';
  const databaseUrl =
    source['DATABASE_URL'] ??
    (dialect === 'sqlite' ? 'file:./data/device-identity.sqlite' : '');

  const ipPepper = source['IP_PEPPER'] ?? '';
  const jwtSecret = source['JWT_SECRET'] ?? '';
  const adminApiKey = source['ADMIN_API_KEY'] ?? '';

  if (!ipPepper) throw new Error('IP_PEPPER is required');
  if (!jwtSecret) throw new Error('JWT_SECRET is required');
  if (!adminApiKey) throw new Error('ADMIN_API_KEY is required');
  if (dialect === 'postgres' && !databaseUrl) {
    throw new Error('DATABASE_URL is required for postgres');
  }

  const env: ServerEnv = {
    ipPepper,
    jwtSecret,
    adminApiKey,
    databaseUrl,
    databaseDialect: dialect,
  };
  if (source['WEBAUTHN_RP_ID']) {
    env.webauthnRpId = source['WEBAUTHN_RP_ID'];
  }
  return env;
}

/** Dev/test helper with deterministic secrets. */
export function testEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    ipPepper: 'test-ip-pepper-32bytes-minimum!!',
    jwtSecret: 'test-jwt-secret-32bytes-minimum!!!',
    adminApiKey: 'test-admin-api-key',
    databaseUrl: ':memory:',
    databaseDialect: 'sqlite',
    ...overrides,
  };
}
