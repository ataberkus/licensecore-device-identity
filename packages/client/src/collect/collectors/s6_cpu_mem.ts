/** S6 — CPU / memory hints (hardwareConcurrency, deviceMemory). */
export function collectCpuMem(): unknown {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemory: nav.deviceMemory ?? null,
    platform: nav.platform ?? '',
  };
}
