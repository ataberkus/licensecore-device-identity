import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Must match playwright.config webServer env. */
export const E2E_DB_PATH = path.resolve(root, 'data/e2e-device-identity.sqlite');
export const ADMIN_API_KEY = 'test-admin-api-key';

export function openE2eDb(): Database.Database {
  if (!fs.existsSync(E2E_DB_PATH)) {
    throw new Error(`E2E sqlite missing: ${E2E_DB_PATH}`);
  }
  return new Database(E2E_DB_PATH, { readonly: false, fileMustExist: true });
}

export function truncateDeviceTables(): void {
  if (!fs.existsSync(E2E_DB_PATH)) {
    throw new Error(`E2E sqlite missing: ${E2E_DB_PATH}`);
  }
  const db = openE2eDb();
  try {
    db.exec(`
      DELETE FROM device_events;
      DELETE FROM device_evidence;
      DELETE FROM device_anchors;
      DELETE FROM device_links;
      DELETE FROM devices;
    `);
  } finally {
    db.close();
  }
}

/** Wait until the e2e server has created/migrated the sqlite file. */
export async function waitForE2eDb(timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(E2E_DB_PATH)) {
      try {
        truncateDeviceTables();
        return;
      } catch {
        /* schema may still be migrating */
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for E2E sqlite at ${E2E_DB_PATH}`);
}

export function countEvents(deviceId: string, type: string): number {
  const db = openE2eDb();
  try {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM device_events WHERE device_id = ? AND type = ?`,
      )
      .get(deviceId, type) as { n: number };
    return row.n;
  } finally {
    db.close();
  }
}

export function listEventTypes(deviceId: string): string[] {
  const db = openE2eDb();
  try {
    const rows = db
      .prepare(
        `SELECT type FROM device_events WHERE device_id = ? ORDER BY id ASC`,
      )
      .all(deviceId) as Array<{ type: string }>;
    return rows.map((r) => r.type);
  } finally {
    db.close();
  }
}
