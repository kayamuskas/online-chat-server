/**
 * dm-realtime.spec.ts — UAT #4 and #5: DM realtime delivery and edit fanout.
 * Uses global fixtures (storageState) to avoid rate limiting.
 */

import { test, expect } from '@playwright/test';
import type { E2EFixtures } from '../global-setup';
import { sendMessage, waitForMessage, waitForEditedMessage } from '../helpers/ui-helpers';
import fixtures from '../../.e2e-fixtures.json' assert { type: 'json' };

const fx = fixtures as E2EFixtures;

/** Open DM with partner via contacts sidebar "Msg" button. */
async function openDmView(page: import('@playwright/test').Page, partnerUsername: string) {
  // Click Contacts nav button to ensure sidebar is showing friends
  const contactsBtn = page.locator('button.app-topbar__tab', { hasText: 'Contacts' });
  if (await contactsBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await contactsBtn.click();
  }
  // Find the contact row in the sidebar and click its "Msg" button
  const row = page.locator('.contacts-sidebar__row', { hasText: partnerUsername });
  await row.waitFor({ timeout: 8_000 });
  await row.locator('button', { hasText: 'Msg' }).click();
  await page.waitForSelector('.msg-timeline', { timeout: 8_000 });
}

test.describe('UAT #4 — DM realtime message delivery', () => {
  test('DM sent by alice appears for bob without refresh', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      await openDmView(pageAlice, fx.bob.username);
      await openDmView(pageBob, fx.alice.username);

      const testMsg = `DM-${Date.now()}`;
      await sendMessage(pageAlice, testMsg);

      await waitForMessage(pageBob, testMsg, { timeout: 8_000 });
      await expect(pageBob.locator('.msg-bubble__content', { hasText: testMsg })).toBeVisible();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});

test.describe('UAT #5 — DM message edit fanout', () => {
  test('edited DM updates in-place for bob without refresh', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();

    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      await openDmView(pageAlice, fx.bob.username);
      await openDmView(pageBob, fx.alice.username);

      const originalMsg = `dm-orig-${Date.now()}`;
      await sendMessage(pageAlice, originalMsg);
      await waitForMessage(pageAlice, originalMsg);
      await waitForMessage(pageBob, originalMsg, { timeout: 8_000 });

      const aliceBubble = pageAlice.locator('.msg-bubble--own', { hasText: originalMsg });
      await aliceBubble.hover();
      await aliceBubble.locator('button', { hasText: 'Edit' }).click();

      const editedMsg = `dm-edited-${Date.now()}`;
      const editInput = pageAlice.locator('[aria-label="Edit message"], .msg-editor__input').first();
      await editInput.fill(editedMsg);
      await pageAlice.locator('button', { hasText: 'Save' }).click();

      await waitForEditedMessage(pageBob, editedMsg, { timeout: 8_000 });
      await expect(
        pageBob.locator('.msg-bubble', { hasText: editedMsg }).locator('.msg-bubble__edited'),
      ).toBeVisible();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});
