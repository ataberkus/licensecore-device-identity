import {
  test,
  expect,
  gotoHarness,
  diResolve,
  diCollect,
} from '../fixtures/harness';

test.describe('T1 reload stability', () => {
  test('25 reloads → same deviceId', async ({ page }) => {
    await gotoHarness(page);
    const first = await diResolve(page);
    expect(first.deviceId).toBeTruthy();
    expect(first.anchorTier).toBeLessThanOrEqual(2);

    const evidence = await diCollect(page);
    expect(evidence.profile).toBe('stable');
    expect(evidence.componentHashes.font_metrics).toBeUndefined();
    expect(evidence.componentHashes.ua_string).toBeUndefined();
    expect(evidence.componentHashes.math_fp).toBeDefined();

    for (let i = 0; i < 24; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await gotoHarness(page);
      const next = await diResolve(page);
      expect(next.deviceId, `reload ${i + 2}`).toBe(first.deviceId);
      expect(next.isNew).toBe(false);
      expect(next.rebound).toBe(false);
    }
  });
});
