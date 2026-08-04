import {
  COLLECTOR_CLASS,
  COLLECTOR_IDS,
  type CollectorId,
} from '@licensecore/shared/constants/collectors';
import {
  COLLECTION_BUDGET_MS,
  SCHEMA_VERSION,
} from '@licensecore/shared/constants/thresholds';
import type {
  ComponentHashEntry,
  ComponentHashes,
  EvidenceBundle,
} from '@licensecore/shared';
import { ALL_COLLECTORS } from './collectors/index.js';
import { hashCollectorValue, hashSortedComponentHs } from './hash.js';
import type { CollectorDefinition, RunCollectorsOptions } from './types.js';
import { buildIntegrityReport } from '../integrity/report.js';

const ERROR_HASH_SOURCE = '';

export interface RunCollectorsResult {
  evidence: EvidenceBundle;
  /** Successful raw values (for diagnostics / integrity). */
  raw: Partial<Record<CollectorId, unknown>>;
}

/**
 * Failure-isolated collector runner.
 * - Per-collector timeout
 * - Hard wall-clock budget (default 400ms)
 * - Throw/timeout ⇒ `{ error: true }` with deterministic error hash
 * - Partial results OK
 */
export async function runCollectors(
  options: RunCollectorsOptions = {},
  collectors: readonly CollectorDefinition[] = ALL_COLLECTORS,
): Promise<RunCollectorsResult> {
  const budgetMs = options.budgetMs ?? COLLECTION_BUDGET_MS;
  const startedAt = now();
  const deadline = startedAt + budgetMs;

  const componentHashes = {} as Record<CollectorId, ComponentHashEntry>;
  const raw: Partial<Record<CollectorId, unknown>> = {};

  // Seed all ids so ComponentHashes is complete even if registry is filtered in tests
  const errorHash = await hashCollectorValue(ERROR_HASH_SOURCE);

  for (const id of COLLECTOR_IDS) {
    componentHashes[id] = {
      h: errorHash,
      class: COLLECTOR_CLASS[id],
      error: true,
    };
  }

  for (const def of collectors) {
    const remaining = deadline - now();
    if (remaining <= 0) {
      // Budget exhausted — leave remaining as error entries
      break;
    }
    const timeoutMs = Math.min(def.timeoutMs, remaining);
    const t0 = now();
    try {
      const value = await withTimeout(Promise.resolve().then(() => def.collect()), timeoutMs);
      const ms = Math.max(0, now() - t0);
      const h = await hashCollectorValue(value);
      const entry: ComponentHashEntry = {
        h,
        class: def.class,
        ms,
      };
      componentHashes[def.id] = entry;
      raw[def.id] = value;
    } catch {
      const ms = Math.max(0, now() - t0);
      componentHashes[def.id] = {
        h: errorHash,
        class: def.class,
        error: true,
        ms,
      };
    }
  }

  const collectedAtMs = Date.now();
  const budgetUsedEarly = now() - startedAt >= budgetMs;

  const integrity = await buildIntegrityReport({
    raw: raw as Record<string, unknown>,
    skipAudioNoise: budgetUsedEarly || deadline - now() < 30,
  });

  const stableEntries: Array<[string, string]> = [];
  const volatileEntries: Array<[string, string]> = [];
  for (const id of COLLECTOR_IDS) {
    const entry = componentHashes[id];
    if (!entry || entry.error) continue;
    if (entry.class === 'S') stableEntries.push([id, entry.h]);
    else volatileEntries.push([id, entry.h]);
  }

  const stableHash = await hashSortedComponentHs(stableEntries);
  const volatileHash = await hashSortedComponentHs(volatileEntries);

  const evidence: EvidenceBundle = {
    schemaVersion: SCHEMA_VERSION,
    componentHashes: componentHashes as ComponentHashes,
    stableHash,
    volatileHash,
    integrity,
    collectedAtMs,
    budgetMs,
  };

  return { evidence, raw };
}

function now(): number {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('collector timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
