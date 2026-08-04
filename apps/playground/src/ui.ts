/**
 * Plain-DOM diagnostics UI (no framework).
 * Purpose: prove device_id resolution — no login / seats / license chrome.
 */

import type { EvidenceBundle, IntegrityReport, ResolveResponse } from '@licensecore/shared';
import { COLLECTOR_IDS, type CollectorId } from '@licensecore/shared/constants/collectors';
import { diffEvidence, renderDiffHtml, type EvidenceDiff } from './diff.js';
import { formatLogLine, loadRunLog, type RunLogEntry } from './log.js';

export interface PlaygroundState {
  resolve: ResolveResponse | null;
  evidence: EvidenceBundle | null;
  previousEvidence: EvidenceBundle | null;
  raw: Partial<Record<CollectorId, unknown>>;
  lastNonce: string | null;
  busy: boolean;
  status: string;
}

export type ActionId =
  | 're-resolve'
  | 'force-nonce'
  | 'wipe-idb'
  | 'wipe-ls'
  | 'wipe-all'
  | 'sim-ua'
  | 'sim-canvas'
  | 'enroll-t1'
  | 'export-json';

const ACTIONS: Array<{ id: ActionId; label: string }> = [
  { id: 're-resolve', label: 'Re-resolve' },
  { id: 'force-nonce', label: 'Force new nonce' },
  { id: 'wipe-idb', label: 'Wipe IndexedDB' },
  { id: 'wipe-ls', label: 'Wipe localStorage' },
  { id: 'wipe-all', label: 'Wipe ALL site data' },
  { id: 'sim-ua', label: 'Simulate UA spoof' },
  { id: 'sim-canvas', label: 'Simulate canvas noise' },
  { id: 'enroll-t1', label: 'Enroll Tier-1 WebAuthn' },
  { id: 'export-json', label: 'Export evidence JSON' },
];

export function mountShell(root: HTMLElement, onAction: (id: ActionId) => void): void {
  root.innerHTML = `
    <header class="hero">
      <h1>LicenseCore Device Identity</h1>
      <p class="sub">Diagnostics playground — resolve evidence → server-owned <code>device_id</code>. No seats, no login.</p>
    </header>

    <section class="identity" id="identity">
      <div class="device-id mono" id="deviceId">—</div>
      <div class="badges" id="badges"></div>
      <p class="status" id="status">Idle</p>
    </section>

    <section class="toolbar" id="toolbar"></section>

    <section class="panel">
      <h2>Collectors</h2>
      <div class="scroll">
        <table class="data" id="collectors">
          <thead>
            <tr>
              <th>collector</th>
              <th>class</th>
              <th>value preview</th>
              <th>hash</th>
              <th>ms</th>
              <th>error</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>IntegrityReport</h2>
      <div id="integrity"></div>
    </section>

    <section class="panel">
      <h2>Evidence drift (current vs previous)</h2>
      <div id="diff"></div>
    </section>

    <section class="panel">
      <h2>Run log <span class="muted">(persisted)</span></h2>
      <pre class="log mono" id="log"></pre>
    </section>
  `;

  const toolbar = root.querySelector('#toolbar');
  if (!toolbar) return;
  for (const a of ACTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset['action'] = a.id;
    btn.textContent = a.label;
    btn.addEventListener('click', () => onAction(a.id));
    toolbar.append(btn);
  }
}

export function renderState(root: HTMLElement, state: PlaygroundState): void {
  const deviceEl = root.querySelector('#deviceId');
  const badgesEl = root.querySelector('#badges');
  const statusEl = root.querySelector('#status');
  const collectorsBody = root.querySelector('#collectors tbody');
  const integrityEl = root.querySelector('#integrity');
  const diffEl = root.querySelector('#diff');
  const logEl = root.querySelector('#log');

  if (deviceEl) {
    deviceEl.textContent = state.resolve?.deviceId ?? '— no resolve yet —';
  }
  if (badgesEl) {
    badgesEl.innerHTML = renderBadges(state);
  }
  if (statusEl) {
    statusEl.textContent = state.busy ? `Busy… ${state.status}` : state.status;
  }

  setToolbarDisabled(root, state.busy);

  if (collectorsBody) {
    collectorsBody.innerHTML = renderCollectorRows(state);
  }
  if (integrityEl) {
    integrityEl.innerHTML = renderIntegrity(state.evidence?.integrity ?? null, state.resolve);
  }
  if (diffEl) {
    const d: EvidenceDiff | null = diffEvidence(state.previousEvidence, state.evidence);
    diffEl.innerHTML = renderDiffHtml(d);
  }
  if (logEl) {
    const lines = loadRunLog().map(formatLogLine);
    logEl.textContent = lines.length ? lines.join('\n') : '(empty)';
  }
}

export function refreshLogOnly(root: HTMLElement): void {
  const logEl = root.querySelector('#log');
  if (!logEl) return;
  const lines = loadRunLog().map(formatLogLine);
  logEl.textContent = lines.length ? lines.join('\n') : '(empty)';
}

function setToolbarDisabled(root: HTMLElement, busy: boolean): void {
  root.querySelectorAll('#toolbar button').forEach((b) => {
    (b as HTMLButtonElement).disabled = busy;
  });
}

function renderBadges(state: PlaygroundState): string {
  const r = state.resolve;
  if (!r) return `<span class="badge muted">unresolved</span>`;
  const parts = [
    badge(`confidence: ${r.confidence}`, confClass(r.confidence)),
    badge(`tier ${r.anchorTier}`, 'tier'),
    badge(r.hardwareBacked ? 'hardwareBacked' : 'not hardware-backed', r.hardwareBacked ? 'hw' : 'muted'),
    badge(r.isNew ? 'isNew' : 'known', r.isNew ? 'new' : 'ok'),
    badge(r.rebound ? 'rebound' : 'no rebind', r.rebound ? 'warn' : 'ok'),
    badge(`spoof ${r.spoofScore}`, r.spoofScore >= 40 ? 'warn' : 'ok'),
  ];
  if (r.needsReview) parts.push(badge('needsReview', 'warn'));
  if (r.privateContext) parts.push(badge('privateContext', 'warn'));
  if (state.lastNonce) {
    parts.push(badge(`nonce ${state.lastNonce.slice(0, 8)}…`, 'muted'));
  }
  if (state.evidence) {
    parts.push(badge(`stable ${state.evidence.stableHash.slice(0, 8)}…`, 'muted'));
  }
  return parts.join('');
}

function confClass(c: string): string {
  if (c === 'high') return 'ok';
  if (c === 'medium') return 'tier';
  return 'warn';
}

function badge(text: string, cls: string): string {
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

function renderCollectorRows(state: PlaygroundState): string {
  const hashes = state.evidence?.componentHashes;
  return COLLECTOR_IDS.map((id) => {
    const entry = hashes?.[id];
    const preview = previewValue(state.raw[id], Boolean(entry?.error));
    const cls = entry?.class ?? '—';
    const hash = entry?.h ?? '—';
    const ms = entry?.ms != null ? String(entry.ms) : '—';
    const err = entry?.error ? 'true' : '';
    return `<tr class="${err ? 'err' : ''}">
      <td class="mono">${esc(id)}</td>
      <td><span class="cls">${esc(String(cls))}</span></td>
      <td class="preview mono">${esc(preview)}</td>
      <td class="mono hash">${esc(hash)}</td>
      <td>${esc(ms)}</td>
      <td>${err ? '⚠' : ''}</td>
    </tr>`;
  }).join('');
}

function previewValue(value: unknown, errored: boolean): string {
  if (errored && value === undefined) return '(error)';
  if (value === undefined) return '—';
  try {
    const s = JSON.stringify(value);
    if (s === undefined) return String(value);
    return s.length > 96 ? `${s.slice(0, 93)}…` : s;
  } catch {
    return String(value);
  }
}

function renderIntegrity(
  integrity: IntegrityReport | null,
  resolve: ResolveResponse | null,
): string {
  if (!integrity) return `<p class="muted">No integrity report yet.</p>`;
  const flags: Array<keyof IntegrityReport> = [
    'nativeCodeTampering',
    'canvasNoise',
    'audioNoise',
    'crossSignalContradiction',
    'automationMarkers',
    'privacyHardening',
    'vmMarkers',
  ];
  const rows = flags
    .map((f) => {
      const on = Boolean(integrity[f]);
      return `<tr class="${on ? 'flag-on' : ''}">
        <td>${esc(f)}</td>
        <td class="mono">${on ? 'true' : 'false'}</td>
      </tr>`;
    })
    .join('');

  const clientSpoof = integrity.spoofScore;
  const serverSpoof = resolve?.spoofScore;
  const details =
    integrity.details && Object.keys(integrity.details).length
      ? `<pre class="mono details">${esc(JSON.stringify(integrity.details, null, 2))}</pre>`
      : '';

  return `
    <table class="data integrity">
      <thead><tr><th>flag</th><th>value</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="spoof"><td>spoofScore (client advisory)</td><td class="mono">${clientSpoof}</td></tr>
        <tr class="spoof"><td>spoofScore (server)</td><td class="mono">${serverSpoof ?? '—'}</td></tr>
      </tbody>
    </table>
    ${details}
  `;
}

function esc(s: string): string {
  return s
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

/** Re-export for callers that want to append then refresh. */
export type { RunLogEntry };
