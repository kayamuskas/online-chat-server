/** UAT #8 — Reconnect recovery. Uses global storageState. */
import { test, expect } from '@playwright/test';
import type { E2EFixtures } from '../global-setup';
import { openRoomChat, sendMessage, waitForMessage } from '../helpers/ui-helpers';
import fixtures from '../../.e2e-fixtures.json' assert { type: 'json' };
const fx = fixtures as E2EFixtures;

test.describe('UAT #8 — Reconnect recovery and history catch-up', () => {
  test('messages sent during disconnect appear after reconnect', async ({ browser }) => {
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

      const baseMsg = `base-${Date.now()}`;
      await sendMessage(pageAlice, baseMsg);
      await waitForMessage(pageBob, baseMsg, { timeout: 8_000 });

      // Simulate Bob offline: abort socket.io traffic
      let offline = true;
      await pageBob.route('**/socket.io/**', async (route) =>
        offline ? route.abort('failed') : route.continue(),
      );
      await pageBob.waitForTimeout(800);

      const missedMsg = `missed-${Date.now()}`;
      await sendMessage(pageAlice, missedMsg);

      // Reconnect
      offline = false;
      await pageBob.unroute('**/socket.io/**');

      // Bob should get missed message via history refetch on reconnect
      await waitForMessage(pageBob, missedMsg, { timeout: 15_000 });
      await expect(pageBob.locator('.msg-bubble__content', { hasText: missedMsg })).toBeVisible();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
