import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppDb } from './index.js';
import { MemoryDeviceStore } from './memory-store.js';
import { PostgresDeviceStore } from './pg-store.js';
import { SqliteDeviceStore } from './sqlite-store.js';
import type { DeviceStore } from './store.js';

const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY NOT NULL,
  confidence TEXT NOT NULL,
  spoof_score INTEGER NOT NULL DEFAULT 0,
  hardware_backed INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  retired_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS device_anchors (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  tier INTEGER NOT NULL,
  key_id TEXT NOT NULL,
  public_key_spki TEXT,
  aaguid TEXT,
  be_flag INTEGER,
  bs_flag INTEGER,
  sign_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS device_anchors_key_id_uidx ON device_anchors(key_id);

CREATE TABLE IF NOT EXISTS device_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  revision INTEGER NOT NULL,
  profile TEXT NOT NULL DEFAULT 'full',
  stable_hash TEXT NOT NULL,
  stable_hash_prefix TEXT NOT NULL,
  volatile_hash TEXT NOT NULL,
  component_hashes TEXT NOT NULL,
  integrity TEXT NOT NULL,
  server_signals TEXT NOT NULL,
  asn INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS device_evidence_asn_created_idx ON device_evidence(asn, created_at);
CREATE INDEX IF NOT EXISTS device_evidence_prefix_created_idx ON device_evidence(stable_hash_prefix, created_at);
CREATE INDEX IF NOT EXISTS device_evidence_device_rev_idx ON device_evidence(device_id, revision);

CREATE TABLE IF NOT EXISTS device_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  device_id TEXT REFERENCES devices(id),
  type TEXT NOT NULL,
  payload TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS device_events_device_created_idx ON device_events(device_id, created_at);
CREATE INDEX IF NOT EXISTS device_events_type_created_idx ON device_events(type, created_at);

CREATE TABLE IF NOT EXISTS device_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  related_device_id TEXT NOT NULL REFERENCES devices(id),
  relation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS device_links_device_idx ON device_links(device_id);
`;

function repoMigrationsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', '..', '..', 'drizzle', 'migrations');
}

export function migrateSqlite(app: Extract<AppDb, { dialect: 'sqlite' }>): void {
  app.sqlite.exec(SQLITE_DDL);
  ensureSqliteEvidenceProfileColumn(app.sqlite);
}

function ensureSqliteEvidenceProfileColumn(sqlite: {
  prepare: (sql: string) => { all: () => unknown[] };
  exec: (sql: string) => void;
}): void {
  const cols = sqlite.prepare(`PRAGMA table_info(device_evidence)`).all() as Array<{
    name: string;
  }>;
  if (!cols.some((c) => c.name === 'profile')) {
    sqlite.exec(
      `ALTER TABLE device_evidence ADD COLUMN profile TEXT NOT NULL DEFAULT 'full'`,
    );
  }
}

export async function migratePostgres(
  app: Extract<AppDb, { dialect: 'postgres' }>,
  sqlText?: string,
): Promise<void> {
  const text =
    sqlText ??
    readFileSync(
      join(repoMigrationsDir(), 'postgres', '0000_init.sql'),
      'utf8',
    );
  await app.sql.unsafe(text);
  await app.sql.unsafe(
    `ALTER TABLE device_evidence ADD COLUMN IF NOT EXISTS profile TEXT NOT NULL DEFAULT 'full'`,
  );
}

/** Sync store factory (sqlite / memory). Prefer createStoreAsync for postgres. */
export function createStore(app: AppDb): DeviceStore {
  if (app.dialect === 'sqlite') {
    migrateSqlite(app);
    return new SqliteDeviceStore(app);
  }
  throw new Error(
    'Postgres requires createStoreAsync() so migrations can run',
  );
}

export async function createStoreAsync(app: AppDb): Promise<DeviceStore> {
  if (app.dialect === 'sqlite') {
    return createStore(app);
  }
  await migratePostgres(app);
  return new PostgresDeviceStore(app);
}

export { MemoryDeviceStore, SqliteDeviceStore, PostgresDeviceStore };
