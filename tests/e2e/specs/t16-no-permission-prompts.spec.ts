import {
  test,
  expect,
  gotoHarness,
  diCollect,
  diResolve,
  permissionPromptCount,
} from '../fixtures/harness';

test.describe('T16 zero permission prompts', () => {
  test('collect+resolve never triggers permission prompts', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.dismiss();
    });

    // Deny any permission request via Playwright if browser surfaces one
    await page.context().grantPermissions([]);

    await gotoHarness(page);
    const before = await permissionPromptCount(page);
    await diCollect(page);
    await diResolve(page);
    const after = await permissionPromptCount(page);

    expect(dialogs, 'no window dialogs').toEqual([]);
    expect(after - before, 'no permissions.query during collect/resolve').toBe(
      0,
    );
  });
});
