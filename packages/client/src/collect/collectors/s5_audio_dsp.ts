/** S5 — OfflineAudioContext DSP fingerprint (stable single run). */
export async function collectAudioDsp(): Promise<unknown> {
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!OfflineCtx) throw new Error('offline audio unavailable');

  const ctx = new OfflineCtx(1, 44100 * 0.1, 44100);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 10000;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -50;
  comp.knee.value = 40;
  comp.ratio.value = 12;
  comp.attack.value = 0;
  comp.release.value = 0.25;
  osc.connect(comp);
  comp.connect(ctx.destination);
  osc.start(0);
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  const samples: number[] = [];
  for (let i = 0; i < data.length; i += 100) {
    samples.push(Math.fround(data[i] ?? 0));
  }
  return { samples };
}
