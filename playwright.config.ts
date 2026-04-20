import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Phase 6.1 browser-level WebSocket UAT.
 *
 * Assumes the full stack is running (docker compose up or local dev servers):
 *   - Web:  http://localhost:4173
 *   - API:  http://localhost:3000
 *
 * Run: pnpm exec playwright test
 * Run single: pnpm exec playwright test e2e/realtime/ws-auth.spec.ts
 */
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e',
  fullyParallel: false, // WS realtime tests share a running server
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1, // Sequential to avoid socket fanout cross-test noise
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:4173',
    // Needed so the browser sends the chat_session cookie with every request
    // including the Socket.IO handshake.
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
