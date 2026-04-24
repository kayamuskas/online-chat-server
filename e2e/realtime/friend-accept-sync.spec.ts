import { test, expect } from '@playwright/test';
import { createAndSignIn } from '../helpers/api-setup';
import { signInViaUi } from '../helpers/ui-helpers';

test.describe('Friend acceptance sync', () => {
  test('shows the new friend for the original sender without a page refresh after acceptance', async ({ browser }) => {
    const suffix = `fa_${Date.now().toString().slice(-6)}`;
    const alice = await createAndSignIn({ suffix: `${suffix}_a` });
    const bob = await createAndSignIn({ suffix: `${suffix}_b` });

    const ctxAlice = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const ctxBob = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await signInViaUi(pageAlice, alice);
      await signInViaUi(pageBob, bob);

      await pageAlice.locator('button.app-topbar__tab', { hasText: 'Contacts' }).click();
      await pageAlice.locator('button', { hasText: '+ Add contact' }).click();
      await pageAlice.fill('#contact-username', bob.username);
      await pageAlice.locator('button[type="submit"]', { hasText: 'Send request' }).click();

      const aliceContactsRow = pageAlice.locator('.contacts-sidebar__row', { hasText: bob.username });
      await expect(aliceContactsRow).toHaveCount(0);

      await pageBob.locator('button.app-topbar__notif[aria-label="Friend requests"]').click();
      const bobDropdown = pageBob.locator('.notif-dropdown');
      await expect(bobDropdown).toContainText(alice.username);
      await bobDropdown.locator('button', { hasText: 'Accept' }).click();

      await expect(pageAlice.locator('.contacts-sidebar__row', { hasText: bob.username })).toBeVisible({ timeout: 8_000 });
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
