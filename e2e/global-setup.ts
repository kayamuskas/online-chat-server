/**
 * global-setup.ts — Playwright global setup for Phase 6.1 E2E suite.
 *
 * Creates shared test fixtures ONCE before all tests:
 *   - alice + bob: friends, both in sharedRoom, with sharedDm conversation
 *   - Browser sessions saved via storageState so tests skip UI sign-in
 *
 * Fixtures written to:
 *   - .e2e-fixtures.json  — user info (ids, usernames, room/dm ids)
 *   - .alice-session.json — Playwright storageState (cookies)
 *   - .bob-session.json   — Playwright storageState (cookies)
 */

import { chromium } from '@playwright/test';
import {
  createAndSignIn,
  createRoom,
  joinRoom,
  setupFriendship,
  openDm,
} from './helpers/api-setup';
import { createAuthedContext } from './helpers/ui-helpers';
import fs from 'fs';

export interface E2EFixtures {
  alice: { id: string; email: string; username: string; password: string; cookieHeader: string };
  bob: { id: string; email: string; username: string; password: string; cookieHeader: string };
  room: { id: string; name: string };
  dm: { id: string };
}

/**
 * Playwright saves cookies with secure:true even when the server didn't set the Secure
 * flag, due to CDP/Chrome internals. Strip it so cookies are sent over plain HTTP in tests.
 */
function stripSecureFlag(path: string): void {
  const state = JSON.parse(fs.readFileSync(path, 'utf-8')) as {
    cookies: Array<Record<string, unknown>>;
  };
  state.cookies = state.cookies.map((c) => ({ ...c, secure: false }));
  fs.writeFileSync(path, JSON.stringify(state, null, 2));
}

export default async function globalSetup() {
  console.log('\n[E2E global-setup] Creating shared test fixtures…');

  // Use short fixed suffixes so usernames stay ≤ 32 chars and don't collide across runs
  const run = String(Date.now()).slice(-6); // last 6 digits of timestamp

  const alice = await createAndSignIn({ suffix: `al_${run}` });
  const bob = await createAndSignIn({ suffix: `bo_${run}` });

  const room = await createRoom(alice, `e2e-room-${run}`);
  await joinRoom(bob, room.id);

  await setupFriendship(alice, bob);
  const dm = await openDm(alice, bob.id);

  const fixtures: E2EFixtures = { alice, bob, room, dm };
  fs.writeFileSync('.e2e-fixtures.json', JSON.stringify(fixtures, null, 2));

  // Sign each user in via browser ONCE and save their cookie session
  const browser = await chromium.launch({ headless: true });

  const ctxAlice = await createAuthedContext(browser, alice);
  await ctxAlice.storageState({ path: '.alice-session.json' });
  await ctxAlice.close();
  stripSecureFlag('.alice-session.json');

  const ctxBob = await createAuthedContext(browser, bob);
  await ctxBob.storageState({ path: '.bob-session.json' });
  await ctxBob.close();
  stripSecureFlag('.bob-session.json');

  await browser.close();

  console.log(`[E2E global-setup] Done. alice=${alice.username} bob=${bob.username} room=${room.id}`);
}
