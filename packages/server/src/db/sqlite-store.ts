import { and, desc, eq, gte, or, sql } from 'drizzle-orm';
import type { AppDb } from './index.js';
import {
  deviceAnchors,
  deviceEvidence,
  deviceEvents,
  deviceLinks,
  devices,
} from './schema.js';
import type {
  AnchorRecord,
  CandidateEvidence,
  DeviceRecord,
  DeviceStore,
  EvidenceRecord,
  InsertAnchor,
  InsertDevice,
  InsertEvidence,
  InsertEvent,
} from './store.js';
import { lookbackCutoffIso, nowIso, stableHashPrefix } from './store.js';
import type { AnchorTier } from '@licensecore/shared';

/**
 * Drizzle-backed DeviceStore (SQLite path).
 * Postgres uses the same table/column names via schema.pg + SQL migrations;
 * wire a PgDeviceStore when dialect === 'postgres' if needed — phase 1
 * resolve algorithm tests use MemoryDeviceStore; sqlite is the local path.
 */
export class SqliteDeviceStore implements DeviceStore {
  constructor(private readonly app: Extract<AppDb, { dialect: 'sqlite' }>) {}

  private get db() {
    return this.app.db;
  }

  async findAnchorByKeyId(keyId: string): Promise<AnchorRecord | null> {
    const rows = await this.db
      .select()
      .from(deviceAnchors)
      .where(and(eq(deviceAnchors.keyId, keyId), sql`${deviceAnchors.revokedAt} IS NULL`))
      .limit(1);
    const r = rows[0];
    return r ? mapAnchor(r) : null;
  }

  async findDeviceById(id: string): Promise<DeviceRecord | null> {
    const rows = await this.db
      .select()
      .from(devices)
      .where(eq(devices.id, id))
      .limit(1);
    const r = rows[0];
    return r ? mapDevice(r) : null;
  }

  async latestEvidence(deviceId: string): Promise<EvidenceRecord | null> {
    const rows = await this.db
      .select()
      .from(deviceEvidence)
      .where(eq(deviceEvidence.deviceId, deviceId))
      .orderBy(desc(deviceEvidence.revision))
      .limit(1);
    const r = rows[0];
    return r ? mapEvidence(r) : null;
  }

  async findCandidates(opts: {
    asn: number | null | undefined;
    stableHash: string;
    nowMs?: number;
  }): Promise<CandidateEvidence[]> {
    const cutoff = lookbackCutoffIso(opts.nowMs);
    const prefix = stableHashPrefix(opts.stableHash);

    const asnCond =
      opts.asn != null
        ? eq(deviceEvidence.asn, opts.asn)
        : sql`0`;

    const rows = await this.db
      .select({
        evidence: deviceEvidence,
        device: devices,
      })
      .from(deviceEvidence)
      .innerJoin(devices, eq(deviceEvidence.deviceId, devices.id))
      .where(
        and(
          gte(deviceEvidence.createdAt, cutoff),
          sql`${devices.retiredAt} IS NULL`,
          or(eq(deviceEvidence.stableHashPrefix, prefix), asnCond),
        ),
      )
      .orderBy(desc(deviceEvidence.revision));

    const latest = new Map<string, CandidateEvidence>();
    for (const row of rows) {
      if (latest.has(row.device.id)) continue;
      latest.set(row.device.id, {
        ...mapEvidence(row.evidence),
        device: mapDevice(row.device),
      });
    }
    return [...latest.values()];
  }

  async insertDevice(row: InsertDevice): Promise<DeviceRecord> {
    const ts = nowIso();
    await this.db.insert(devices).values({
      id: row.id,
      confidence: row.confidence,
      spoofScore: row.spoofScore,
      hardwareBacked: row.hardwareBacked,
      needsReview: row.needsReview,
      notes: row.notes ?? null,
      createdAt: ts,
      updatedAt: ts,
      lastSeenAt: ts,
    });
    const d = await this.findDeviceById(row.id);
    if (!d) throw new Error('insert device failed');
    return d;
  }

  async updateDevice(
    id: string,
    patch: Partial<
      Pick<
        DeviceRecord,
        | 'confidence'
        | 'spoofScore'
        | 'hardwareBacked'
        | 'needsReview'
        | 'lastSeenAt'
        | 'updatedAt'
        | 'notes'
      >
    >,
  ): Promise<void> {
    await this.db
      .update(devices)
      .set({ ...patch, updatedAt: patch.updatedAt ?? nowIso() })
      .where(eq(devices.id, id));
  }

  async insertAnchor(row: InsertAnchor): Promise<AnchorRecord> {
    const result = await this.db
      .insert(deviceAnchors)
      .values({
        deviceId: row.deviceId,
        tier: row.tier,
        keyId: row.keyId,
        publicKeySpki: row.publicKeySpki ?? null,
        aaguid: row.aaguid ?? null,
        beFlag: row.beFlag ?? null,
        bsFlag: row.bsFlag ?? null,
        signCount: row.signCount ?? 0,
      })
      .returning();
    const r = result[0];
    if (!r) throw new Error('insert anchor failed');
    return mapAnchor(r);
  }

  async updateAnchorSignCount(keyId: string, signCount: number): Promise<void> {
    await this.db
      .update(deviceAnchors)
      .set({ signCount })
      .where(eq(deviceAnchors.keyId, keyId));
  }

  async nextEvidenceRevision(deviceId: string): Promise<number> {
    const latest = await this.latestEvidence(deviceId);
    return latest ? latest.revision + 1 : 1;
  }

  async insertEvidence(row: InsertEvidence): Promise<EvidenceRecord> {
    const asn =
      row.serverSignals.asn === undefined || row.serverSignals.asn === null
        ? null
        : row.serverSignals.asn;
    const result = await this.db
      .insert(deviceEvidence)
      .values({
        deviceId: row.deviceId,
        revision: row.revision,
        stableHash: row.stableHash,
        stableHashPrefix: stableHashPrefix(row.stableHash),
        volatileHash: row.volatileHash,
        componentHashes: row.componentHashes,
        integrity: row.integrity,
        serverSignals: row.serverSignals,
        asn,
      })
      .returning();
    const r = result[0];
    if (!r) throw new Error('insert evidence failed');
    return mapEvidence(r);
  }

  async insertEvent(row: InsertEvent): Promise<void> {
    await this.db.insert(deviceEvents).values({
      deviceId: row.deviceId ?? null,
      type: row.type,
      payload: row.payload ?? null,
      ipHash: row.ipHash ?? null,
    });
  }

  async insertLink(opts: {
    deviceId: string;
    relatedDeviceId: string;
    relation: string;
  }): Promise<void> {
    await this.db.insert(deviceLinks).values(opts);
  }

  async listEvidence(deviceId: string): Promise<EvidenceRecord[]> {
    const rows = await this.db
      .select()
      .from(deviceEvidence)
      .where(eq(deviceEvidence.deviceId, deviceId))
      .orderBy(deviceEvidence.revision);
    return rows.map(mapEvidence);
  }
}

function mapDevice(r: typeof devices.$inferSelect): DeviceRecord {
  return {
    id: r.id,
    confidence: r.confidence,
    spoofScore: r.spoofScore,
    hardwareBacked: r.hardwareBacked,
    needsReview: r.needsReview,
    retiredAt: r.retiredAt ?? null,
    notes: r.notes ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lastSeenAt: r.lastSeenAt,
  };
}

function mapAnchor(r: typeof deviceAnchors.$inferSelect): AnchorRecord {
  return {
    id: r.id,
    deviceId: r.deviceId,
    tier: r.tier as AnchorTier,
    keyId: r.keyId,
    publicKeySpki: r.publicKeySpki ?? null,
    aaguid: r.aaguid ?? null,
    beFlag: r.beFlag ?? null,
    bsFlag: r.bsFlag ?? null,
    signCount: r.signCount,
    revokedAt: r.revokedAt ?? null,
    createdAt: r.createdAt,
  };
}

function mapEvidence(r: typeof deviceEvidence.$inferSelect): EvidenceRecord {
  return {
    id: r.id,
    deviceId: r.deviceId,
    revision: r.revision,
    stableHash: r.stableHash,
    stableHashPrefix: r.stableHashPrefix,
    volatileHash: r.volatileHash,
    componentHashes: r.componentHashes,
    integrity: r.integrity,
    serverSignals: r.serverSignals,
    asn: r.asn ?? null,
    createdAt: r.createdAt,
  };
}
