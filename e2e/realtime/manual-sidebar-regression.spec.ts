import { test, expect } from '@playwright/test';
import { createRealtimeFixture } from '../helpers/api-setup';
import { createAuthedContext, openRoomChat, sendMessage, waitForMessage } from '../helpers/ui-helpers';

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

test.describe('Manual sidebar regression', () => {
  test.setTimeout(45_000);

  test('keeps app shell rendered and updates presence plus unread badges across contacts and rooms', async ({ browser }) => {
    const fx = await createRealtimeFixture({ suffix: `ms_${Date.now().toString().slice(-6)}` });
    const ctxAlice = await createAuthedContext(browser, fx.alice);
    const ctxBob = await createAuthedContext(browser, fx.bob);
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      await expect(pageAlice.locator('.app-layout')).toBeVisible();
      await expect(pageBob.locator('.app-layout')).toBeVisible();

      await pageBob.click('button.app-topbar__tab:has-text("Contacts")');
      const aliceRow = pageBob.locator('.contacts-sidebar__row', { hasText: fx.alice.username });
      await expect(aliceRow).toBeVisible({ timeout: 10_000 });
      await expect(aliceRow.locator('.presence-dot--online')).toBeVisible({ timeout: 10_000 });

      await openDmView(pageAlice, fx.bob.username);
      await openDmView(pageBob, fx.alice.username);

      const warmupDm = `dm-manual-warmup-${Date.now()}`;
      await sendMessage(pageAlice, warmupDm);
      await waitForMessage(pageBob, warmupDm, { timeout: 8_000 });

      await pageBob.click('button.app-topbar__tab:has-text("Account")');
      await pageBob.waitForTimeout(300);

      const dmUnreadMessage = `dm-manual-unread-${Date.now()}`;
      await sendMessage(pageAlice, dmUnreadMessage);

      await pageBob.click('button.app-topbar__tab:has-text("Contacts")');
      const dmBadge = aliceRow.locator('.app-shell__thread-badge');
      await expect(dmBadge).toBeVisible({ timeout: 8_000 });
      await expect(dmBadge).toHaveText(/^(?:[1-9]|9\+)$/);

      await openRoomChat(pageAlice, fx.room);
      await openRoomChat(pageBob, fx.room);
      await pageBob.click('button.app-topbar__tab:has-text("Contacts")');
      await pageBob.waitForTimeout(300);

      const roomUnreadMessage = `room-manual-unread-${Date.now()}`;
      await sendMessage(pageAlice, roomUnreadMessage);
      await waitForMessage(pageAlice, roomUnreadMessage, { timeout: 8_000 });

      const roomRow = pageBob.locator('.app-shell__thread-row', { hasText: fx.room.name });
      const roomBadge = roomRow.locator('.app-shell__thread-badge');
      await expect(roomBadge).toBeVisible({ timeout: 8_000 });
      await expect(roomBadge).toHaveText(/^(?:[1-9]|9\+)$/);
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
