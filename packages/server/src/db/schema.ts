/**
 * Drizzle schema — SQLite (local/dev) column types.
 * Postgres mirror: see `schema.pg.ts` + `drizzle/migrations/postgres`.
 *
 * Phase-2 placeholders (comments only — do NOT create):
 * // license_seats — seat ↔ device bindings
 * // products — product catalog
 * // users — account identities
 */

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import type {
  ComponentHashes,
  Confidence,
  DeviceEventType,
  IntegrityReport,
  ServerSignals,
} from '@licensecore/shared';

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(), // UUIDv7
  confidence: text('confidence').$type<Confidence>().notNull(),
  spoofScore: integer('spoof_score').notNull().default(0),
  hardwareBacked: integer('hardware_backed', { mode: 'boolean' })
    .notNull()
    .default(false),
  needsReview: integer('needs_review', { mode: 'boolean' })
    .notNull()
    .default(false),
  retiredAt: text('retired_at'),
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  lastSeenAt: text('last_seen_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export const deviceAnchors = sqliteTable(
  'device_anchors',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    tier: integer('tier').notNull(), // 1 | 2 | 3
    keyId: text('key_id').notNull(),
    publicKeySpki: text('public_key_spki'),
    aaguid: text('aaguid'),
    beFlag: integer('be_flag', { mode: 'boolean' }),
    bsFlag: integer('bs_flag', { mode: 'boolean' }),
    signCount: integer('sign_count').notNull().default(0),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [uniqueIndex('device_anchors_key_id_uidx').on(t.keyId)],
);

export const deviceEvidence = sqliteTable(
  'device_evidence',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    revision: integer('revision').notNull(),
    stableHash: text('stable_hash').notNull(),
    /** First 8 hex of stableHash — candidate bucket index. */
    stableHashPrefix: text('stable_hash_prefix').notNull(),
    volatileHash: text('volatile_hash').notNull(),
    componentHashes: text('component_hashes', { mode: 'json' })
      .$type<ComponentHashes>()
      .notNull(),
    integrity: text('integrity', { mode: 'json' })
      .$type<IntegrityReport>()
      .notNull(),
    serverSignals: text('server_signals', { mode: 'json' })
      .$type<ServerSignals>()
      .notNull(),
    /** Denormalized ASN for candidate search index. */
    asn: integer('asn'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [
    index('device_evidence_asn_created_idx').on(t.asn, t.createdAt),
    index('device_evidence_prefix_created_idx').on(
      t.stableHashPrefix,
      t.createdAt,
    ),
    index('device_evidence_device_rev_idx').on(t.deviceId, t.revision),
  ],
);

export const deviceEvents = sqliteTable(
  'device_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    deviceId: text('device_id').references(() => devices.id),
    type: text('type').$type<DeviceEventType>().notNull(),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
    ipHash: text('ip_hash'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [
    index('device_events_device_created_idx').on(t.deviceId, t.createdAt),
    index('device_events_type_created_idx').on(t.type, t.createdAt),
  ],
);

/** Ambiguous enroll links (possible_duplicate). */
export const deviceLinks = sqliteTable(
  'device_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    relatedDeviceId: text('related_device_id')
      .notNull()
      .references(() => devices.id),
    relation: text('relation').notNull(), // 'possible_duplicate'
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [index('device_links_device_idx').on(t.deviceId)],
);

export type DeviceRow = typeof devices.$inferSelect;
export type DeviceAnchorRow = typeof deviceAnchors.$inferSelect;
export type DeviceEvidenceRow = typeof deviceEvidence.$inferSelect;
export type DeviceEventRow = typeof deviceEvents.$inferSelect;
