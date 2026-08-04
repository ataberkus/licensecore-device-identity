/** Canvas noise: identical double-render should match; inequality ⇒ noise. */
export function detectCanvasNoise(): {
  noise: boolean;
  details: Record<string, unknown>;
} {
  try {
    const a = paint('N');
    const b = paint('N');
    return { noise: a !== b, details: { equal: a === b } };
  } catch (e) {
    return { noise: false, details: { error: String(e) } };
  }
}

function paint(label: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 30;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d');
  ctx.fillStyle = '#abc';
  ctx.fillRect(0, 0, 120, 30);
  ctx.fillStyle = '#123';
  ctx.font = '14px Arial';
  ctx.fillText(`n${label}`, 2, 14);
  return canvas.toDataURL();
}

/** Audio noise: two OfflineAudioContext runs with same graph should match. */
export async function detectAudioNoise(): Promise<{
  noise: boolean;
  details: Record<string, unknown>;
}> {
  try {
    const OfflineCtx =
      window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!OfflineCtx) {
      return { noise: false, details: { skipped: true } };
    }
    const run = async (): Promise<Float32Array> => {
      const ctx = new OfflineCtx(1, 4096, 44100);
      const osc = ctx.createOscillator();
      osc.frequency.value = 440;
      osc.connect(ctx.destination);
      osc.start(0);
      const buf = await ctx.startRendering();
      return buf.getChannelData(0).slice(0);
    };
    const a = await run();
    const b = await run();
    let equal = a.length === b.length;
    if (equal) {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          equal = false;
          break;
        }
      }
    }
    return { noise: !equal, details: { equal } };
  } catch (e) {
    return { noise: false, details: { error: String(e) } };
  }
}
