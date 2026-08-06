import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  test as base,
  expect,
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { truncateDeviceTables, waitForE2eDb, ADMIN_API_KEY } from './db';

export type ResolveResult = {
  deviceId: string;
  isNew: boolean;
  confidence: string;
  anchorTier: number;
  hardwareBacked: boolean;
  rebound: boolean;
  deviceToken: string;
  spoofScore: number;
  needsReview?: boolean;
  privateContext?: boolean;
};

export type EvidenceResult = {
  profile: string;
  stableHash: string;
  volatileHash: string;
  budgetMs: number;
  collectedAtMs: number;
  componentHashes: Record<
    string,
    { h: string; class: string; error?: true; ms?: number }
  >;
  integrity: {
    spoofScore: number;
    nativeCodeTampering: boolean;
    automationMarkers: boolean;
    privacyHardening: boolean;
    canvasNoise: boolean;
    audioNoise: boolean;
    details?: Record<string, unknown>;
  };
};

export const HARNESS_PATH = '/e2e.html';

type Fixtures = {
  freshDb: void;
};

/** Hide Playwright webdriver so automationMarkers alone do not block rebind. */
export async function stealthWebdriver(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      Object.defineProperty(Navigator.prototype, 'webdriver', {
        configurable: true,
        get: () => undefined,
      });
    } catch {
      /* ignore */
    }
  });
}

export async function gotoHarness(page: Page): Promise<void> {
  await page.goto(HARNESS_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () =>
      (window as unknown as { __DI?: { ready?: boolean } }).__DI?.ready === true,
  );
}

export async function diResolve(
  page: Page,
  opts?: {
    enrollHardwareAnchor?: boolean;
    budgetMs?: number;
    profile?: 'stable' | 'full';
  },
): Promise<ResolveResult> {
  return page.evaluate(async (o) => {
    const di = (
      window as unknown as {
        __DI: {
          resolve: (opts?: {
            enrollHardwareAnchor?: boolean;
            budgetMs?: number;
            profile?: 'stable' | 'full';
          }) => Promise<ResolveResult>;
        };
      }
    ).__DI;
    return di.resolve(o ?? {});
  }, opts ?? {});
}

export async function diCollect(
  page: Page,
  opts?: { profile?: 'stable' | 'full' },
): Promise<EvidenceResult> {
  return page.evaluate(async (o) => {
    const di = (
      window as unknown as {
        __DI: {
          collect: (opts?: {
            profile?: 'stable' | 'full';
          }) => Promise<EvidenceResult>;
        };
      }
    ).__DI;
    return di.collect(o);
  }, opts);
}

export async function diWipeAll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (
      window as unknown as { __DI: { wipeAllSiteData: () => Promise<void> } }
    ).__DI.wipeAllSiteData();
  });
}

export async function diClearCookiesLs(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await (
      window as unknown as {
        __DI: { clearCookiesAndLocalStorage: () => Promise<void> };
      }
    ).__DI.clearCookiesAndLocalStorage();
  });
  await page.context().clearCookies();
}

export async function diApplyUaSpoof(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as { __DI: { applyUaSpoof: () => void } }
    ).__DI.applyUaSpoof();
  });
}

export async function diBlockGraphics(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as { __DI: { blockGraphicsApis: () => void } }
    ).__DI.blockGraphicsApis();
  });
}

export async function diBumpUaCh(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as { __DI: { bumpUaChFullVersion: () => void } }
    ).__DI.bumpUaChFullVersion();
  });
}

export async function diSetVolatile(
  page: Page,
  opts: { languages?: string[]; timezone?: string },
): Promise<void> {
  await page.evaluate((o) => {
    (
      window as unknown as {
        __DI: {
          setVolatileOverrides: (opts: {
            languages?: string[];
            timezone?: string;
          }) => void;
        };
      }
    ).__DI.setVolatileOverrides(o);
  }, opts);
}

export async function diCaptureResolve(page: Page) {
  return page.evaluate(async () => {
    const di = (
      window as unknown as {
        __DI: {
          captureResolveBody: () => Promise<{
            response: ResolveResult;
            request: unknown;
          }>;
        };
      }
    ).__DI;
    return di.captureResolveBody();
  });
}

export async function diReplay(page: Page, body: unknown) {
  return page.evaluate(async (b) => {
    const di = (
      window as unknown as {
        __DI: {
          replayResolve: (
            body: unknown,
          ) => Promise<{ ok: boolean; status: number; body: unknown }>;
        };
      }
    ).__DI;
    return di.replayResolve(b);
  }, body);
}

export async function diResolveWithEvidence(page: Page, evidence: unknown) {
  return page.evaluate(async (ev) => {
    const di = (
      window as unknown as {
        __DI: {
          resolveWithEvidence: (evidence: unknown) => Promise<ResolveResult>;
        };
      }
    ).__DI;
    return di.resolveWithEvidence(ev);
  }, evidence);
}

export async function permissionPromptCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __DI_PERMISSION_PROMPTS?: number })
        .__DI_PERMISSION_PROMPTS ?? 0,
  );
}

export async function fetchAdminEvidence(
  request: Page['request'],
  deviceId: string,
) {
  const res = await request.get(`/v1/device/${deviceId}/evidence`, {
    headers: { Authorization: `Bearer ${ADMIN_API_KEY}` },
  });
  return { status: res.status(), json: (await res.json()) as unknown };
}

export function tempProfileDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `lc-di-${label}-`));
}

export async function newStealthContext(
  browser: Browser,
  opts: Parameters<Browser['newContext']>[0] = {},
): Promise<BrowserContext> {
  const context = await browser.newContext(opts);
  await stealthWebdriver(context);
  return context;
}

const ENGINE = {
  chromium,
  firefox,
  webkit,
} as const;

export async function launchPersistentStealth(
  browserName: keyof typeof ENGINE,
  userDataDir: string,
): Promise<BrowserContext> {
  const launcher = ENGINE[browserName];
  const context = await launcher.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 1280, height: 720 },
  });
  await stealthWebdriver(context);
  return context;
}

export const test = base.extend<Fixtures>({
  freshDb: [
    async ({}, use) => {
      await waitForE2eDb();
      truncateDeviceTables();
      await use();
    },
    { auto: true },
  ],
  context: async ({ browser }, use) => {
    const context = await newStealthContext(browser);
    await use(context);
    await context.close();
  },
});

export { expect };
