/** V6 — Preference / capability bits. */
export function collectPrefs(): unknown {
  return {
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack ?? null,
    pdfViewerEnabled:
      (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled ??
      null,
    webdriver: navigator.webdriver === true,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}
