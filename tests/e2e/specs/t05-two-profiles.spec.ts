import {
  test,
  expect,
  gotoHarness,
  diResolve,
  newStealthContext,
} from '../fixtures/harness';

test.describe('T5 two profiles', () => {
  test('two browser contexts → two distinct deviceIds', async ({ browser }) => {
    const ctxA = await newStealthContext(browser);
    const ctxB = await newStealthContext(browser);
    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();
      await gotoHarness(pageA);
      await gotoHarness(pageB);

      const a = await diResolve(pageA);
      const b = await diResolve(pageB);

      expect(a.deviceId).toBeTruthy();
      expect(b.deviceId).toBeTruthy();
      expect(b.deviceId).not.toBe(a.deviceId);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
