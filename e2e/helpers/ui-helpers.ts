/**
 * ui-helpers.ts — Playwright page interaction helpers for Phase 6.1 E2E tests.
 *
 * Provides sign-in via UI (which sets the HttpOnly chat_session cookie in the
 * browser), navigation to room/DM chat, and message send/receive assertions.
 */

import type { Page } from '@playwright/test';
import type { TestUser, TestRoom } from './api-setup';

/** Sign in to the app via the UI, which causes the browser to receive the HttpOnly cookie. */
export async function signInViaUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/');
  // Wait for the auth shell to appear
  await page.waitForSelector('#signin-email', { timeout: 10_000 });
  await page.fill('#signin-email', user.email);
  await page.fill('#signin-password', user.password);
  await page.click('button[type="submit"]:has-text("Sign in")');
  // After successful sign-in, the app shell should render (not the auth card)
  await page.waitForSelector('.app-shell', { timeout: 10_000 });
}

/**
 * Navigate to a room's chat view.
 * The user must already be a member of the room and signed in.
 * We click the "Public rooms" tab, find the room, then click "Open" or use the sidebar link.
 */
export async function openRoomChat(page: Page, room: TestRoom): Promise<void> {
  // Click "Public rooms" tab
  await page.click('button:has-text("Public rooms")');
  await page.waitForSelector('.rooms-catalog', { timeout: 8_000 });

  // Search for the room by name
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill(room.name);
  }

  // If user is already a member, the sidebar thread list should have the room
  // Try clicking the room in the thread list first
  const threadLink = page.locator('.app-shell__thread-row', { hasText: room.name });
  if (await threadLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await threadLink.click();
  } else {
    // Click the "Join" button in the catalog (in case user is not a member yet)
    const joinBtn = page.locator('.rooms-catalog__row', { hasText: room.name })
      .locator('button', { hasText: /Join|Open|Chat/ });
    await joinBtn.click();
  }

  // Wait for the chat view to appear
  await page.waitForSelector('.msg-timeline', { timeout: 8_000 });
}

/** Send a message in the currently open chat view. */
export async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.locator('[aria-label="Message input"]');
  await input.fill(text);
  // Enter to send (matches the onKeyDown handler in MessageComposer)
  await input.press('Enter');
}

/**
 * Wait for a message with the given text to appear in the timeline.
 * Polls until the message appears or the timeout expires.
 */
export async function waitForMessage(
  page: Page,
  text: string,
  opts?: { timeout?: number },
): Promise<void> {
  await page.waitForFunction(
    (t: string) => {
      const bubbles = document.querySelectorAll('.msg-bubble__content');
      return Array.from(bubbles).some((b) => b.textContent?.includes(t));
    },
    text,
    { timeout: opts?.timeout ?? 8_000 },
  );
}

/**
 * Wait for a message to be updated (edited) in-place.
 * Checks that the new content appears and "edited" marker is present.
 */
export async function waitForEditedMessage(
  page: Page,
  newText: string,
  opts?: { timeout?: number },
): Promise<void> {
  await page.waitForFunction(
    (t: string) => {
      const bubbles = Array.from(document.querySelectorAll('.msg-bubble'));
      return bubbles.some(
        (b) =>
          b.querySelector('.msg-bubble__content')?.textContent?.includes(t) &&
          b.querySelector('.msg-bubble__edited') !== null,
      );
    },
    newText,
    { timeout: opts?.timeout ?? 8_000 },
  );
}
