import { test, expect } from '@playwright/test';
import type { E2EFixtures } from '../global-setup';
import { openRoomChat, sendMessage, waitForMessage } from '../helpers/ui-helpers';
import fixtures from '../../.e2e-fixtures.json' assert { type: 'json' };

const fx = fixtures as E2EFixtures;

async function openDmView(page: import('@playwright/test').Page, partnerUsername: string) {
  const contactsBtn = page.locator('button.app-topbar__tab', { hasText: 'Contacts' });
  if (await contactsBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await contactsBtn.click();
  }
  const row = page.locator('.contacts-sidebar__row', { hasText: partnerUsername });
  await row.waitFor({ timeout: 8_000 });
  await row.click();
  await page.waitForSelector('.msg-timeline', { timeout: 8_000 });
}

test.describe('Unread sidebar badges', () => {
  test('shows DM unread badge on contact row when user is outside that DM', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      // Receiver intentionally does NOT open DM view; badge must still work.
      await pageBob.click('button.app-topbar__tab:has-text("Public rooms")');

      await openDmView(pageAlice, fx.bob.username);

      await pageBob.click('button.app-topbar__tab:has-text("Contacts")');
      await pageBob.waitForTimeout(300);

      const msg = `dm-unread-${Date.now()}`;
      await sendMessage(pageAlice, msg);

      const row = pageBob.locator('.contacts-sidebar__row', { hasText: fx.alice.username });
      const badge = row.locator('.app-shell__thread-badge');
      await expect(badge).toBeVisible({ timeout: 8_000 });
      const txt = (await badge.textContent())?.trim() ?? '';
      expect(/^(?:[1-9]|9\+)$/.test(txt)).toBeTruthy();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });

  test('shows room unread badge on room row when user is outside that room chat', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      const roomsTabBob = pageBob.locator('button.app-topbar__tab', { hasText: 'Public rooms' });
      await roomsTabBob.click();

      // Ensure both users are in the room chat at least once (join + tracked sidebar row).
      await openRoomChat(pageAlice, fx.room);
      await openRoomChat(pageBob, fx.room);

      // Bob leaves room chat; incoming room messages should now increment unread.
      await pageBob.click('button.app-topbar__tab:has-text("Contacts")');
      await pageBob.waitForTimeout(300);

      const msg = `room-unread-${Date.now()}`;
      await sendMessage(pageAlice, msg);
      await waitForMessage(pageAlice, msg, { timeout: 8_000 });

      const roomRow = pageBob.locator('.app-shell__thread-row', { hasText: fx.room.name });
      const badge = roomRow.locator('.app-shell__thread-badge');
      await expect(badge).toBeVisible({ timeout: 8_000 });
      const txt = (await badge.textContent())?.trim() ?? '';
      expect(/^(?:[1-9]|9\+)$/.test(txt)).toBeTruthy();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
