/** Side-by-side EvidenceBundle diff — highlight component / integrity drift. */

import type { EvidenceBundle, IntegrityReport } from '@licensecore/shared';
import type { CollectorId } from '@licensecore/shared/constants/collectors';
import { COLLECTOR_IDS } from '@licensecore/shared/constants/collectors';

export type DiffKind = 'same' | 'changed' | 'added' | 'removed' | 'error-flip';

export interface ComponentDiffRow {
  id: CollectorId;
  kind: DiffKind;
  prevHash?: string;
  currHash?: string;
  prevError?: boolean;
  currError?: boolean;
  prevMs?: number;
  currMs?: number;
}

export interface IntegrityDiffRow {
  flag: keyof IntegrityReport | 'spoofScore';
  prev: string;
  curr: string;
  changed: boolean;
}

export interface EvidenceDiff {
  stableHashChanged: boolean;
  volatileHashChanged: boolean;
  prevStable?: string;
  currStable?: string;
  prevVolatile?: string;
  currVolatile?: string;
  components: ComponentDiffRow[];
  integrity: IntegrityDiffRow[];
  changedCount: number;
}

const INTEGRITY_FLAGS: Array<keyof IntegrityReport> = [
  'nativeCodeTampering',
  'canvasNoise',
  'audioNoise',
  'crossSignalContradiction',
  'automationMarkers',
  'privacyHardening',
  'vmMarkers',
  'spoofScore',
];

export function diffEvidence(
  prev: EvidenceBundle | null,
  curr: EvidenceBundle | null,
): EvidenceDiff | null {
  if (!prev && !curr) return null;
  const components: ComponentDiffRow[] = [];
  let changedCount = 0;

  for (const id of COLLECTOR_IDS) {
    const p = prev?.componentHashes[id];
    const c = curr?.componentHashes[id];
    if (!p && !c) continue;

    let kind: DiffKind = 'same';
    if (!p && c) kind = 'added';
    else if (p && !c) kind = 'removed';
    else if (p && c) {
      const errFlip = Boolean(p.error) !== Boolean(c.error);
      if (errFlip) kind = 'error-flip';
      else if (p.h !== c.h) kind = 'changed';
    }

    if (kind !== 'same') changedCount += 1;
    const row: ComponentDiffRow = { id, kind };
    if (p?.h !== undefined) row.prevHash = p.h;
    if (c?.h !== undefined) row.currHash = c.h;
    if (p?.error) row.prevError = true;
    if (c?.error) row.currError = true;
    if (p?.ms !== undefined) row.prevMs = p.ms;
    if (c?.ms !== undefined) row.currMs = c.ms;
    components.push(row);
  }

  const integrity: IntegrityDiffRow[] = [];
  for (const flag of INTEGRITY_FLAGS) {
    const pv = prev ? String(prev.integrity[flag]) : '—';
    const cv = curr ? String(curr.integrity[flag]) : '—';
    const changed = pv !== cv;
    if (changed) changedCount += 1;
    integrity.push({ flag, prev: pv, curr: cv, changed });
  }

  const prevStable = prev?.stableHash;
  const currStable = curr?.stableHash;
  const prevVolatile = prev?.volatileHash;
  const currVolatile = curr?.volatileHash;
  const stableHashChanged = Boolean(prev && curr && prevStable !== currStable);
  const volatileHashChanged = Boolean(prev && curr && prevVolatile !== currVolatile);
  if (stableHashChanged) changedCount += 1;
  if (volatileHashChanged) changedCount += 1;

  const out: EvidenceDiff = {
    stableHashChanged,
    volatileHashChanged,
    components,
    integrity,
    changedCount,
  };
  if (prevStable !== undefined) out.prevStable = prevStable;
  if (currStable !== undefined) out.currStable = currStable;
  if (prevVolatile !== undefined) out.prevVolatile = prevVolatile;
  if (currVolatile !== undefined) out.currVolatile = currVolatile;
  return out;
}

export function renderDiffHtml(diff: EvidenceDiff | null): string {
  if (!diff) {
    return `<p class="muted">No previous evidence yet — resolve once more to see drift.</p>`;
  }

  const hashLine = (label: string, changed: boolean, prev?: string, curr?: string) =>
    `<div class="diff-hash ${changed ? 'changed' : ''}">
      <strong>${label}</strong>
      <span class="mono">${esc(prev ?? '—')}</span>
      <span class="arrow">→</span>
      <span class="mono">${esc(curr ?? '—')}</span>
    </div>`;

  const compRows = diff.components
    .filter((r) => r.kind !== 'same')
    .map(
      (r) => `<tr class="kind-${r.kind}">
        <td class="mono">${esc(r.id)}</td>
        <td>${esc(r.kind)}</td>
        <td class="mono">${esc(r.prevHash ?? '—')}${r.prevError ? ' ERR' : ''}</td>
        <td class="mono">${esc(r.currHash ?? '—')}${r.currError ? ' ERR' : ''}</td>
      </tr>`,
    )
    .join('');

  const integRows = diff.integrity
    .map(
      (r) => `<tr class="${r.changed ? 'changed' : ''}">
        <td>${esc(String(r.flag))}</td>
        <td class="mono">${esc(r.prev)}</td>
        <td class="mono">${esc(r.curr)}</td>
      </tr>`,
    )
    .join('');

  return `
    <p><strong>${diff.changedCount}</strong> field(s) drifted</p>
    ${hashLine('stableHash', diff.stableHashChanged, diff.prevStable, diff.currStable)}
    ${hashLine('volatileHash', diff.volatileHashChanged, diff.prevVolatile, diff.currVolatile)}
    <h4>Changed components</h4>
    ${
      compRows
        ? `<table class="data"><thead><tr><th>id</th><th>kind</th><th>prev h</th><th>curr h</th></tr></thead><tbody>${compRows}</tbody></table>`
        : `<p class="muted">No component hash changes.</p>`
    }
    <h4>Integrity</h4>
    <table class="data"><thead><tr><th>flag</th><th>prev</th><th>curr</th></tr></thead><tbody>${integRows}</tbody></table>
  `;
}

function esc(s: string): string {
  return s
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}
