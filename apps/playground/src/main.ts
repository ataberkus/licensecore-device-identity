/**
 * Diagnostics playground entry — proves device_id via @licensecore/client.
 */

import {
  DeviceIdentityTransportError,
  resolve,
  runCollectors,
  wipeLocalState,
} from '@licensecore/client';
import type { EvidenceBundle, ResolveResponse } from '@licensecore/shared';
import type { CollectorId } from '@licensecore/shared/constants/collectors';
import { appendRunLog } from './log.js';
import {
  mountShell,
  refreshLogOnly,
  renderState,
  type ActionId,
  type PlaygroundState,
} from './ui.js';
import './styles.css';

const EVIDENCE_LS_KEY = 'lc.playground.lastEvidence';
const PREV_EVIDENCE_LS_KEY = 'lc.playground.prevEvidence';

const state: PlaygroundState = {
  resolve: null,
  evidence: null,
  previousEvidence: null,
  raw: {},
  lastNonce: null,
  busy: false,
  status: 'Ready',
};

const appEl = document.querySelector('#app');
if (!(appEl instanceof HTMLElement)) throw new Error('#app missing');
const app: HTMLElement = appEl;

mountShell(app, (id) => {
  void handleAction(id);
});

hydrateEvidenceFromStorage();
render();
void autoResolveOnLoad();

async function autoResolveOnLoad(): Promise<void> {
  await runResolveFlow({ enrollHardwareAnchor: false, action: 'auto-resolve' });
}

async function handleAction(id: ActionId): Promise<void> {
  switch (id) {
    case 're-resolve':
      await runResolveFlow({ enrollHardwareAnchor: false, action: 're-resolve' });
      break;
    case 'force-nonce':
      await forceNewNonce();
      break;
    case 'wipe-idb':
      await wipeIndexedDbOnly();
      break;
    case 'wipe-ls':
      wipeLocalStorageKeepLog();
      break;
    case 'wipe-all':
      await wipeAllSiteData();
      break;
    case 'sim-ua':
      simulateUaSpoof();
      break;
    case 'sim-canvas':
      simulateCanvasNoise();
      break;
    case 'enroll-t1':
      await runResolveFlow({ enrollHardwareAnchor: true, action: 'enroll-t1' });
      break;
    case 'export-json':
      exportEvidenceJson();
      break;
    default: {
      const _exhaustive: never = id;
      void _exhaustive;
    }
  }
}

async function runResolveFlow(opts: {
  enrollHardwareAnchor: boolean;
  action: string;
}): Promise<void> {
  setBusy(true, opts.action);
  try {
    // Collect once for diagnostics table + drift; resolve() collects again internally.
    const { evidence, raw } = await runCollectors();
    rotateEvidence(evidence);
    state.raw = raw as Partial<Record<CollectorId, unknown>>;

    const res = await resolve({
      enrollHardwareAnchor: opts.enrollHardwareAnchor,
      baseUrl: '',
    });
    state.resolve = res;
    state.status = summarizeResolve(res);
    logResolve(opts.action, res, evidence, true);
  } catch (err) {
    const message = errMessage(err);
    state.status = `Failed: ${message}`;
    const failLog: Parameters<typeof appendRunLog>[0] = {
      action: opts.action,
      ok: false,
      message,
    };
    if (state.resolve?.deviceId) failLog.deviceId = state.resolve.deviceId;
    appendRunLog(failLog);
  } finally {
    setBusy(false);
    render();
  }
}

async function forceNewNonce(): Promise<void> {
  setBusy(true, 'force-nonce');
  try {
    const origin = location.origin;
    const res = await fetch('/v1/device/challenge', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ origin }),
      credentials: 'same-origin',
    });
    const body: unknown = await res.json();
    if (!res.ok) {
      throw new Error(`challenge HTTP ${res.status}`);
    }
    const nonce =
      body &&
      typeof body === 'object' &&
      'nonce' in body &&
      typeof (body as { nonce: unknown }).nonce === 'string'
        ? (body as { nonce: string }).nonce
        : null;
    state.lastNonce = nonce;
    state.status = nonce
      ? `Fresh nonce ${nonce.slice(0, 16)}… (not consumed — Re-resolve to use a new one)`
      : 'Challenge ok but nonce missing';
    appendRunLog({
      action: 'force-nonce',
      ok: true,
      message: nonce ? `nonce=${nonce.slice(0, 16)}…` : 'no nonce',
    });
  } catch (err) {
    const message = errMessage(err);
    state.status = `Challenge failed: ${message}`;
    appendRunLog({ action: 'force-nonce', ok: false, message });
  } finally {
    setBusy(false);
    render();
  }
}

async function wipeIndexedDbOnly(): Promise<void> {
  setBusy(true, 'wipe-idb');
  try {
    await deleteDatabase('licensecore-device-identity');
    state.status = 'IndexedDB wiped (anchors). localStorage/mirrors may remain.';
    appendRunLog({ action: 'wipe-idb', ok: true, message: 'deleted licensecore-device-identity' });
  } catch (err) {
    const message = errMessage(err);
    state.status = `Wipe IDB failed: ${message}`;
    appendRunLog({ action: 'wipe-idb', ok: false, message });
  } finally {
    setBusy(false);
    render();
  }
}

function wipeLocalStorageKeepLog(): void {
  setBusy(true, 'wipe-ls');
  try {
    const runLog = localStorage.getItem('lc.playground.runLog');
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    for (const k of keys) {
      if (k === 'lc.playground.runLog') continue;
      localStorage.removeItem(k);
    }
    if (runLog != null) localStorage.setItem('lc.playground.runLog', runLog);
    state.status = 'localStorage wiped (run log kept).';
    appendRunLog({ action: 'wipe-ls', ok: true });
  } catch (err) {
    appendRunLog({ action: 'wipe-ls', ok: false, message: errMessage(err) });
    state.status = `Wipe localStorage failed: ${errMessage(err)}`;
  } finally {
    setBusy(false);
    render();
  }
}

async function wipeAllSiteData(): Promise<void> {
  setBusy(true, 'wipe-all');
  try {
    await wipeLocalState();
    await deleteDatabase('licensecore-device-identity');
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      if ('caches' in globalThis) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    try {
      // Expire known client cookie pointer
      document.cookie = 'lc_di_t2=; Path=/; Max-Age=0; SameSite=Lax';
    } catch {
      /* ignore */
    }
    state.previousEvidence = null;
    state.evidence = null;
    state.resolve = null;
    state.raw = {};
    state.lastNonce = null;
    state.status = 'ALL site data wiped. Re-resolve to enroll fresh.';
    appendRunLog({ action: 'wipe-all', ok: true, message: 'anchors+storage+caches cleared' });
  } catch (err) {
    const message = errMessage(err);
    state.status = `Wipe ALL failed: ${message}`;
    appendRunLog({ action: 'wipe-all', ok: false, message });
  } finally {
    setBusy(false);
    render();
  }
}

function simulateUaSpoof(): void {
  try {
    const spoofed = 'Mozilla/5.0 (compatible; LicenseCoreSpoof/1.0; Windows NT 99.0)';
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => spoofed,
    });
    // Patch platform / vendor lightly to trip contradiction heuristics
    try {
      Object.defineProperty(navigator, 'platform', {
        configurable: true,
        get: () => 'FakeOS',
      });
    } catch {
      /* ignore */
    }
    state.status = 'UA spoof active for this page session. Re-resolve to observe spoofScore.';
    appendRunLog({ action: 'sim-ua', ok: true, message: spoofed });
  } catch (err) {
    state.status = `UA spoof failed: ${errMessage(err)}`;
    appendRunLog({ action: 'sim-ua', ok: false, message: errMessage(err) });
  }
  render();
}

function simulateCanvasNoise(): void {
  try {
    const proto = HTMLCanvasElement.prototype;
    const original = proto.toDataURL;
    proto.toDataURL = function patchedToDataURL(
      this: HTMLCanvasElement,
      ...args: Parameters<HTMLCanvasElement['toDataURL']>
    ): string {
      const ctx = this.getContext('2d');
      if (ctx) {
        const n = Math.floor(Math.random() * 255);
        ctx.fillStyle = `rgba(${n},${n},${n},0.01)`;
        ctx.fillRect(0, 0, 1, 1);
      }
      return original.apply(this, args);
    };
    state.status = 'Canvas noise injection active. Re-resolve to observe integrity.canvasNoise.';
    appendRunLog({ action: 'sim-canvas', ok: true });
  } catch (err) {
    state.status = `Canvas noise failed: ${errMessage(err)}`;
    appendRunLog({ action: 'sim-canvas', ok: false, message: errMessage(err) });
  }
  render();
}

function exportEvidenceJson(): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    resolve: state.resolve,
    evidence: state.evidence,
    previousEvidence: state.previousEvidence,
    raw: state.raw,
    lastNonce: state.lastNonce,
  };
  if (!state.evidence) {
    state.status = 'Nothing to export — resolve first.';
    render();
    return;
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `licensecore-evidence-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const exportLog: Parameters<typeof appendRunLog>[0] = {
    action: 'export-json',
    ok: true,
    stableHash: state.evidence.stableHash,
  };
  if (state.resolve?.deviceId) exportLog.deviceId = state.resolve.deviceId;
  appendRunLog(exportLog);
  state.status = 'Evidence JSON downloaded.';
  refreshLogOnly(app);
}

function rotateEvidence(next: EvidenceBundle): void {
  if (state.evidence) {
    state.previousEvidence = state.evidence;
    persistJson(PREV_EVIDENCE_LS_KEY, state.evidence);
  }
  state.evidence = next;
  persistJson(EVIDENCE_LS_KEY, next);
}

function hydrateEvidenceFromStorage(): void {
  state.evidence = readJson<EvidenceBundle>(EVIDENCE_LS_KEY);
  state.previousEvidence = readJson<EvidenceBundle>(PREV_EVIDENCE_LS_KEY);
}

function persistJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolvePromise();
    req.onerror = () => reject(req.error ?? new Error('idb delete failed'));
    req.onblocked = () => resolvePromise();
  });
}

function logResolve(
  action: string,
  res: ResolveResponse,
  evidence: EvidenceBundle,
  ok: boolean,
): void {
  appendRunLog({
    action,
    ok,
    deviceId: res.deviceId,
    confidence: res.confidence,
    anchorTier: res.anchorTier,
    hardwareBacked: res.hardwareBacked,
    isNew: res.isNew,
    rebound: res.rebound,
    spoofScore: res.spoofScore,
    stableHash: evidence.stableHash,
  });
}

function summarizeResolve(res: ResolveResponse): string {
  const bits = [
    res.isNew ? 'enrolled' : 'recognized',
    `conf=${res.confidence}`,
    `tier=${res.anchorTier}`,
    res.rebound ? 'REBOUND' : null,
    res.hardwareBacked ? 'HW' : null,
  ].filter(Boolean);
  return bits.join(' · ');
}

function errMessage(err: unknown): string {
  if (err instanceof DeviceIdentityTransportError) {
    return `${err.message} (HTTP ${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function setBusy(busy: boolean, status?: string): void {
  state.busy = busy;
  if (status) state.status = status;
  render();
}

function render(): void {
  renderState(app, state);
}
