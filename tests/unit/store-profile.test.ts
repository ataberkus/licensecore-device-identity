import { describe, expect, it } from 'vitest';
import { MemoryDeviceStore } from '../../packages/server/src/db/memory-store.js';
import {
  emptyIntegrity,
  makeComponentHashes,
  makeServerSignals,
} from '../../packages/server/src/test-helpers.js';

describe('MemoryDeviceStore profile filter', () => {
  it('findCandidates only returns same-profile evidence', async () => {
    const store = new MemoryDeviceStore();
    await store.insertDevice({
      id: '00000000-0000-7000-8000-000000000001',
      confidence: 'medium',
      spoofScore: 0,
      hardwareBacked: false,
      needsReview: false,
    });
    await store.insertDevice({
      id: '00000000-0000-7000-8000-000000000002',
      confidence: 'medium',
      spoofScore: 0,
      hardwareBacked: false,
      needsReview: false,
    });

    const signals = makeServerSignals({ asn: 1 });
    const stableHash = 'aabbccdd' + '0'.repeat(24);

    await store.insertEvidence({
      deviceId: '00000000-0000-7000-8000-000000000001',
      revision: 1,
      profile: 'stable',
      stableHash,
      volatileHash: '1'.repeat(32),
      componentHashes: makeComponentHashes('a', undefined, 'stable'),
      integrity: emptyIntegrity(),
      serverSignals: signals,
    });
    await store.insertEvidence({
      deviceId: '00000000-0000-7000-8000-000000000002',
      revision: 1,
      profile: 'full',
      stableHash,
      volatileHash: '2'.repeat(32),
      componentHashes: makeComponentHashes('b', undefined, 'full'),
      integrity: emptyIntegrity(),
      serverSignals: signals,
    });

    const stableCands = await store.findCandidates({
      asn: 1,
      stableHash,
      profile: 'stable',
    });
    expect(stableCands).toHaveLength(1);
    expect(stableCands[0]?.profile).toBe('stable');

    const fullCands = await store.findCandidates({
      asn: 1,
      stableHash,
      profile: 'full',
    });
    expect(fullCands).toHaveLength(1);
    expect(fullCands[0]?.profile).toBe('full');
  });
});
