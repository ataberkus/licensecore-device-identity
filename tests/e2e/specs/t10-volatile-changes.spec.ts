import {
  test,
  expect,
  gotoHarness,
  diResolve,
  diSetVolatile,
} from '../fixtures/harness';

test.describe('T10 volatile changes', () => {
  test('resize/zoom/tz/lang → deviceId unchanged', async ({ page }) => {
    await gotoHarness(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    const first = await diResolve(page);

    await page.setViewportSize({ width: 800, height: 600 });
    await diSetVolatile(page, {
      languages: ['fr-FR', 'fr'],
      timezone: 'Europe/Paris',
    });

    const second = await diResolve(page);
    expect(second.deviceId).toBe(first.deviceId);
    expect(second.isNew).toBe(false);
    expect(second.rebound).toBe(false);
  });
});
