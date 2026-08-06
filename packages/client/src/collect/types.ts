import type {
  CollectorClass,
  CollectorId,
  EvidenceProfile,
} from '@licensecore/shared/constants/collectors';

/** Raw value produced by a collector before hashing. Must be JSON-serializable. */
export type CollectorValue = unknown;

export type CollectorFn = () => CollectorValue | Promise<CollectorValue>;

export interface CollectorDefinition {
  readonly id: CollectorId;
  readonly class: CollectorClass;
  /** Per-collector soft timeout (ms); runner also enforces global budget. */
  readonly timeoutMs: number;
  readonly collect: CollectorFn;
}

export interface RunCollectorsOptions {
  /** Hard wall-clock budget; defaults to COLLECTION_BUDGET_MS. */
  budgetMs?: number;
  /** Collector set; defaults to DEFAULT_EVIDENCE_PROFILE (`stable`). */
  profile?: EvidenceProfile;
}

export interface IntegrityExtras {
  canvasNoise: boolean;
  audioNoise: boolean;
  canvasSamples?: readonly string[];
  audioSamples?: readonly number[];
}
