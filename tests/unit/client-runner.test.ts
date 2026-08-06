import { describe, expect, it } from 'vitest';
import {
  COLLECTOR_CLASS,
  COLLECTOR_IDS,
  DEFAULT_EVIDENCE_PROFILE,
  PROFILE_COLLECTOR_IDS,
  V_COLLECTOR_IDS,
} from '@licensecore/shared';
import { runCollectors } from '../../packages/client/src/collect/runner.js';
import type { CollectorDefinition } from '../../packages/client/src/collect/types.js';

function defsFor(
  ids: readonly (typeof COLLECTOR_IDS)[number][],
  collect: (id: (typeof COLLECTOR_IDS)[number]) => unknown | Promise<unknown>,
  timeoutMs = 50,
): CollectorDefinition[] {
  return ids.map((id) => ({
    id,
    class: COLLECTOR_CLASS[id],
    timeoutMs,
    collect: () => collect(id),
  }));
}

describe('collect/runner', () => {
  it('defaults to stable profile (no font_metrics, no V)', async () => {
    const collectors = defsFor([...COLLECTOR_IDS], (id) => ({ id, ok: true }));
    const { evidence } = await runCollectors({ budgetMs: 400 }, collectors);

    expect(evidence.profile).toBe(DEFAULT_EVIDENCE_PROFILE);
    expect(evidence.profile).toBe('stable');
    expect(evidence.componentHashes.font_metrics).toBeUndefined();
    for (const id of V_COLLECTOR_IDS) {
      expect(evidence.componentHashes[id]).toBeUndefined();
    }
    for (const id of PROFILE_COLLECTOR_IDS.stable) {
      expect(evidence.componentHashes[id]).toBeDefined();
      expect(evidence.componentHashes[id]?.h).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(Object.keys(evidence.componentHashes).sort()).toEqual(
      [...PROFILE_COLLECTOR_IDS.stable].sort(),
    );
  });

  it('isolates throwing collectors as error:true', async () => {
    const collectors = defsFor([...COLLECTOR_IDS], (id) => {
      if (id === 'math_fp') throw new Error('boom');
      return { id, ok: true };
    });

    const { evidence } = await runCollectors({ budgetMs: 400 }, collectors);
    expect(evidence.componentHashes.math_fp?.error).toBe(true);
    expect(evidence.componentHashes.cpu_mem?.error).toBeUndefined();
    expect(evidence.componentHashes.cpu_mem?.h).toMatch(/^[0-9a-f]{32}$/);
    expect(evidence.stableHash).toMatch(/^[0-9a-f]{32}$/);
    expect(evidence.volatileHash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('times out slow collectors without failing the run', async () => {
    const collectors = defsFor(
      [...COLLECTOR_IDS],
      async (id) => {
        if (id === 'timing_profile') {
          await new Promise((r) => setTimeout(r, 200));
          return { slow: true };
        }
        return { id };
      },
      30,
    );

    const { evidence } = await runCollectors({ budgetMs: 400 }, collectors);
    expect(evidence.componentHashes.timing_profile?.error).toBe(true);
    expect(evidence.componentHashes.cpu_mem?.error).toBeUndefined();
  });

  it('respects hard budget and returns only profile keys (full)', async () => {
    const slowCollectors: CollectorDefinition[] = COLLECTOR_IDS.map((id, i) => ({
      id,
      class: COLLECTOR_CLASS[id],
      timeoutMs: 40,
      collect: async () => {
        await new Promise((r) => setTimeout(r, 25));
        return { i };
      },
    }));

    const t0 = Date.now();
    const { evidence } = await runCollectors(
      { budgetMs: 80, profile: 'full' },
      slowCollectors,
    );
    const elapsed = Date.now() - t0;
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
    const collectors = defsFor([...COLLECTOR_IDS], (id) => {
      if (id === 'ua_string') return { w: 1 };
      if (id === 'math_fp') return { x: 1 };
      throw new Error('skip');
    });

    const { evidence } = await runCollectors(
      { budgetMs: 400, profile: 'full' },
      collectors,
    );
    expect(evidence.componentHashes.math_fp?.error).toBeUndefined();
    expect(evidence.componentHashes.webgl_gpu?.error).toBe(true);
    expect(evidence.componentHashes.ua_string?.error).toBeUndefined();
    expect(evidence.componentHashes.ua_string?.class).toBe('V');
    expect(evidence.componentHashes.math_fp?.class).toBe('S');
  });

  it('full profile includes font_metrics and V collectors', async () => {
    const collectors = defsFor([...COLLECTOR_IDS], (id) => ({ id }));
    const { evidence } = await runCollectors(
      { budgetMs: 400, profile: 'full' },
      collectors,
    );
    expect(evidence.profile).toBe('full');
    expect(evidence.componentHashes.font_metrics).toBeDefined();
    expect(evidence.componentHashes.ua_string).toBeDefined();
    expect(Object.keys(evidence.componentHashes).sort()).toEqual(
      [...COLLECTOR_IDS].sort(),
    );
  });
});
