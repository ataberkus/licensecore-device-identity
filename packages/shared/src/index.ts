/** Wire schemas, constants, and shared crypto helpers for device identity. */

export { SCHEMA_VERSION } from './constants/thresholds.js';
export {
  COLLECTOR_IDS,
  COLLECTOR_CLASS,
  S_COLLECTOR_IDS,
  V_COLLECTOR_IDS,
  isCollectorId,
  isSCollectorId,
  isVCollectorId,
} from './constants/collectors.js';
export type { SCollectorId, VCollectorId } from './constants/collectors.js';

export { S_WEIGHTS, S_WEIGHTS_SUM } from './constants/weights.js';
export {
  REBIND_SCORE,
  CANDIDATE_SCORE,
  BLEND_MIN_BASE_FOR_REBIND,
  SPOOF_SCORE_REBIND_BLOCK,
  DRIFT_TOLERANCE,
  CANDIDATE_LOOKBACK_DAYS,
  REBIND_MIN_IDLE_MS,
  STABLE_HASH_BUCKET_PREFIX_LEN,
  COLLECTION_BUDGET_MS,
  NONCE_TTL_MS,
  DEVICE_TOKEN_TTL_MS,
  SERVER_BLEND,
} from './constants/thresholds.js';

export {
  HASH_HEX_LEN,
  SHA256_HEX_LEN,
  SIGNATURE_ENCODING,
  isHashHex128,
  truncateSha256HexTo128,
} from './crypto/hash.js';

export { ERROR_CODES } from './errors.js';

export {
  CollectorClassSchema,
  CollectorIdSchema,
  ComponentHashEntrySchema,
  ComponentHashesSchema,
  IntegrityReportSchema,
  EvidenceBundleSchema,
} from './schemas/evidence.js';
export type {
  CollectorClass,
  CollectorId,
  ComponentHashEntry,
  ComponentHashes,
  IntegrityReport,
  EvidenceBundle,
} from './schemas/evidence.js';

export { AnchorTierSchema, AnchorProofSchema } from './schemas/anchor.js';
export type { AnchorTier, AnchorProof } from './schemas/anchor.js';

export {
  ChallengeRequestSchema,
  ChallengeResponseSchema,
} from './schemas/challenge.js';
export type {
  ChallengeRequest,
  ChallengeResponse,
} from './schemas/challenge.js';

export {
  ConfidenceSchema,
  ResolveRequestSchema,
  ResolveResponseSchema,
  ErrorCodeSchema,
  ErrorResponseSchema,
  ReverifyRequestSchema,
  ReverifyResponseSchema,
  ServerSignalsSchema,
  EvidenceRevisionSchema,
} from './schemas/resolve.js';
export type {
  Confidence,
  ResolveRequest,
  ResolveResponse,
  ErrorCode,
  ErrorResponse,
  ReverifyRequest,
  ReverifyResponse,
  ServerSignals,
  EvidenceRevision,
} from './schemas/resolve.js';

export { DeviceEventTypeSchema, DeviceEventSchema } from './schemas/events.js';
export type { DeviceEventType, DeviceEvent } from './schemas/events.js';
