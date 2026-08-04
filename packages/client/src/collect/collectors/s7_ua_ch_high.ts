/**
 * S7 — UA Client Hints high-entropy stable subset.
 * Intentionally excludes fullVersionList / uaFullVersion (volatile — T11).
 */
export async function collectUaChHigh(): Promise<unknown> {
  const uaData = (
    navigator as Navigator & {
      userAgentData?: {
        brands: ReadonlyArray<{ brand: string; version: string }>;
        mobile: boolean;
        platform: string;
        getHighEntropyValues: (
          hints: string[],
        ) => Promise<Record<string, unknown>>;
      };
    }
  ).userAgentData;

  if (!uaData) {
    return {
      available: false,
      brands: null,
      mobile: null,
      platform: navigator.platform ?? '',
    };
  }

  const high = await uaData.getHighEntropyValues([
    'architecture',
    'bitness',
    'model',
    'platformVersion',
    'formFactors',
    'wow64',
  ]);

  return {
    available: true,
    brands: uaData.brands,
    mobile: uaData.mobile,
    platform: uaData.platform,
    architecture: high['architecture'] ?? null,
    bitness: high['bitness'] ?? null,
    model: high['model'] ?? null,
    platformVersion: high['platformVersion'] ?? null,
    formFactors: high['formFactors'] ?? null,
    wow64: high['wow64'] ?? null,
  };
}
