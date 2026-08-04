/** V5 — Network Information API (volatile). */
export function collectNetwork(): unknown {
  const conn = (
    navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
        type?: string;
      };
    }
  ).connection;
  if (!conn) return { available: false };
  return {
    available: true,
    effectiveType: conn.effectiveType ?? null,
    downlink: conn.downlink ?? null,
    rtt: conn.rtt ?? null,
    saveData: conn.saveData ?? null,
    type: conn.type ?? null,
  };
}
