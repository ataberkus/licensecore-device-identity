/** V3 — Timezone. */
export function collectTimezone(): unknown {
  let timeZone = '';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    timeZone = '';
  }
  return {
    timeZone,
    offsetMin: new Date().getTimezoneOffset(),
  };
}
