import {
  test,
  expect,
  gotoHarness,
  diResolve,
  stealthWebdriver,
} from '../fixtures/harness';
import { firefox } from '@playwright/test';

test.describe('T13 Firefox RFP + WebKit stability', () => {
  test('WebKit: Tier 2 stable across reloads, no throw', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'webkit', 'WebKit-only slice of T13');
    await gotoHarness(page);
    const first = await diResolve(page);
    expect(first.deviceId).toBeTruthy();
    expect(first.anchorTier).toBe(2);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoHarness(page);
    const second = await diResolve(page);
    expect(second.deviceId).toBe(first.deviceId);
  });

  test('Firefox RFP: no exception, Tier 2 stable across reloads', async ({
    browserName,
  }) => {
    test.skip(browserName !== 'firefox', 'Firefox-only slice of T13');

    const browser = await firefox.launch({
      headless: true,
      firefoxUserPrefs: {
        'privacy.resistFingerprinting': true,
      },
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    await stealthWebdriver(context);

    try {
      const page = await context.newPage();
      await gotoHarness(page);
      const first = await diResolve(page);
      expect(first.deviceId).toBeTruthy();
      expect([2, 3]).toContain(first.anchorTier);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await gotoHarness(page);
      const second = await diResolve(page);
      expect(second.deviceId).toBe(first.deviceId);
      expect(second.anchorTier).toBe(first.anchorTier);
    } finally {
      await context.close();
      await browser.close();
    }
  });
});
