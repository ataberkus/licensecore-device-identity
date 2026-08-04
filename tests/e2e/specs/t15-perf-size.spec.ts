import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  test,
  expect,
  gotoHarness,
  diCollect,
} from '../fixtures/harness';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

test.describe('T15 performance + size', () => {
  test('collection p95 < 150ms (or under 400ms hard budget)', async ({
    page,
  }) => {
    await gotoHarness(page);
    const walls: number[] = [];
    for (let i = 0; i < 12; i++) {
      const ms = await page.evaluate(async () => {
        const di = (
          window as unknown as {
            __DI: { collect: () => Promise<{ budgetMs: number }> };
          }
        ).__DI;
        const t0 = performance.now();
        await di.collect();
        return performance.now() - t0;
      });
      walls.push(ms);
    }
    walls.sort((a, b) => a - b);
    const idx = Math.min(
      walls.length - 1,
      Math.max(0, Math.ceil(0.95 * walls.length) - 1),
    );
    const p95 = walls[idx]!;
    const evidence = await diCollect(page);
    expect(evidence.budgetMs).toBeLessThanOrEqual(400);
    expect(p95, `collection p95 ${p95.toFixed(1)}ms`).toBeLessThan(150);
  });

  test('client gzip < 18KB via size:client', async () => {
    const r = spawnSync('pnpm', ['size:client'], {
      cwd: root,
      encoding: 'utf8',
      shell: true,
    });
    expect(r.status, r.stderr || r.stdout).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/gzip/i);
  });
});
