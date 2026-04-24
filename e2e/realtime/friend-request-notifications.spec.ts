import { test, expect } from '@playwright/test';
import { createAndSignIn } from '../helpers/api-setup';
import { signInViaUi } from '../helpers/ui-helpers';

test.describe('Friend request notifications', () => {
  test('updates the topbar badge live when another user sends a friend request', async ({ browser }) => {
    const suffix = `fr_${Date.now().toString().slice(-6)}`;
    const alice = await createAndSignIn({ suffix: `${suffix}_a` });
    const bob = await createAndSignIn({ suffix: `${suffix}_b` });

    const ctxBob = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const ctxAlice = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const pageBob = await ctxBob.newPage();
    const pageAlice = await ctxAlice.newPage();

    try {
      await signInViaUi(pageBob, bob);
      await signInViaUi(pageAlice, alice);

      const bobBell = pageBob.locator('button.app-topbar__notif[aria-label="Friend requests"]');
      await expect(bobBell.locator('.notif-badge')).toHaveCount(0);

      await pageAlice.locator('button.app-topbar__tab', { hasText: 'Contacts' }).click();
      await pageAlice.locator('button', { hasText: '+ Add contact' }).click();
      await pageAlice.fill('#contact-username', bob.username);
      await pageAlice.fill('#contact-message', 'hello from playwright');
      await pageAlice.locator('button[type="submit"]', { hasText: 'Send request' }).click();

      const badge = bobBell.locator('.notif-badge');
      await expect(badge).toBeVisible({ timeout: 8_000 });
      await expect(badge).toHaveText('1');

      await bobBell.click();
      const dropdown = pageBob.locator('.notif-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 8_000 });
      await expect(dropdown).toContainText(alice.username);
      await expect(dropdown).toContainText('hello from playwright');
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
