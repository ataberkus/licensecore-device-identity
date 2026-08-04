import {
  test,
  expect,
  gotoHarness,
  diResolve,
  diWipeAll,
  diApplyUaSpoof,
} from '../fixtures/harness';

test.describe('T9 UA spoof blocks rebind', () => {
  test('UA spoof + patched navigator → spoofScore>40, rebind refuses', async ({
    page,
  }) => {
    await gotoHarness(page);
    const first = await diResolve(page);
    expect(first.deviceId).toBeTruthy();

    await diWipeAll(page);
    await page.waitForTimeout(3_200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoHarness(page);
    await diApplyUaSpoof(page);

    const second = await diResolve(page);
    expect(second.spoofScore).toBeGreaterThan(40);
    expect(second.rebound).toBe(false);
    // Spoof gate enrolls a new device instead of rebinding
    expect(second.deviceId).not.toBe(first.deviceId);
    expect(second.isNew).toBe(true);
  });
});
