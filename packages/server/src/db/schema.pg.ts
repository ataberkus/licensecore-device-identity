/**
 * Postgres 16 schema mirror of `schema.ts`.
 * Used by drizzle-kit pg config / prod path.
 *
 * Phase-2 placeholders (comments only — do NOT create):
 * // license_seats — seat ↔ device bindings
 * // products — product catalog
 * // users — account identities
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  ComponentHashes,
  Confidence,
  DeviceEventType,
  EvidenceProfile,
  IntegrityReport,
  ServerSignals,
} from '@licensecore/shared';

export const devices = pgTable('devices', {
  id: text('id').primaryKey(),
  confidence: text('confidence').$type<Confidence>().notNull(),
  spoofScore: integer('spoof_score').notNull().default(0),
  hardwareBacked: boolean('hardware_backed').notNull().default(false),
  needsReview: boolean('needs_review').notNull().default(false),
  retiredAt: timestamp('retired_at', { withTimezone: true, mode: 'string' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .default(sql`now()`),
});

export const deviceAnchors = pgTable(
  'device_anchors',
  {
    id: serial('id').primaryKey(),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    tier: integer('tier').notNull(),
    keyId: text('key_id').notNull(),
    publicKeySpki: text('public_key_spki'),
    aaguid: text('aaguid'),
    beFlag: boolean('be_flag'),
    bsFlag: boolean('bs_flag'),
    signCount: integer('sign_count').notNull().default(0),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex('device_anchors_key_id_uidx').on(t.keyId)],
);

export const deviceEvidence = pgTable(
  'device_evidence',
  {
    id: serial('id').primaryKey(),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    revision: integer('revision').notNull(),
    /** Evidence profile; legacy rows without value are coerced to `full`. */
    profile: text('profile').$type<EvidenceProfile>().notNull().default('full'),
    stableHash: text('stable_hash').notNull(),
    stableHashPrefix: text('stable_hash_prefix').notNull(),
    volatileHash: text('volatile_hash').notNull(),
    componentHashes: jsonb('component_hashes').$type<ComponentHashes>().notNull(),
    integrity: jsonb('integrity').$type<IntegrityReport>().notNull(),
    serverSignals: jsonb('server_signals').$type<ServerSignals>().notNull(),
    asn: integer('asn'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
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

export const deviceEvents = pgTable(
  'device_events',
  {
    id: serial('id').primaryKey(),
    deviceId: text('device_id').references(() => devices.id),
    type: text('type').$type<DeviceEventType>().notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('device_events_device_created_idx').on(t.deviceId, t.createdAt),
    index('device_events_type_created_idx').on(t.type, t.createdAt),
  ],
);

export const deviceLinks = pgTable(
  'device_links',
  {
    id: serial('id').primaryKey(),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    relatedDeviceId: text('related_device_id')
      .notNull()
      .references(() => devices.id),
    relation: text('relation').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('device_links_device_idx').on(t.deviceId)],
);
