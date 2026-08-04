import {
  test,
  expect,
  gotoHarness,
  diResolve,
  newStealthContext,
} from '../fixtures/harness';

/**
 * T14 — Incognito / ephemeral context.
 * Distinct id vs normal context is required.
 * `privateContext` is a best-effort heuristic — documented as not guaranteed.
 */
test.describe('T14 incognito / private context', () => {
  test('ephemeral context → distinct id; privateContext flagged when detected', async ({
    browser,
    page,
  }) => {
    await gotoHarness(page);
    const normal = await diResolve(page);

    const incognito = await newStealthContext(browser);
    try {
      const iPage = await incognito.newPage();
      await gotoHarness(iPage);
      const priv = await diResolve(iPage);

      expect(priv.deviceId).toBeTruthy();
      expect(priv.deviceId).not.toBe(normal.deviceId);

      // Soft assertion: record whether privateContext was set (see LIMITATIONS.md)
      test.info().annotations.push({
        type: 'privateContext',
        description: String(priv.privateContext === true),
      });
    } finally {
      await incognito.close();
    }
  });
});
