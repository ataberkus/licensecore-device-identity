import { describe, expect, it } from 'vitest';
import { COLLECTOR_CLASS, COLLECTOR_IDS } from '@licensecore/shared';
import { runCollectors } from '../../packages/client/src/collect/runner.js';
import type { CollectorDefinition } from '../../packages/client/src/collect/types.js';

describe('collect/runner', () => {
  it('isolates throwing collectors as error:true', async () => {
    const collectors: CollectorDefinition[] = COLLECTOR_IDS.map((id) => ({
      id,
      class: COLLECTOR_CLASS[id],
      timeoutMs: 50,
      collect: () => {
        if (id === 'math_fp') throw new Error('boom');
        return { id, ok: true };
      },
    }));

    const { evidence } = await runCollectors({ budgetMs: 400 }, collectors);
    expect(evidence.componentHashes.math_fp?.error).toBe(true);
    expect(evidence.componentHashes.cpu_mem?.error).toBeUndefined();
    expect(evidence.componentHashes.cpu_mem?.h).toMatch(/^[0-9a-f]{32}$/);
    expect(evidence.stableHash).toMatch(/^[0-9a-f]{32}$/);
    expect(evidence.volatileHash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('times out slow collectors without failing the run', async () => {
    const collectors: CollectorDefinition[] = COLLECTOR_IDS.map((id) => ({
      id,
      class: COLLECTOR_CLASS[id],
      timeoutMs: 30,
      collect: async () => {
        if (id === 'timing_profile') {
          await new Promise((r) => setTimeout(r, 200));
          return { slow: true };
        }
        return { id };
      },
    }));

    const { evidence } = await runCollectors({ budgetMs: 400 }, collectors);
    expect(evidence.componentHashes.timing_profile?.error).toBe(true);
    expect(evidence.componentHashes.ua_string?.error).toBeUndefined();
  });

  it('respects hard budget and still returns a full ComponentHashes map', async () => {
    const collectors: CollectorDefinition[] = COLLECTOR_IDS.map((id, i) => ({
      id,
      class: COLLECTOR_CLASS[id],
      timeoutMs: 40,
      collect: async () => {
        await new Promise((r) => setTimeout(r, 25));
        return { i };
      },
    }));

    const t0 = Date.now();
    const { evidence } = await runCollectors({ budgetMs: 80 }, collectors);
    const elapsed = Date.now() - t0;
    // Allow scheduler slack; should not run all collectors * 25ms
    expect(elapsed).toBeLessThan(500);
    for (const id of COLLECTOR_IDS) {
      expect(evidence.componentHashes[id]).toBeDefined();
      expect(evidence.componentHashes[id]?.h).toMatch(/^[0-9a-f]{32}$/);
    }
    const errors = COLLECTOR_IDS.filter(
      (id) => evidence.componentHashes[id]?.error === true,
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('excludes error components from stableHash inputs (S/V split)', async () => {
    const collectors: CollectorDefinition[] = COLLECTOR_IDS.map((id) => ({
      id,
      class: COLLECTOR_CLASS[id],
      timeoutMs: 40,
      collect: () => {
        if (id === 'ua_string') return { w: 1 };
        if (id === 'math_fp') return { x: 1 };
        throw new Error('skip');
      },
    }));

    const { evidence } = await runCollectors({ budgetMs: 400 }, collectors);
    // Only math_fp succeeds among S → stable uses only that
    expect(evidence.componentHashes.math_fp?.error).toBeUndefined();
    expect(evidence.componentHashes.webgl_gpu?.error).toBe(true);
    expect(evidence.componentHashes.ua_string?.error).toBeUndefined();
    expect(evidence.componentHashes.ua_string?.class).toBe('V');
    expect(evidence.componentHashes.math_fp?.class).toBe('S');
  });
});
