/** V8 — Plugins / mimeTypes length snapshot (volatile; Chromium often empty). */
export function collectPlugins(): unknown {
  const plugins = navigator.plugins;
  const names: string[] = [];
  if (plugins) {
    for (let i = 0; i < plugins.length; i++) {
      const p = plugins.item(i);
      if (p?.name) names.push(p.name);
    }
  }
  names.sort();
  return {
    count: plugins?.length ?? 0,
    names,
    mimeTypes: navigator.mimeTypes?.length ?? 0,
  };
}
