import {
  test,
  expect,
  gotoHarness,
  diResolve,
  diClearCookiesLs,
} from '../fixtures/harness';

test.describe('T3 clear cookies+localStorage', () => {
  test('IDB intact → same id, isNew=false, rebound=false', async ({ page }) => {
    await gotoHarness(page);
    const first = await diResolve(page);
    expect(first.deviceId).toBeTruthy();

    await diClearCookiesLs(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoHarness(page);

    const second = await diResolve(page);
    expect(second.deviceId).toBe(first.deviceId);
    expect(second.isNew).toBe(false);
    expect(second.rebound).toBe(false);
  });
});
