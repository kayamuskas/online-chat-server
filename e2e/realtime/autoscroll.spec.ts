/**
 * autoscroll.spec.ts — UAT #7: Smart autoscroll and "↓ New messages" pill.
 *
 * Verifies that when a user scrolls up in the message timeline:
 *   1. New messages arriving via WebSocket do NOT yank the viewport.
 *   2. The "↓ New messages" button appears.
 *   3. Clicking the button scrolls back to the bottom.
 *
 * Phase 6.1 UAT item: "Smart autoscroll and new-message pill"
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

test.describe('UAT #7 — Smart autoscroll and new-message pill', () => {
  test('new message pill appears when user is scrolled up, click scrolls to bottom', async ({
    browser,
  }) => {
    const alice = await createAndSignIn({ suffix: `alice_scroll_${Date.now()}` });
    const bob = await createAndSignIn({ suffix: `bob_scroll_${Date.now()}` });
    const room = await createRoom(alice);
    await joinRoom(bob, room.id);

    const ctxAlice = await browser.newContext();
    const ctxBob = await browser.newContext();
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await signInViaUi(pageAlice, alice);
      await signInViaUi(pageBob, bob);
      await openRoomChat(pageAlice, room);
      await openRoomChat(pageBob, room);

      // Alice sends several messages to fill the timeline
      for (let i = 1; i <= 15; i++) {
        await sendMessage(pageAlice, `History message ${i}`);
        await pageAlice.waitForTimeout(50); // Small delay to ensure ordering
      }

      // Wait for Bob to see messages so the timeline is populated
      await waitForMessage(pageBob, 'History message 15', { timeout: 10_000 });

      // Bob scrolls UP to simulate reading history
      const timeline = pageBob.locator('.msg-timeline');
      await timeline.evaluate((el) => {
        el.scrollTop = 0; // Scroll to top (reading old messages)
      });

      // Wait a moment so the isScrolledUp state registers
      await pageBob.waitForTimeout(300);

      // Alice sends a new message while Bob is scrolled up
      const newMsg = `NEW-${Date.now()}`;
      await sendMessage(pageAlice, newMsg);

      // Bob should see the "↓ New messages" pill (not be scrolled to it)
      const pill = pageBob.locator('.msg-timeline__new-messages-btn');
      await expect(pill).toBeVisible({ timeout: 8_000 });
      await expect(pill).toHaveText(/New messages/i);

      // Verify Bob's timeline did NOT scroll automatically (still showing top)
      const scrollTop = await timeline.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeLessThan(100); // Still near the top

      // Bob clicks the pill → should scroll to bottom
      await pill.click();

      // Pill should disappear after scroll
      await expect(pill).not.toBeVisible({ timeout: 3_000 });

      // The new message should now be visible
      const newMsgEl = pageBob.locator('.msg-bubble__content', { hasText: newMsg });
      await expect(newMsgEl).toBeVisible({ timeout: 3_000 });
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });

  test('timeline auto-scrolls when user is already at bottom', async ({ browser }) => {
    const alice = await createAndSignIn({ suffix: `alice_autoscroll_${Date.now()}` });
    const bob = await createAndSignIn({ suffix: `bob_autoscroll_${Date.now()}` });
    const room = await createRoom(alice);
    await joinRoom(bob, room.id);

    const ctxAlice = await browser.newContext();
    const ctxBob = await browser.newContext();
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await signInViaUi(pageAlice, alice);
      await signInViaUi(pageBob, bob);
      await openRoomChat(pageAlice, room);
      await openRoomChat(pageBob, room);

      // Bob is at bottom (default). Alice sends a message.
      const autoMsg = `AUTO-${Date.now()}`;
      await sendMessage(pageAlice, autoMsg);

      // Bob should receive it and the timeline should auto-scroll (pill should NOT appear)
      await waitForMessage(pageBob, autoMsg, { timeout: 8_000 });

      const pill = pageBob.locator('.msg-timeline__new-messages-btn');
      // Pill should NOT be visible since Bob was already at bottom
      const pillVisible = await pill.isVisible({ timeout: 1_000 }).catch(() => false);
      expect(pillVisible).toBe(false);
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
