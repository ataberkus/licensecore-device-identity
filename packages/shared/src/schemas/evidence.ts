import { z } from 'zod';
import { COLLECTOR_IDS } from '../constants/collectors.js';
import { HASH_HEX_LEN } from '../crypto/hash.js';
import { SCHEMA_VERSION } from '../constants/thresholds.js';

export const CollectorClassSchema = z.enum(['S', 'V']);
export type CollectorClass = z.infer<typeof CollectorClassSchema>;

export const CollectorIdSchema = z.enum(
  COLLECTOR_IDS as unknown as [typeof COLLECTOR_IDS[number], ...typeof COLLECTOR_IDS[number][]],
);
export type CollectorId = z.infer<typeof CollectorIdSchema>;

const hex128 = z
  .string()
  .length(HASH_HEX_LEN)
  .regex(/^[0-9a-f]+$/i);

export const ComponentHashEntrySchema = z.object({
  /** 32 hex chars = 128-bit SHA-256 truncate */
  h: hex128,
  class: CollectorClassSchema,
  error: z.literal(true).optional(),
  /** playground/diagnostics; optional on wire */
  ms: z.number().nonnegative().optional(),
});
export type ComponentHashEntry = z.infer<typeof ComponentHashEntrySchema>;

export const IntegrityReportSchema = z.object({
  nativeCodeTampering: z.boolean(),
  canvasNoise: z.boolean(),
  audioNoise: z.boolean(),
  crossSignalContradiction: z.boolean(),
  automationMarkers: z.boolean(),
  privacyHardening: z.boolean(),
  vmMarkers: z.boolean(),
  /** 0..100 advisory; server recomputes policy */
  spoofScore: z.number().min(0).max(100),
  /** named subflags for playground */
  details: z.record(z.unknown()).optional(),
});
export type IntegrityReport = z.infer<typeof IntegrityReportSchema>;

const componentHashesShape = Object.fromEntries(
  COLLECTOR_IDS.map((id) => [id, ComponentHashEntrySchema]),
) as Record<(typeof COLLECTOR_IDS)[number], typeof ComponentHashEntrySchema>;

export const ComponentHashesSchema = z.object(componentHashesShape);
export type ComponentHashes = z.infer<typeof ComponentHashesSchema>;

export const EvidenceBundleSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  componentHashes: ComponentHashesSchema,
  /** hash over sorted S component hs (errors excluded) */
  stableHash: hex128,
  /** hash over sorted V component hs */
  volatileHash: hex128,
  integrity: IntegrityReportSchema,
  collectedAtMs: z.number().int().nonnegative(),
  budgetMs: z.number().positive(),
});
export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
