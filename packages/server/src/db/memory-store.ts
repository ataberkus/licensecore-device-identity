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

/**
 * In-memory DeviceStore for unit tests and ephemeral local runs.
 */
export class MemoryDeviceStore implements DeviceStore {
  devices = new Map<string, DeviceRecord>();
  anchors = new Map<string, AnchorRecord>();
  evidence: EvidenceRecord[] = [];
  events: InsertEvent[] = [];
  links: Array<{
    deviceId: string;
    relatedDeviceId: string;
    relation: string;
  }> = [];
  private anchorSeq = 1;
  private evidenceSeq = 1;

  async findAnchorByKeyId(keyId: string): Promise<AnchorRecord | null> {
    const a = this.anchors.get(keyId);
    if (!a || a.revokedAt) return null;
    return a;
  }

  async findDeviceById(id: string): Promise<DeviceRecord | null> {
    return this.devices.get(id) ?? null;
  }

  async latestEvidence(deviceId: string): Promise<EvidenceRecord | null> {
    const rows = this.evidence
      .filter((e) => e.deviceId === deviceId)
      .sort((a, b) => b.revision - a.revision);
    return rows[0] ?? null;
  }

  async findCandidates(opts: {
    asn: number | null | undefined;
    stableHash: string;
    nowMs?: number;
  }): Promise<CandidateEvidence[]> {
    const cutoff = lookbackCutoffIso(opts.nowMs);
    const prefix = stableHashPrefix(opts.stableHash);
    const latestByDevice = new Map<string, EvidenceRecord>();

    for (const e of this.evidence) {
      if (e.createdAt < cutoff) continue;
      const asnMatch =
        opts.asn != null && e.asn != null && e.asn === opts.asn;
      const prefixMatch = e.stableHashPrefix === prefix;
      if (!asnMatch && !prefixMatch) continue;
      const prev = latestByDevice.get(e.deviceId);
      if (!prev || e.revision > prev.revision) {
        latestByDevice.set(e.deviceId, e);
      }
    }

    const out: CandidateEvidence[] = [];
    for (const e of latestByDevice.values()) {
      const device = this.devices.get(e.deviceId);
      if (!device || device.retiredAt) continue;
      out.push({ ...e, device });
    }
    return out;
  }

  async insertDevice(row: InsertDevice): Promise<DeviceRecord> {
    const ts = nowIso();
    const rec: DeviceRecord = {
      id: row.id,
      confidence: row.confidence,
      spoofScore: row.spoofScore,
      hardwareBacked: row.hardwareBacked,
      needsReview: row.needsReview,
      retiredAt: null,
      notes: row.notes ?? null,
      createdAt: ts,
      updatedAt: ts,
      lastSeenAt: ts,
    };
    this.devices.set(rec.id, rec);
    return rec;
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
    const cur = this.devices.get(id);
    if (!cur) throw new Error(`device not found: ${id}`);
    this.devices.set(id, { ...cur, ...patch, updatedAt: patch.updatedAt ?? nowIso() });
  }

  async insertAnchor(row: InsertAnchor): Promise<AnchorRecord> {
    const rec: AnchorRecord = {
      id: this.anchorSeq++,
      deviceId: row.deviceId,
      tier: row.tier,
      keyId: row.keyId,
      publicKeySpki: row.publicKeySpki ?? null,
      aaguid: row.aaguid ?? null,
      beFlag: row.beFlag ?? null,
      bsFlag: row.bsFlag ?? null,
      signCount: row.signCount ?? 0,
      revokedAt: null,
      createdAt: nowIso(),
    };
    this.anchors.set(rec.keyId, rec);
    return rec;
  }

  async updateAnchorSignCount(keyId: string, signCount: number): Promise<void> {
    const a = this.anchors.get(keyId);
    if (!a) return;
    this.anchors.set(keyId, { ...a, signCount });
  }

  async nextEvidenceRevision(deviceId: string): Promise<number> {
    const latest = await this.latestEvidence(deviceId);
    return latest ? latest.revision + 1 : 1;
  }

  async insertEvidence(row: InsertEvidence): Promise<EvidenceRecord> {
    const asn =
      row.serverSignals.asn === undefined ? null : row.serverSignals.asn;
    const rec: EvidenceRecord = {
      id: this.evidenceSeq++,
      deviceId: row.deviceId,
      revision: row.revision,
      stableHash: row.stableHash,
      stableHashPrefix: stableHashPrefix(row.stableHash),
      volatileHash: row.volatileHash,
      componentHashes: row.componentHashes,
      integrity: row.integrity,
      serverSignals: row.serverSignals,
      asn,
      createdAt: nowIso(),
    };
    this.evidence.push(rec);
    return rec;
  }

  async insertEvent(row: InsertEvent): Promise<void> {
    this.events.push(row);
  }

  async insertLink(opts: {
    deviceId: string;
    relatedDeviceId: string;
    relation: string;
  }): Promise<void> {
    this.links.push(opts);
  }

  async listEvidence(deviceId: string): Promise<EvidenceRecord[]> {
    return this.evidence
      .filter((e) => e.deviceId === deviceId)
      .sort((a, b) => a.revision - b.revision);
  }
}
