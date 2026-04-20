/**
 * room-realtime.spec.ts — UAT #2 and #3: Room realtime delivery and edit fanout.
 *
 * UAT #2: A message posted by user-A appears in user-B's room chat view without refresh.
 * UAT #3: An edit by user-A updates the message in-place for user-B without refresh.
 *
 * Both users join the same room in separate browser contexts. The browser sends the
 * HttpOnly chat_session cookie with the Socket.IO handshake, so the server can
 * authenticate and deliver fanout events correctly.
 *
 * Phase 6.1 UAT items: "Room realtime delivery", "Room edit fanout"
 */

import { test, expect, chromium } from '@playwright/test';
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
  waitForEditedMessage,
} from '../helpers/ui-helpers';

test.describe('UAT #2 — Room realtime message delivery', () => {
  test('message sent by alice appears for bob without refresh', async ({ browser }) => {
    // Set up two users and a shared room via API
    const alice = await createAndSignIn({ suffix: `alice_${Date.now()}` });
    const bob = await createAndSignIn({ suffix: `bob_${Date.now()}` });
    const room = await createRoom(alice);
    await joinRoom(bob, room.id);

    // Open two separate browser contexts (independent cookie jars)
    const ctxAlice = await browser.newContext();
    const ctxBob = await browser.newContext();
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      // Both sign in via UI (browser sets chat_session cookie)
      await signInViaUi(pageAlice, alice);
      await signInViaUi(pageBob, bob);

      // Both open the shared room
      await openRoomChat(pageAlice, room);
      await openRoomChat(pageBob, room);

      // Alice sends a message
      const testMsg = `RT-room-create-${Date.now()}`;
      await sendMessage(pageAlice, testMsg);

      // Bob should receive the message via WebSocket without refreshing
      await waitForMessage(pageBob, testMsg, { timeout: 8_000 });

      // Verify the message content is correct in Bob's view
      const msgContent = pageBob.locator('.msg-bubble__content', { hasText: testMsg });
      await expect(msgContent).toBeVisible();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});

test.describe('UAT #3 — Room message edit fanout', () => {
  test('edited message updates in-place for bob without refresh', async ({ browser }) => {
    const alice = await createAndSignIn({ suffix: `alice_edit_${Date.now()}` });
    const bob = await createAndSignIn({ suffix: `bob_edit_${Date.now()}` });
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

      // Alice sends original message
      const originalMsg = `original-${Date.now()}`;
      await sendMessage(pageAlice, originalMsg);

      // Wait for both to see it
      await waitForMessage(pageAlice, originalMsg);
      await waitForMessage(pageBob, originalMsg, { timeout: 8_000 });

      // Alice clicks Edit on her message
      const aliceBubble = pageAlice.locator('.msg-bubble--own', { hasText: originalMsg });
      await aliceBubble.hover();
      await aliceBubble.locator('button', { hasText: 'Edit' }).click();

      // Clear and type new content in the inline editor
      const editInput = pageAlice.locator('.msg-editor__input, [aria-label="Edit message"]');
      await editInput.fill('');
      const editedMsg = `edited-${Date.now()}`;
      await editInput.fill(editedMsg);
      await pageAlice.locator('button', { hasText: 'Save' }).click();

      // Bob should see the edited content with "edited" marker
      await waitForEditedMessage(pageBob, editedMsg, { timeout: 8_000 });

      const editedBubble = pageBob.locator('.msg-bubble', { hasText: editedMsg });
      await expect(editedBubble.locator('.msg-bubble__edited')).toBeVisible();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
