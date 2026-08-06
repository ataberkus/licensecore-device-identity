/**
 * Dialect-agnostic device persistence used by the resolve algorithm.
 * Memory implementation powers unit tests; Drizzle backs sqlite/postgres.
 */

import type {
  AnchorTier,
  ComponentHashes,
  Confidence,
  DeviceEventType,
  EvidenceProfile,
  IntegrityReport,
  ServerSignals,
} from '@licensecore/shared';
import {
  CANDIDATE_LOOKBACK_DAYS,
  STABLE_HASH_BUCKET_PREFIX_LEN,
} from '@licensecore/shared';

export type AnchorRecord = {
  id: number;
  deviceId: string;
  tier: AnchorTier;
  keyId: string;
  publicKeySpki: string | null;
  aaguid: string | null;
  beFlag: boolean | null;
  bsFlag: boolean | null;
  signCount: number;
  revokedAt: string | null;
  createdAt: string;
};

export type EvidenceRecord = {
  id: number;
  deviceId: string;
  revision: number;
  /** Legacy rows without a stored profile are treated as `full`. */
  profile: EvidenceProfile;
  stableHash: string;
  stableHashPrefix: string;
  volatileHash: string;
  componentHashes: ComponentHashes;
  integrity: IntegrityReport;
  serverSignals: ServerSignals;
  asn: number | null;
  createdAt: string;
};

export type DeviceRecord = {
  id: string;
  confidence: Confidence;
  spoofScore: number;
  hardwareBacked: boolean;
  needsReview: boolean;
  retiredAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type InsertDevice = {
  id: string;
  confidence: Confidence;
  spoofScore: number;
  hardwareBacked: boolean;
  needsReview: boolean;
  notes?: string | null;
};

export type InsertAnchor = {
  deviceId: string;
  tier: AnchorTier;
  keyId: string;
  publicKeySpki?: string | null;
  aaguid?: string | null;
  beFlag?: boolean | null;
  bsFlag?: boolean | null;
  signCount?: number;
};

export type InsertEvidence = {
  deviceId: string;
  revision: number;
  profile: EvidenceProfile;
  stableHash: string;
  volatileHash: string;
  componentHashes: ComponentHashes;
  integrity: IntegrityReport;
  serverSignals: ServerSignals;
};

export type InsertEvent = {
  deviceId?: string | null;
  type: DeviceEventType;
  payload?: Record<string, unknown>;
  ipHash?: string | null;
};

export type CandidateEvidence = EvidenceRecord & {
  device: DeviceRecord;
};

export interface DeviceStore {
  findAnchorByKeyId(keyId: string): Promise<AnchorRecord | null>;
  findDeviceById(id: string): Promise<DeviceRecord | null>;
  latestEvidence(deviceId: string): Promise<EvidenceRecord | null>;
  /**
   * Candidate search: evidence in last 180d matching same ASN
   * OR same stableHash 8-hex prefix, same evidence profile. Never full-scan.
   */
  findCandidates(opts: {
    asn: number | null | undefined;
    stableHash: string;
    profile: EvidenceProfile;
    nowMs?: number;
  }): Promise<CandidateEvidence[]>;
  insertDevice(row: InsertDevice): Promise<DeviceRecord>;
  updateDevice(
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
  ): Promise<void>;
  insertAnchor(row: InsertAnchor): Promise<AnchorRecord>;
  updateAnchorSignCount(keyId: string, signCount: number): Promise<void>;
  nextEvidenceRevision(deviceId: string): Promise<number>;
  insertEvidence(row: InsertEvidence): Promise<EvidenceRecord>;
  insertEvent(row: InsertEvent): Promise<void>;
  insertLink(opts: {
    deviceId: string;
    relatedDeviceId: string;
    relation: string;
  }): Promise<void>;
  listEvidence(deviceId: string): Promise<EvidenceRecord[]>;
}

export function stableHashPrefix(stableHash: string): string {
  return stableHash.slice(0, STABLE_HASH_BUCKET_PREFIX_LEN).toLowerCase();
}

export function lookbackCutoffIso(nowMs: number = Date.now()): string {
  const ms = CANDIDATE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return new Date(nowMs - ms).toISOString();
}

export function nowIso(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString();
}

/** Legacy DB rows without profile are treated as `full`. */
export function coerceEvidenceProfile(
  value: string | null | undefined,
): EvidenceProfile {
  if (value === 'stable' || value === 'full') return value;
  return 'full';
}
