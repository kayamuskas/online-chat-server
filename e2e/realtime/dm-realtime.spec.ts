/**
 * dm-realtime.spec.ts — UAT #4 and #5: DM realtime delivery and edit fanout.
 *
 * UAT #4: A DM sent by user-A appears in user-B's DM view without refresh.
 * UAT #5: A DM edit by user-A updates the message in-place for user-B.
 *
 * Requires:
 *   - Both users are friends (setupFriendship)
 *   - DM conversation is open (openDm)
 *   - Both users are viewing the DM conversation in separate browser contexts
 *
 * Phase 6.1 UAT items: "DM realtime delivery", "DM edit fanout"
 */

import { test, expect } from '@playwright/test';
import {
  createAndSignIn,
  setupFriendship,
  openDm,
} from '../helpers/api-setup';
import {
  signInViaUi,
  sendMessage,
  waitForMessage,
  waitForEditedMessage,
} from '../helpers/ui-helpers';

/** Navigate to the DM conversation view with the given partner. */
async function openDmView(
  page: import('@playwright/test').Page,
  partnerUsername: string,
): Promise<void> {
  // Click the contact in the contacts sidebar or use the DM tab
  // The contacts sidebar shows friends with a DM button
  const dmButton = page.locator('.contact-row', { hasText: partnerUsername })
    .locator('button, [aria-label*="DM"], [aria-label*="Message"]');

  if (await dmButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await dmButton.click();
  } else {
    // Fallback: find DM thread in sidebar
    const threadLink = page.locator('.app-shell__thread-row', { hasText: partnerUsername });
    await threadLink.click({ timeout: 5_000 });
  }

  await page.waitForSelector('.msg-timeline', { timeout: 8_000 });
}

test.describe('UAT #4 — DM realtime message delivery', () => {
  test('DM sent by alice appears for bob without refresh', async ({ browser }) => {
    const alice = await createAndSignIn({ suffix: `alice_dm_${Date.now()}` });
    const bob = await createAndSignIn({ suffix: `bob_dm_${Date.now()}` });

    await setupFriendship(alice, bob);
    await openDm(alice, bob.id);

    const ctxAlice = await browser.newContext();
    const ctxBob = await browser.newContext();
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await signInViaUi(pageAlice, alice);
      await signInViaUi(pageBob, bob);

      // Open the DM view for both
      await openDmView(pageAlice, bob.username);
      await openDmView(pageBob, alice.username);

      // Alice sends a DM
      const testMsg = `DM-realtime-${Date.now()}`;
      await sendMessage(pageAlice, testMsg);

      // Bob should receive it via WebSocket
      await waitForMessage(pageBob, testMsg, { timeout: 8_000 });

      const msgContent = pageBob.locator('.msg-bubble__content', { hasText: testMsg });
      await expect(msgContent).toBeVisible();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});

test.describe('UAT #5 — DM message edit fanout', () => {
  test('edited DM message updates in-place for bob without refresh', async ({ browser }) => {
    const alice = await createAndSignIn({ suffix: `alice_dmedit_${Date.now()}` });
    const bob = await createAndSignIn({ suffix: `bob_dmedit_${Date.now()}` });

    await setupFriendship(alice, bob);
    await openDm(alice, bob.id);

    const ctxAlice = await browser.newContext();
    const ctxBob = await browser.newContext();
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await signInViaUi(pageAlice, alice);
      await signInViaUi(pageBob, bob);

      await openDmView(pageAlice, bob.username);
      await openDmView(pageBob, alice.username);

      // Alice sends original DM
      const originalMsg = `dm-original-${Date.now()}`;
      await sendMessage(pageAlice, originalMsg);

      await waitForMessage(pageAlice, originalMsg);
      await waitForMessage(pageBob, originalMsg, { timeout: 8_000 });

      // Alice edits her message
      const aliceBubble = pageAlice.locator('.msg-bubble--own', { hasText: originalMsg });
      await aliceBubble.hover();
      await aliceBubble.locator('button', { hasText: 'Edit' }).click();

      const editInput = pageAlice.locator('.msg-editor__input, [aria-label="Edit message"]');
      const editedMsg = `dm-edited-${Date.now()}`;
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
