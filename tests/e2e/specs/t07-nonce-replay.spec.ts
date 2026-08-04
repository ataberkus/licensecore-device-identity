import {
  test,
  expect,
  gotoHarness,
  diCaptureResolve,
  diReplay,
} from '../fixtures/harness';

test.describe('T7 nonce replay', () => {
  test('replay resolve body → 400 or 401', async ({ page }) => {
    await gotoHarness(page);
    const { request } = await diCaptureResolve(page);
    const replay = await diReplay(page, request);
    expect([400, 401]).toContain(replay.status);
    expect(replay.ok).toBe(false);
  });
});
