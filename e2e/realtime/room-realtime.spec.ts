/**
 * room-realtime.spec.ts — UAT #2 and #3: Room realtime delivery and edit fanout.
 * Uses global fixtures (storageState) to avoid repeated sign-in and rate limiting.
 */

import { test, expect } from '@playwright/test';
import type { E2EFixtures } from '../global-setup';
import { openRoomChat, sendMessage, waitForMessage, waitForEditedMessage } from '../helpers/ui-helpers';
import fixtures from '../../.e2e-fixtures.json' assert { type: 'json' };

const fx = fixtures as E2EFixtures;

test.describe('UAT #2 — Room realtime message delivery', () => {
  test('message sent by alice appears for bob without refresh', async ({ browser }) => {
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

      const testMsg = `RT-room-${Date.now()}`;
      await sendMessage(pageAlice, testMsg);

      await waitForMessage(pageBob, testMsg, { timeout: 8_000 });
      await expect(pageBob.locator('.msg-bubble__content', { hasText: testMsg })).toBeVisible();
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });
});

test.describe('UAT #3 — Room message edit fanout', () => {
  test('edited message updates in-place for bob without refresh', async ({ browser }) => {
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

      const originalMsg = `orig-${Date.now()}`;
      await sendMessage(pageAlice, originalMsg);
      await waitForMessage(pageAlice, originalMsg);
      await waitForMessage(pageBob, originalMsg, { timeout: 8_000 });

      // Alice edits her message via inline editor
      const aliceBubble = pageAlice.locator('.msg-bubble--own', { hasText: originalMsg });
      await aliceBubble.hover();
      await aliceBubble.locator('button', { hasText: 'Edit' }).click();

      const editedMsg = `edited-${Date.now()}`;
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
