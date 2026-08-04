import {
  test,
  expect,
  gotoHarness,
  diCollect,
  diResolveWithEvidence,
  newStealthContext,
} from '../fixtures/harness';

/**
 * T6 — Anchors outrank fingerprints once both keys are live.
 * Enroll two profiles with intentionally distinct S hashes, then resolve each
 * with an identical S-bundle clone while keeping their own Tier-2 keys.
 * Device ids must stay distinct (recognize path).
 */
test.describe('T6 identical S-signals, different anchors', () => {
  test('two live anchors keep two devices under identical S hashes', async ({
    browser,
  }) => {
    const ctxA = await newStealthContext(browser);
    const ctxB = await newStealthContext(browser);
    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();
      await gotoHarness(pageA);
      await gotoHarness(pageB);

      // Force distinct first enroll fingerprints so second profile does not rebind.
      const evA = await diCollect(pageA);
      const evB = await diCollect(pageB);
      const mutatedB = structuredClone(evB) as typeof evB;
      const cpu = mutatedB.componentHashes['cpu_mem'];
      if (cpu && !cpu.error) {
        cpu.h = cpu.h.replace(/0/g, '1').replace(/a/g, 'b').slice(0, 32);
        // recompute stableHash client-side via harness collect is hard — use
        // resolveWithEvidence which signs whatever stableHash we send; server
        // matches on componentHashes. Keep stableHash consistent with components
        // by hashing on server side? Server uses evidence.stableHash as stored
        // and componentHashes for scoring. stableHash mismatch with components
        // is ok for match (match uses componentHashes). Signature binds stableHash.
      } else {
        // Fallback: flip math_fp hash
        const math = mutatedB.componentHashes['math_fp'];
        if (math) {
          math.h = ('f' + math.h).slice(0, 32);
        }
      }
      // Rebuild stableHash from S components so wire is coherent
      mutatedB.stableHash = await pageB.evaluate(async (components) => {
        const entries = Object.entries(components)
          .filter(([, v]) => v.class === 'S' && !v.error)
          .map(([id, v]) => `${id}=${v.h}`)
          .sort();
        const enc = new TextEncoder().encode(entries.join('|'));
        const digest = await crypto.subtle.digest('SHA-256', enc);
        return [...new Uint8Array(digest)]
          .slice(0, 16)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }, mutatedB.componentHashes);

      const a = await diResolveWithEvidence(pageA, evA);
      const b = await diResolveWithEvidence(pageB, mutatedB);
      expect(a.deviceId).not.toBe(b.deviceId);

      // Identical S bundle (A's hashes) presented by both with their own keys
      const shared = structuredClone(evA) as typeof evA;
      const a2 = await diResolveWithEvidence(pageA, shared);
      const b2 = await diResolveWithEvidence(pageB, shared);

      expect(a2.deviceId).toBe(a.deviceId);
      expect(b2.deviceId).toBe(b.deviceId);
      expect(a2.deviceId).not.toBe(b2.deviceId);
      expect(a2.rebound).toBe(false);
      expect(b2.rebound).toBe(false);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
