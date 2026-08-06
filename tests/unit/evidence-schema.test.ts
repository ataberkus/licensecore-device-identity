import { describe, expect, it } from 'vitest';
import {
  COLLECTOR_CLASS,
  EvidenceBundleSchema,
  PROFILE_COLLECTOR_IDS,
  SCHEMA_VERSION,
  type CollectorId,
  type ComponentHashes,
} from '@licensecore/shared';

const hex = 'a'.repeat(32);

function integrity() {
  return {
    nativeCodeTampering: false,
    canvasNoise: false,
    audioNoise: false,
    crossSignalContradiction: false,
    automationMarkers: false,
    privacyHardening: false,
    vmMarkers: false,
    spoofScore: 0,
  };
}

function hashesFor(profile: 'stable' | 'full'): ComponentHashes {
  const out: ComponentHashes = {};
  for (const id of PROFILE_COLLECTOR_IDS[profile]) {
    out[id as CollectorId] = {
      h: hex,
      class: COLLECTOR_CLASS[id as CollectorId],
    };
  }
  return out;
}

describe('EvidenceBundleSchema profile refine', () => {
  it('accepts stable key set', () => {
    const parsed = EvidenceBundleSchema.safeParse({
      schemaVersion: SCHEMA_VERSION,
      profile: 'stable',
      componentHashes: hashesFor('stable'),
      stableHash: hex,
      volatileHash: hex,
      integrity: integrity(),
      collectedAtMs: 1,
      budgetMs: 400,
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts full key set', () => {
    const parsed = EvidenceBundleSchema.safeParse({
      schemaVersion: SCHEMA_VERSION,
      profile: 'full',
      componentHashes: hashesFor('full'),
      stableHash: hex,
      volatileHash: hex,
      integrity: integrity(),
      collectedAtMs: 1,
      budgetMs: 400,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects stable profile with font_metrics present', () => {
    const hashes = hashesFor('stable');
    hashes.font_metrics = { h: hex, class: 'S' };
    const parsed = EvidenceBundleSchema.safeParse({
      schemaVersion: SCHEMA_VERSION,
      profile: 'stable',
      componentHashes: hashes,
      stableHash: hex,
      volatileHash: hex,
      integrity: integrity(),
      collectedAtMs: 1,
      budgetMs: 400,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects full profile missing a collector', () => {
    const hashes = hashesFor('full');
    delete hashes.font_metrics;
    const parsed = EvidenceBundleSchema.safeParse({
      schemaVersion: SCHEMA_VERSION,
      profile: 'full',
      componentHashes: hashes,
      stableHash: hex,
      volatileHash: hex,
      integrity: integrity(),
      collectedAtMs: 1,
      budgetMs: 400,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects missing profile field', () => {
    const parsed = EvidenceBundleSchema.safeParse({
      schemaVersion: SCHEMA_VERSION,
      componentHashes: hashesFor('stable'),
      stableHash: hex,
      volatileHash: hex,
      integrity: integrity(),
      collectedAtMs: 1,
      budgetMs: 400,
    });
    expect(parsed.success).toBe(false);
  });
});
