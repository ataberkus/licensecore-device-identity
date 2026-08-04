import {
  test,
  expect,
  gotoHarness,
  diCollect,
  diResolve,
  diResolveWithEvidence,
  diWipeAll,
  newStealthContext,
} from '../fixtures/harness';

test.describe('T8 stolen fingerprint', () => {
  test('stolen EvidenceBundle + fresh anchor → not victim high-confidence', async ({
    browser,
  }) => {
    const victimCtx = await newStealthContext(browser);
    const attackerCtx = await newStealthContext(browser);
    try {
      const victimPage = await victimCtx.newPage();
      await gotoHarness(victimPage);
      const victim = await diResolve(victimPage);
      const stolen = await diCollect(victimPage);
      expect(victim.confidence === 'high' || victim.confidence === 'medium').toBe(
        true,
      );

      const attackerPage = await attackerCtx.newPage();
      await gotoHarness(attackerPage);
      // Fresh profile / fresh anchor; present victim's evidence hashes
      await diWipeAll(attackerPage);
      await attackerPage.reload({ waitUntil: 'domcontentloaded' });
      await gotoHarness(attackerPage);

      const attack = await diResolveWithEvidence(attackerPage, stolen);

      // Must not high-confidence recognize as victim via stolen evidence alone.
      // Rebind (medium) or new enroll are acceptable; high+same id is not.
      if (attack.deviceId === victim.deviceId) {
        expect(attack.confidence).not.toBe('high');
        expect(attack.rebound === true || attack.confidence === 'medium').toBe(
          true,
        );
      } else {
        expect(attack.deviceId).not.toBe(victim.deviceId);
      }
    } finally {
      await victimCtx.close();
      await attackerCtx.close();
    }
  });
});
