/**
 * S10 — Font metrics via measureText (no queryLocalFonts — would prompt / gated).
 */
export function collectFontMetrics(): unknown {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  const base = 'monospace';
  const fonts = [
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
    'Comic Sans MS',
    'Impact',
    'Segoe UI',
    'Roboto',
    'Ubuntu',
    'Cantarell',
    'Noto Sans',
    'Apple Color Emoji',
    'Segoe UI Emoji',
  ];
  const probe = 'mmmmmmmmmmlliWw';
  const widths: Record<string, number> = {};
  ctx.font = `16px ${base}`;
  const baseline = ctx.measureText(probe).width;
  for (const f of fonts) {
    ctx.font = `16px "${f}", ${base}`;
    widths[f] = ctx.measureText(probe).width;
  }
  return { baseline, widths };
}
