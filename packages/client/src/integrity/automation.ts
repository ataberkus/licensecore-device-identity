/** Automation / headless markers. */
export function detectAutomation(): {
  automation: boolean;
  details: Record<string, unknown>;
} {
  const flags: string[] = [];
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { automation: false, details: { flags, skipped: true } };
  }

  if (navigator.webdriver === true) flags.push('webdriver');

  const w = window as unknown as Record<string, unknown>;
  for (const k of [
    'domAutomation',
    'domAutomationController',
    '_phantom',
    'callPhantom',
    '__nightmare',
    '_selenium',
    'callSelenium',
    '__webdriver_evaluate',
    '__driver_evaluate',
    '__selenium_evaluate',
    '__fxdriver_evaluate',
  ]) {
    if (k in w && w[k] != null) flags.push(k);
  }

  const nav = navigator as Navigator & {
    plugins?: PluginArray;
    languages?: readonly string[];
  };
  if (nav.languages && nav.languages.length === 0) flags.push('empty_languages');
  if (nav.plugins && nav.plugins.length === 0 && /HeadlessChrome/i.test(navigator.userAgent)) {
    flags.push('headless_ua');
  }
  if (/HeadlessChrome/i.test(navigator.userAgent)) flags.push('headless_ua');

  // Chrome cdc_ artifact
  for (const key of Object.keys(w)) {
    if (/^cdc_/u.test(key) || /\$cdc_/u.test(key)) {
      flags.push('cdc_artifact');
      break;
    }
  }

  return {
    automation: flags.length > 0,
    details: { flags },
  };
}
