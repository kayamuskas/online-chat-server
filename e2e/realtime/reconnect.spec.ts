/**
 * reconnect.spec.ts — UAT #8: Reconnect recovery and history catch-up.
 *
 * Verifies that after a brief simulated disconnect (service worker offline / network
 * toggle via CDP), the active room re-subscribes, refetches missed history, and
 * merges any messages that arrived during the outage.
 *
 * Note: Full network simulation requires Chrome DevTools Protocol (CDP). This test
 * uses Playwright's built-in network interception to simulate a reconnect scenario.
 *
 * Phase 6.1 UAT item: "Reconnect recovery and history catch-up"
 */

import { test, expect } from '@playwright/test';
import {
  createAndSignIn,
  createRoom,
  joinRoom,
} from '../helpers/api-setup';
import {
  signInViaUi,
  openRoomChat,
  sendMessage,
  waitForMessage,
} from '../helpers/ui-helpers';

test.describe('UAT #8 — Reconnect recovery and history catch-up', () => {
  test('messages sent during disconnect appear after reconnect', async ({ browser }) => {
    const alice = await createAndSignIn({ suffix: `alice_recon_${Date.now()}` });
    const bob = await createAndSignIn({ suffix: `bob_recon_${Date.now()}` });
    const room = await createRoom(alice);
    await joinRoom(bob, room.id);

    const ctxAlice = await browser.newContext();
    // Bob uses a context with CDP access for network control
    const ctxBob = await browser.newContext();
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await signInViaUi(pageAlice, alice);
      await signInViaUi(pageBob, bob);
      await openRoomChat(pageAlice, room);
      await openRoomChat(pageBob, room);

      // Send baseline message both can see
      const baseMsg = `base-${Date.now()}`;
      await sendMessage(pageAlice, baseMsg);
      await waitForMessage(pageBob, baseMsg, { timeout: 8_000 });

      // Simulate Bob going offline by blocking all WebSocket/network traffic
      // Using Playwright route interception for the Socket.IO endpoint
      let reconnecting = false;
      await pageBob.route('**/socket.io/**', async (route) => {
        if (reconnecting) {
          await route.continue();
        } else {
          await route.abort('failed');
        }
      });

      // Wait for Socket.IO to detect the disconnect (default timeout ~20s, but
      // the reconnect attempt will fail immediately with our route abort)
      await pageBob.waitForTimeout(1_000);

      // Alice sends a message while Bob is "offline"
      const missedMsg = `missed-${Date.now()}`;
      await sendMessage(pageAlice, missedMsg);

      // Re-enable network traffic (Bob reconnects)
      reconnecting = true;
      await pageBob.unroute('**/socket.io/**');

      // The SocketProvider has a reconnect handler that refetches history.
      // Bob should eventually see the missed message (via REST refetch on reconnect).
      await waitForMessage(pageBob, missedMsg, { timeout: 15_000 });

      const missedMsgEl = pageBob.locator('.msg-bubble__content', { hasText: missedMsg });
      await expect(missedMsgEl).toBeVisible();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
