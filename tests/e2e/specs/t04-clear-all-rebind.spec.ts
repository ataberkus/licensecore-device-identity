import { countEvents } from '../fixtures/db';
import {
  test,
  expect,
  gotoHarness,
  diResolve,
  diWipeAll,
  diCollect,
} from '../fixtures/harness';

test.describe('T4 clear ALL site data → rebind', () => {
  test('rebound=true, original deviceId, rebind event', async ({ page }) => {
    await gotoHarness(page);
    const first = await diResolve(page);
    expect(first.deviceId).toBeTruthy();
    expect(first.isNew).toBe(true);
    const before = await diCollect(page);

    await diWipeAll(page);
    // Allow REBIND_MIN_IDLE_MS so this looks like wipe-recovery, not a 2nd profile.
    await page.waitForTimeout(3_200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await gotoHarness(page);

    const after = await diCollect(page);
    const changed: string[] = [];
    for (const [id, entry] of Object.entries(before.componentHashes)) {
      if (entry.class !== 'S') continue;
      const next = after.componentHashes[id];
      if (!next || next.error || entry.error) {
        if (entry.error !== next?.error) changed.push(`${id}:error`);
        continue;
      }
      if (next.h !== entry.h) changed.push(id);
    }

    const second = await diResolve(page);
    expect(
      second.deviceId,
      `rebind failed (spoof=${second.spoofScore} rebound=${second.rebound} conf=${second.confidence} changedS=[${changed.join(',')}] integrity=${JSON.stringify(after.integrity)})`,
    ).toBe(first.deviceId);
    expect(second.isNew).toBe(false);
    expect(second.rebound).toBe(true);

    const rebindEvents = countEvents(first.deviceId, 'rebind');
    expect(rebindEvents).toBeGreaterThanOrEqual(1);
  });
});
