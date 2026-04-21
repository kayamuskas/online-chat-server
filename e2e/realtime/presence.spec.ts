/** UAT #6 — Presence. Uses global storageState fixtures. */
import { test, expect } from '@playwright/test';
import type { E2EFixtures } from '../global-setup';
import fixtures from '../../.e2e-fixtures.json' assert { type: 'json' };
const fx = fixtures as E2EFixtures;

test.describe('UAT #6 — Presence request-response', () => {
  test('alice shows in bob contacts sidebar after both sign in', async ({ browser }) => {
    const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageAlice = await ctxAlice.newPage();
    const pageBob = await ctxBob.newPage();
    try {
      await pageAlice.goto('/');
      await pageBob.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });
      // Allow presence polling to fire (first emit on socket connect)
      await pageBob.waitForTimeout(6_000);
      const aliceRow = pageBob.locator('.contacts-sidebar__row', { hasText: fx.alice.username });
      await expect(aliceRow).toBeVisible({ timeout: 10_000 });
      // alice is connected → must NOT show as explicitly offline
      const offlineDot = aliceRow.locator('.presence-dot--offline, [title*="offline"]');
      await expect(offlineDot).not.toBeVisible({ timeout: 2_000 });
    } finally {
      await ctxAlice.close();
      await ctxBob.close();
    }
  });

  test('presence updates to online quickly when a contact reconnects', async ({ browser }) => {
    const ctxBob = await browser.newContext({ storageState: '.bob-session.json' });
    const pageBob = await ctxBob.newPage();

    try {
      await pageBob.goto('/');
      await pageBob.waitForSelector('.app-layout', { timeout: 8_000 });

      const aliceRow = pageBob.locator('.contacts-sidebar__row', { hasText: fx.alice.username });
      await expect(aliceRow).toBeVisible({ timeout: 10_000 });
      await expect(aliceRow.locator('.presence-dot--offline')).toBeVisible({ timeout: 10_000 });

      const ctxAlice = await browser.newContext({ storageState: '.alice-session.json' });
      const pageAlice = await ctxAlice.newPage();
      await pageAlice.goto('/');
      await pageAlice.waitForSelector('.app-layout', { timeout: 8_000 });

      await expect(aliceRow.locator('.presence-dot--online')).toBeVisible({ timeout: 10_000 });

      await ctxAlice.close();
    } finally {
      await ctxBob.close();
    }
  });
});
