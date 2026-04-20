/** UAT #7 — Smart autoscroll + new-message pill. Uses global storageState. */
import { test, expect } from '@playwright/test';
import type { E2EFixtures } from '../global-setup';
import { openRoomChat, sendMessage, waitForMessage } from '../helpers/ui-helpers';
import fixtures from '../../.e2e-fixtures.json' assert { type: 'json' };
const fx = fixtures as E2EFixtures;

test.describe('UAT #7 — Smart autoscroll and new-message pill', () => {
  test('pill appears when scrolled up, click scrolls to bottom', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();
    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });
      await openRoomChat(pageAlice, fx.room);
      await openRoomChat(pageBob, fx.room);

      // Fill timeline with history messages
      for (let i = 1; i <= 20; i++) {
        await sendMessage(pageAlice, `Msg ${i}`);
        await pageAlice.waitForTimeout(30);
      }
      await waitForMessage(pageBob, 'Msg 20', { timeout: 10_000 });

      // Bob scrolls up via mouse wheel (real browser event → triggers React onScroll)
      const timeline = pageBob.locator('.msg-timeline');
      await timeline.hover();
      await pageBob.mouse.wheel(0, -5000);
      await pageBob.waitForTimeout(400);

      // Alice sends new message while Bob is scrolled up
      const newMsg = `NEW-${Date.now()}`;
      await sendMessage(pageAlice, newMsg);

      // Pill should appear
      const pill = pageBob.locator('.msg-timeline__new-messages-btn');
      await expect(pill).toBeVisible({ timeout: 8_000 });

      // Timeline should NOT have auto-scrolled
      const scrollTop = await timeline.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeLessThan(100);

      // Click pill → scrolls to bottom, pill disappears
      await pill.click();
      await expect(pill).not.toBeVisible({ timeout: 3_000 });
      await expect(pageBob.locator('.msg-bubble__content', { hasText: newMsg })).toBeVisible();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });

  test('no pill when user is already at bottom', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();
    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });
      await openRoomChat(pageAlice, fx.room);
      await openRoomChat(pageBob, fx.room);

      const msg = `AUTO-${Date.now()}`;
      await sendMessage(pageAlice, msg);
      await waitForMessage(pageBob, msg, { timeout: 8_000 });

      // Pill must NOT appear (Bob was at bottom)
      await expect(pageBob.locator('.msg-timeline__new-messages-btn')).not.toBeVisible({ timeout: 2_000 });
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
