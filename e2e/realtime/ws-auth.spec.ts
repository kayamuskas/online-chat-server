/**
 * ws-auth.spec.ts — UAT #1: Authenticated socket handshake.
 *
 * Verifies that after signing in via the browser UI (which sets the HttpOnly
 * chat_session cookie), the Socket.IO client connects successfully.
 *
 * This is the browser-level proof that:
 *   - The cookie-name fix (ws-auth.ts imports SESSION_COOKIE_NAME) works end-to-end.
 *   - The browser automatically includes the session cookie in the WS handshake.
 *   - The app shell renders and stays stable (no forced redirect back to auth).
 *
 * Phase 6.1 UAT item: "Authenticated socket handshake"
 */

import { test, expect } from '@playwright/test';
import { createAndSignIn } from '../helpers/api-setup';
import { signInViaUi } from '../helpers/ui-helpers';

test.describe('UAT #1 — Authenticated socket handshake', () => {
  test('browser sends session cookie and app shell loads after sign-in', async ({ page }) => {
    const user = await createAndSignIn();

    // Track any socket-related console errors before sign-in
    const socketErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') socketErrors.push(msg.text());
    });

    // Track Socket.IO handshake request
    let wsHandshakeStatus = 0;
    page.on('response', (response) => {
      if (response.url().includes('/socket.io/') && response.url().includes('EIO=4')) {
        wsHandshakeStatus = response.status();
      }
    });

    await signInViaUi(page, user);

    // Allow socket handshake to complete
    await page.waitForTimeout(2_000);

    // App layout must be stable (not redirected back to auth)
    await expect(page.locator('.app-layout')).toBeVisible();
    await expect(page.locator('#signin-email')).not.toBeVisible();

    // Socket.IO polling handshake must succeed (HTTP 200)
    // A 401/403 here would indicate the cookie-name bug is back
    expect(wsHandshakeStatus).toBe(200);

    // No console errors
    expect(socketErrors).toHaveLength(0);
  });

  test('unauthenticated page visit shows auth form (no app shell)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#signin-email', { timeout: 8_000 });
    await expect(page.locator('.app-layout')).not.toBeVisible();
  });
});
