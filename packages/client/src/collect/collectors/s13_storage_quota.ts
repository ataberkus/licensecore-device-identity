/** S13 — Storage quota estimate (no permission prompt). */
export async function collectStorageQuota(): Promise<unknown> {
  const est = navigator.storage?.estimate
    ? await navigator.storage.estimate()
    : null;
  const persisted = navigator.storage?.persisted
    ? await navigator.storage.persisted()
    : null;
  const quota = est?.quota ?? null;
  // Bucket quota — raw bytes can shift slightly across sessions / after wipe.
  const quotaBucket =
    typeof quota === 'number' && Number.isFinite(quota)
      ? Math.round(Math.log2(Math.max(quota, 1)))
      : null;
  return {
    quotaBucket,
    persisted: persisted === true,
  };
}
