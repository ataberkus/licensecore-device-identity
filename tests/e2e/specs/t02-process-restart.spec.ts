import fs from 'node:fs';
import {
  test,
  expect,
  gotoHarness,
  diResolve,
  tempProfileDir,
  launchPersistentStealth,
} from '../fixtures/harness';

test.describe('T2 process restart', () => {
  test('persistent context reopen → same deviceId', async ({ browserName }) => {
    const dir = tempProfileDir('t2');
    let firstId = '';

    {
      const context = await launchPersistentStealth(
        browserName as 'chromium' | 'firefox' | 'webkit',
        dir,
      );
      try {
        const page = await context.newPage();
        await gotoHarness(page);
        const first = await diResolve(page);
        firstId = first.deviceId;
        expect(firstId).toBeTruthy();
      } finally {
        await context.close();
      }
    }

    {
      const context = await launchPersistentStealth(
        browserName as 'chromium' | 'firefox' | 'webkit',
        dir,
      );
      try {
        const page = await context.newPage();
        await gotoHarness(page);
        const second = await diResolve(page);
        expect(second.deviceId).toBe(firstId);
        expect(second.isNew).toBe(false);
        expect(second.rebound).toBe(false);
      } finally {
        await context.close();
      }
    }

    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows may lock chrome_debug.log briefly after context.close */
    }
  });
});
