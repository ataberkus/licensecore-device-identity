/** S14 — Micro timing profile; hard-capped at 25ms wall time. */
export function collectTimingProfile(): unknown {
  const deadline = performance.now() + 25;
  const samples: number[] = [];
  let ops = 0;
  while (performance.now() < deadline) {
    const t0 = performance.now();
    let x = 0;
    for (let i = 0; i < 200; i++) x = Math.sin(x + i) * 1.0000001;
    void x;
    samples.push(performance.now() - t0);
    ops++;
  }
  samples.sort((a, b) => a - b);
  const mid = samples[Math.floor(samples.length / 2)] ?? 0;
  // Coarse tiers only — raw ops/median churn flips stableHash and breaks rebind (T4).
  const opsTier = ops < 200 ? 0 : ops < 800 ? 1 : ops < 2000 ? 2 : 3;
  const medianTier = mid < 0.02 ? 0 : mid < 0.08 ? 1 : 2;
  return { opsTier, medianTier };
}
