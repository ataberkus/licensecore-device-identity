/**
 * Collector timing harness (Chromium via Playwright).
 *
 * Usage (repo root):
 *   pnpm bench:collectors
 *   pnpm bench:collectors -- --runs=5
 *
 * Builds `@licensecore/client` if `dist/index.global.js` is missing.
 * Prints per-collector ms from EvidenceBundle + wall time / p95 across runs.
 * Exit 1 if median wall time ≥ 400ms (hard budget) — soft warn if p95 ≥ 150ms.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { COLLECTION_BUDGET_MS } from '../packages/shared/src/constants/thresholds.js';
import { COLLECTOR_IDS } from '../packages/shared/src/constants/collectors.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const bundlePath = resolve(root, 'packages/client/dist/index.global.js');

function parseRuns(argv: string[]): number {
  for (const a of argv) {
    const m = /^--runs=(\d+)$/.exec(a);
    if (m) return Math.max(1, Number(m[1]));
  }
  return 5;
}

function ensureBundle(): void {
  if (existsSync(bundlePath)) return;
  console.log('Building @licensecore/client…');
  const r = spawnSync(
    'pnpm',
    ['--filter', '@licensecore/client', 'build'],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  if (r.status !== 0) {
    throw new Error('client build failed');
  }
  if (!existsSync(bundlePath)) {
    throw new Error(`missing bundle after build: ${bundlePath}`);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx] ?? 0;
}

type RunResult = {
  wallMs: number;
  budgetMs: number;
  perCollector: Array<{ id: string; class: string; ms: number | null; error: boolean }>;
  errorCount: number;
};

async function oneRun(): Promise<RunResult> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // Secure origin required for crypto.subtle (about:blank has no SubtleCrypto).
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: bundlePath });

    return await page.evaluate(async () => {
      const api = (
        globalThis as unknown as {
          LicenseCoreClient: {
            collect: () => Promise<{
              budgetMs: number;
              componentHashes: Record<
                string,
                { class: string; ms?: number; error?: true }
              >;
            }>;
          };
        }
      ).LicenseCoreClient;

      if (!api?.collect) {
        throw new Error('LicenseCoreClient.collect not found on IIFE global');
      }

      const t0 = performance.now();
      const evidence = await api.collect();
      const wallMs = performance.now() - t0;

      const perCollector = Object.entries(evidence.componentHashes).map(
        ([id, e]) => ({
          id,
          class: e.class,
          ms: typeof e.ms === 'number' ? e.ms : null,
          error: e.error === true,
        }),
      );

      return {
        wallMs,
        budgetMs: evidence.budgetMs,
        perCollector,
        errorCount: perCollector.filter((c) => c.error).length,
      };
    });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const runs = parseRuns(process.argv.slice(2));
  ensureBundle();

  const results: RunResult[] = [];
  for (let i = 0; i < runs; i++) {
    process.stderr.write(`run ${i + 1}/${runs}…\n`);
    results.push(await oneRun());
  }

  const walls = results.map((r) => r.wallMs).sort((a, b) => a - b);
  const medianWall = percentile(walls, 50);
  const p95Wall = percentile(walls, 95);

  // Average per-collector ms across successful (non-error) samples
  const sums = new Map<string, { ms: number; n: number; errors: number; class: string }>();
  for (const id of COLLECTOR_IDS) {
    sums.set(id, { ms: 0, n: 0, errors: 0, class: '' });
  }
  for (const r of results) {
    for (const c of r.perCollector) {
      const row = sums.get(c.id) ?? { ms: 0, n: 0, errors: 0, class: c.class };
      row.class = c.class;
      if (c.error) row.errors += 1;
      else if (c.ms != null) {
        row.ms += c.ms;
        row.n += 1;
      }
      sums.set(c.id, row);
    }
  }

  const table = [...sums.entries()]
    .map(([id, v]) => ({
      id,
      class: v.class,
      avgMs: v.n ? Number((v.ms / v.n).toFixed(2)) : null,
      errors: v.errors,
    }))
    .sort((a, b) => (b.avgMs ?? -1) - (a.avgMs ?? -1));

  const summary = {
    runs,
    budgetMs: results[0]?.budgetMs ?? COLLECTION_BUDGET_MS,
    wallMs: {
      samples: walls.map((w) => Number(w.toFixed(2))),
      median: Number(medianWall.toFixed(2)),
      p95: Number(p95Wall.toFixed(2)),
    },
    collectors: table,
    targets: {
      hardBudgetMs: COLLECTION_BUDGET_MS,
      p95GoalMs: 150,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (medianWall >= COLLECTION_BUDGET_MS) {
    console.error(
      `FAIL: median wall ${medianWall.toFixed(1)}ms ≥ hard budget ${COLLECTION_BUDGET_MS}ms`,
    );
    process.exitCode = 1;
  } else if (p95Wall >= 150) {
    console.error(
      `WARN: p95 wall ${p95Wall.toFixed(1)}ms ≥ 150ms goal (still under ${COLLECTION_BUDGET_MS}ms hard cap)`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
