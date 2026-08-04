/** Persistent run log — survives reloads via localStorage. */

const STORAGE_KEY = 'lc.playground.runLog';
const MAX_ENTRIES = 200;

export interface RunLogEntry {
  ts: number;
  action: string;
  deviceId?: string;
  confidence?: string;
  anchorTier?: number;
  hardwareBacked?: boolean;
  isNew?: boolean;
  rebound?: boolean;
  spoofScore?: number;
  stableHash?: string;
  message?: string;
  ok: boolean;
}

export function loadRunLog(): RunLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RunLogEntry[];
  } catch {
    return [];
  }
}

export function appendRunLog(entry: Omit<RunLogEntry, 'ts'> & { ts?: number }): RunLogEntry {
  const full: RunLogEntry = { ...entry, ts: entry.ts ?? Date.now() };
  const next = [full, ...loadRunLog()].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  return full;
}

export function clearRunLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function formatLogLine(e: RunLogEntry): string {
  const t = new Date(e.ts).toISOString();
  const status = e.ok ? 'OK' : 'ERR';
  const id = e.deviceId ? ` device=${e.deviceId}` : '';
  const conf = e.confidence ? ` conf=${e.confidence}` : '';
  const tier = e.anchorTier != null ? ` tier=${e.anchorTier}` : '';
  const hw = e.hardwareBacked != null ? ` hw=${e.hardwareBacked}` : '';
  const spoof = e.spoofScore != null ? ` spoof=${e.spoofScore}` : '';
  const flags = [
    e.isNew ? 'new' : null,
    e.rebound ? 'rebind' : null,
  ]
    .filter(Boolean)
    .join(',');
  const flagStr = flags ? ` [${flags}]` : '';
  const msg = e.message ? ` — ${e.message}` : '';
  return `${t} ${status} ${e.action}${id}${conf}${tier}${hw}${spoof}${flagStr}${msg}`;
}
