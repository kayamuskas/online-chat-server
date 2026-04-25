import { test, expect } from '@playwright/test';
import type { E2EFixtures } from '../global-setup';
import { openRoomChat, sendMessage, waitForMessage } from '../helpers/ui-helpers';
import fixtures from '../../.e2e-fixtures.json' assert { type: 'json' };

const fx = fixtures as E2EFixtures;

test.describe('History load button', () => {
  test('clicking "Scroll up for earlier messages" loads older page and moves viewport to top', async ({ browser }) => {
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

      // Ensure more than one page exists (default history page size is 50).
      for (let i = 1; i <= 65; i++) {
        await sendMessage(pageAlice, `history-load-${i}`);
      }
      await waitForMessage(pageAlice, 'history-load-65', { timeout: 10_000 });

      await openRoomChat(pageBob, fx.room);
      await waitForMessage(pageBob, 'history-load-65', { timeout: 10_000 });

      const timeline = pageBob.locator('.msg-timeline');
      const firstItem = timeline.locator('li.msg-bubble').first();
      const beforeFirstWatermark = Number(await firstItem.getAttribute('data-watermark'));
      const beforeTop = await timeline.evaluate((el) => el.scrollTop);

      const loadBtn = pageBob.locator('.chat-divider--clickable');
      await expect(loadBtn).toBeVisible({ timeout: 8_000 });
      await loadBtn.click();

      await expect
        .poll(async () => {
          const value = await firstItem.getAttribute('data-watermark');
          return Number(value);
        }, { timeout: 8_000 })
        .toBeLessThan(beforeFirstWatermark);

      const afterTop = await timeline.evaluate((el) => el.scrollTop);
      expect(afterTop).toBeLessThanOrEqual(beforeTop);
      expect(afterTop).toBeLessThan(40);
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
