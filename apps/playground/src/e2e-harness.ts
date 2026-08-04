/**
 * Minimal harness for Playwright T1–T16.
 * Exposes window.__DI — not used by the diagnostics playground UI.
 */
import {
  DeviceIdentityTransportError,
  collect,
  fetchChallenge,
  obtainAnchorProof,
  postResolve,
  resolve,
  runCollectors,
  wipeLocalState,
} from '@licensecore/client';
import type { EvidenceBundle, ResolveRequest, ResolveResponse } from '@licensecore/shared';

const IDB_NAME = 'licensecore-device-identity';

export type DiHarness = {
  ready: true;
  origin: string;
  resolve: (opts?: { enrollHardwareAnchor?: boolean; budgetMs?: number }) => Promise<ResolveResponse>;
  collect: () => Promise<EvidenceBundle>;
  runCollectors: () => Promise<{ evidence: EvidenceBundle; raw: Record<string, unknown> }>;
  wipeAnchors: () => Promise<void>;
  wipeAllSiteData: () => Promise<void>;
  clearCookiesAndLocalStorage: () => Promise<void>;
  applyUaSpoof: () => void;
  blockGraphicsApis: () => void;
  bumpUaChFullVersion: () => void;
  setVolatileOverrides: (opts: {
    languages?: string[];
    timezone?: string;
  }) => void;
  resolveWithEvidence: (
    evidence: EvidenceBundle,
    opts?: { includeSpki?: boolean },
  ) => Promise<ResolveResponse>;
  replayResolve: (body: ResolveRequest) => Promise<{ ok: boolean; status: number; body: unknown }>;
  captureResolveBody: () => Promise<{
    response: ResolveResponse;
    request: ResolveRequest;
  }>;
  lastError: string | null;
};

declare global {
  interface Window {
    __DI?: DiHarness;
    __DI_PERMISSION_PROMPTS?: number;
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

async function wipeAllSiteData(): Promise<void> {
  await wipeLocalState();
  await deleteDatabase(IDB_NAME);
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
    document.cookie = 'lc_di_t2=; Path=/; Max-Age=0; SameSite=Lax';
  } catch {
    /* ignore */
  }
}

async function clearCookiesAndLocalStorage(): Promise<void> {
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
    document.cookie = 'lc_di_t2=; Path=/; Max-Age=0; SameSite=Lax';
  } catch {
    /* ignore */
  }
  try {
    if ('caches' in globalThis) {
      await caches.delete('lc-di-t2');
    }
  } catch {
    /* ignore */
  }
}

function applyUaSpoof(): void {
  const spoofed =
    'Mozilla/5.0 (compatible; LicenseCoreSpoof/1.0; Windows NT 99.0)';
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => spoofed,
  });
  try {
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      configurable: true,
      get: () => spoofed,
    });
  } catch {
    /* ignore */
  }
  try {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      get: () => 'FakeOS',
    });
  } catch {
    /* ignore */
  }
  try {
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      get: () => ['xx-XX'],
    });
  } catch {
    /* ignore */
  }
  // Force automationMarkers so server spoofScore > 40 (native alone = 35).
  try {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      configurable: true,
      get: () => true,
    });
  } catch {
    /* ignore */
  }
  try {
    const proto = HTMLCanvasElement.prototype;
    const original = proto.toDataURL;
    proto.toDataURL = function patched(
      this: HTMLCanvasElement,
      ...args: Parameters<HTMLCanvasElement['toDataURL']>
    ): string {
      return original.apply(this, args);
    };
  } catch {
    /* ignore */
  }
}

function blockGraphicsApis(): void {
  const deny = () => {
    throw new Error('blocked_by_e2e');
  };
  try {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: deny,
    });
  } catch {
    /* ignore */
  }
  try {
    // @ts-expect-error intentional stub
    globalThis.WebGLRenderingContext = undefined;
  } catch {
    /* ignore */
  }
  try {
    // @ts-expect-error intentional stub
    globalThis.WebGL2RenderingContext = undefined;
  } catch {
    /* ignore */
  }
  try {
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      get: () => undefined,
    });
  } catch {
    /* ignore */
  }
  try {
    // @ts-expect-error intentional stub
    globalThis.AudioContext = undefined;
    // @ts-expect-error intentional stub
    globalThis.webkitAudioContext = undefined;
  } catch {
    /* ignore */
  }
  try {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      get: () => undefined,
    });
  } catch {
    /* ignore */
  }
}

function bumpUaChFullVersion(): void {
  const nav = navigator as Navigator & {
    userAgentData?: {
      brands: ReadonlyArray<{ brand: string; version: string }>;
      mobile: boolean;
      platform: string;
      getHighEntropyValues: (hints: string[]) => Promise<Record<string, unknown>>;
    };
  };
  const uaData = nav.userAgentData;
  if (!uaData) return;
  const original = uaData.getHighEntropyValues.bind(uaData);
  uaData.getHighEntropyValues = async (hints: string[]) => {
    const high = await original(hints);
    return {
      ...high,
      fullVersionList: [
        { brand: 'Chromium', version: '999.0.0.0' },
        { brand: 'Not.A/Brand', version: '99.0.0.0' },
        { brand: 'Google Chrome', version: '999.0.0.0' },
      ],
      uaFullVersion: '999.0.0.0',
    };
  };
}

function setVolatileOverrides(opts: {
  languages?: string[];
  timezone?: string;
}): void {
  if (opts.languages) {
    Object.defineProperty(navigator, 'languages', {
      configurable: true,
      get: () => opts.languages,
    });
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      get: () => opts.languages![0] ?? 'en-US',
    });
  }
  if (opts.timezone) {
    const tz = opts.timezone;
    const original = Intl.DateTimeFormat;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Intl as any).DateTimeFormat = function patched(
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      return new original(locales, { ...options, timeZone: tz });
    };
    (Intl.DateTimeFormat as unknown as { prototype: unknown }).prototype =
      original.prototype;
  }
}

async function resolveWithEvidence(
  evidence: EvidenceBundle,
  opts: { includeSpki?: boolean } = {},
): Promise<ResolveResponse> {
  const origin = location.origin;
  const challenge = await fetchChallenge(origin, { baseUrl: '' });
  const anchor = await obtainAnchorProof(
    {
      nonce: challenge.nonce,
      origin,
      stableHash: evidence.stableHash,
    },
    { includeSpki: opts.includeSpki !== false },
  );
  const response = await postResolve(
    {
      nonce: challenge.nonce,
      origin,
      anchor,
      evidence,
    },
    { baseUrl: '' },
  );
  return response;
}

async function captureResolveBody(): Promise<{
  response: ResolveResponse;
  request: ResolveRequest;
}> {
  const origin = location.origin;
  const challenge = await fetchChallenge(origin, { baseUrl: '' });
  const evidence = await collect();
  const anchor = await obtainAnchorProof(
    {
      nonce: challenge.nonce,
      origin,
      stableHash: evidence.stableHash,
    },
    { includeSpki: true },
  );
  const request: ResolveRequest = {
    nonce: challenge.nonce,
    origin,
    anchor,
    evidence,
  };
  const response = await postResolve(request, { baseUrl: '' });
  return { response, request };
}

async function replayResolve(
  body: ResolveRequest,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch('/v1/device/resolve', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

function installPermissionProbe(): void {
  window.__DI_PERMISSION_PROMPTS = 0;
  try {
    const original = navigator.permissions?.query?.bind(navigator.permissions);
    if (!original) return;
    navigator.permissions.query = ((desc: PermissionDescriptor) => {
      window.__DI_PERMISSION_PROMPTS =
        (window.__DI_PERMISSION_PROMPTS ?? 0) + 1;
      return original(desc);
    }) as typeof navigator.permissions.query;
  } catch {
    /* ignore */
  }
}

installPermissionProbe();

const harness: DiHarness = {
  ready: true,
  origin: location.origin,
  async resolve(opts = {}) {
    try {
      return await resolve({
        baseUrl: '',
        enrollHardwareAnchor: opts.enrollHardwareAnchor === true,
        ...(opts.budgetMs !== undefined ? { budgetMs: opts.budgetMs } : {}),
      });
    } catch (err) {
      harness.lastError =
        err instanceof DeviceIdentityTransportError
          ? `${err.message}:${err.status}`
          : err instanceof Error
            ? err.message
            : String(err);
      throw err;
    }
  },
  collect,
  async runCollectors() {
    const out = await runCollectors();
    return { evidence: out.evidence, raw: out.raw as Record<string, unknown> };
  },
  wipeAnchors: wipeLocalState,
  wipeAllSiteData,
  clearCookiesAndLocalStorage,
  applyUaSpoof,
  blockGraphicsApis,
  bumpUaChFullVersion,
  setVolatileOverrides,
  resolveWithEvidence,
  replayResolve,
  captureResolveBody,
  lastError: null,
};

window.__DI = harness;
const status = document.querySelector('#status');
if (status) status.textContent = 'ready';
