import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { ServerEnv } from '../env.js';
import * as sqliteSchema from './schema.js';
import * as pgSchema from './schema.pg.js';

export type SqliteDb = ReturnType<typeof drizzleSqlite<typeof sqliteSchema>>;
export type PgSql = ReturnType<typeof postgres>;
export type PgDb = ReturnType<typeof drizzlePg<typeof pgSchema>>;

export type AppDb =
  | { dialect: 'sqlite'; db: SqliteDb; sqlite: Database.Database }
  | { dialect: 'postgres'; db: PgDb; sql: PgSql };

/**
 * Open a Drizzle client for sqlite (local) or postgres 16 (CI/prod).
 */
export function createDb(env: ServerEnv): AppDb {
  if (env.databaseDialect === 'postgres') {
    const sql = postgres(env.databaseUrl, { max: 10 });
    const db = drizzlePg(sql, { schema: pgSchema });
    return { dialect: 'postgres', db, sql };
  }

  const path = env.databaseUrl.startsWith('file:')
    ? env.databaseUrl.slice('file:'.length)
    : env.databaseUrl;
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzleSqlite(sqlite, { schema: sqliteSchema });
  return { dialect: 'sqlite', db, sqlite };
}

export { sqliteSchema as schema, pgSchema };
