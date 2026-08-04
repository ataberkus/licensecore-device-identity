import {
  test,
  expect,
  gotoHarness,
  diResolve,
  diBumpUaCh,
} from '../fixtures/harness';

test.describe('T11 UA-CH fullVersionList bump', () => {
  test('fullVersionList bump → deviceId unchanged', async ({ page, browserName }) => {
    test.skip(
      browserName === 'firefox' || browserName === 'webkit',
      'UA-CH getHighEntropyValues is Chromium-only; fullVersionList bump N/A',
    );

    await gotoHarness(page);
    const first = await diResolve(page);

    await diBumpUaCh(page);
    const second = await diResolve(page);
    expect(second.deviceId).toBe(first.deviceId);
    expect(second.isNew).toBe(false);
  });
});
