/** V1 — User-Agent string (volatile). */
export function collectUaString(): unknown {
  return { ua: navigator.userAgent };
}
