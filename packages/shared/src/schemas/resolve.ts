import { z } from 'zod';
import { ERROR_CODES } from '../errors.js';
import { AnchorProofSchema } from './anchor.js';
import { AnchorTierSchema } from './anchor.js';
import {
  ComponentHashesSchema,
  EvidenceBundleSchema,
  EvidenceProfileSchema,
  IntegrityReportSchema,
} from './evidence.js';

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ResolveRequestSchema = z.object({
  nonce: z.string().min(1),
  origin: z.string().min(1),
  /** null ⇒ Tier 3 evidence-only */
  anchor: AnchorProofSchema.nullable(),
  evidence: EvidenceBundleSchema,
});
export type ResolveRequest = z.infer<typeof ResolveRequestSchema>;

export const ResolveResponseSchema = z.object({
  /** UUIDv7 */
  deviceId: z.string().uuid(),
  isNew: z.boolean(),
  confidence: ConfidenceSchema,
  anchorTier: AnchorTierSchema,
  /** true only if Tier 1 and BE===0 accepted */
  hardwareBacked: z.boolean(),
  rebound: z.boolean(),
  /** JWT 10m, cnf.jkt = key thumbprint (or empty jkt for Tier 3) */
  deviceToken: z.string(),
  /** server-authoritative */
  spoofScore: z.number().min(0).max(100),
  needsReview: z.boolean().optional(),
  /** incognito heuristic flag for policy */
  privateContext: z.boolean().optional(),
});
export type ResolveResponse = z.infer<typeof ResolveResponseSchema>;

export const ErrorCodeSchema = z.enum(
  ERROR_CODES as unknown as [typeof ERROR_CODES[number], ...typeof ERROR_CODES[number][]],
);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const ReverifyRequestSchema = z.object({
  nonce: z.string().min(1),
  origin: z.string().min(1),
  keyId: z.string().min(1),
  signature: z.string().min(1),
});
export type ReverifyRequest = z.infer<typeof ReverifyRequestSchema>;

export const ReverifyResponseSchema = z.object({
  deviceToken: z.string().min(1),
  deviceId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
});
export type ReverifyResponse = z.infer<typeof ReverifyResponseSchema>;

export const ServerSignalsSchema = z.object({
  ipHash: z.string().min(1),
  ip24Hash: z.string().min(1),
  asn: z.number().int().nullable().optional(),
  acceptLanguage: z.string(),
  headerOrderHash: z.string().min(1),
  ja4: z.string().nullable().optional(),
  userAgent: z.string(),
});
export type ServerSignals = z.infer<typeof ServerSignalsSchema>;

export const EvidenceRevisionSchema = z.object({
  revision: z.number().int().nonnegative(),
  profile: EvidenceProfileSchema,
  stableHash: z.string().min(1),
  volatileHash: z.string().min(1),
  componentHashes: ComponentHashesSchema,
  integrity: IntegrityReportSchema,
  serverSignals: ServerSignalsSchema,
  createdAt: z.string().min(1),
});
export type EvidenceRevision = z.infer<typeof EvidenceRevisionSchema>;
