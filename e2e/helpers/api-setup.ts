/**
 * api-setup.ts — REST API helpers for Playwright E2E test setup.
 *
 * Creates test users, rooms, friendships, and DM conversations directly via
 * the NestJS API without going through the browser, so tests can start from
 * a known state without wasting time on UI registration flows.
 *
 * All functions accept a `fetch`-compatible function so they work from both
 * Playwright's `request` context and Node.js `fetch`.
 */

const API = 'http://localhost:3000/api/v1';

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  /** Cookie header value like "chat_session=<token>" */
  cookieHeader: string;
}

export interface TestRoom {
  id: string;
  name: string;
}

export interface TestDmConversation {
  id: string;
}

/** Unique suffix so tests don't collide between runs. */
let _seq = 0;
export function uniqueSuffix(): string {
  return `${Date.now()}_${++_seq}`;
}

/**
 * Register a new user and sign in, returning the user info + session cookie.
 *
 * Uses Node.js `fetch` (Node 22+).
 */
export async function createAndSignIn(opts?: { suffix?: string }): Promise<TestUser> {
  const suffix = opts?.suffix ?? uniqueSuffix();
  const email = `e2e_${suffix}@test.local`;
  const username = `e2e_${suffix}`;
  const password = 'TestPass_e2e_1!';

  // Register
  const reg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });
  if (!reg.ok) {
    const body = await reg.text();
    throw new Error(`Register failed (${reg.status}): ${body}`);
  }
  const regBody = (await reg.json()) as { user: { id: string } };
  const userId = regBody.user.id;

  // Sign in to get the session cookie
  const login = await fetch(`${API}/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, keepSignedIn: true }),
  });
  if (!login.ok) {
    const body = await login.text();
    throw new Error(`Sign in failed (${login.status}): ${body}`);
  }
  const rawCookie = login.headers.get('set-cookie') ?? '';
  // Extract "chat_session=<token>" from the set-cookie header
  const cookieHeader = rawCookie.split(';')[0] ?? '';
  if (!cookieHeader.startsWith('chat_session=')) {
    throw new Error(`Expected chat_session cookie, got: ${rawCookie}`);
  }

  return { id: userId, email, username, password, cookieHeader };
}

/**
 * Create a public room as the given user (must be authenticated).
 */
export async function createRoom(user: TestUser, name?: string): Promise<TestRoom> {
  const roomName = name ?? `e2e-room-${uniqueSuffix()}`;
  const res = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: user.cookieHeader,
    },
    body: JSON.stringify({ name: roomName, description: 'E2E test room', is_private: false }),
  });
  if (!res.ok) {
    throw new Error(`Create room failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { room: { id: string; name: string } };
  return { id: body.room.id, name: body.room.name };
}

/**
 * Join a room as the given user.
 */
export async function joinRoom(user: TestUser, roomId: string): Promise<void> {
  const res = await fetch(`${API}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { Cookie: user.cookieHeader },
  });
  if (!res.ok && res.status !== 409) {
    // 409 = already a member, which is fine
    throw new Error(`Join room failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Set up a friendship between two users (alice sends request, bob accepts).
 */
export async function setupFriendship(alice: TestUser, bob: TestUser): Promise<void> {
  // Alice sends friend request to Bob by username
  const reqRes = await fetch(`${API}/contacts/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: alice.cookieHeader,
    },
    body: JSON.stringify({ targetUsername: bob.username }),
  });
  if (!reqRes.ok) {
    throw new Error(`Send friend request failed (${reqRes.status}): ${await reqRes.text()}`);
  }
  const reqBody = (await reqRes.json()) as { request: { id: string } };
  const requestId = reqBody.request.id;

  // Bob accepts
  const acceptRes = await fetch(`${API}/contacts/requests/${requestId}/accept`, {
    method: 'POST',
    headers: { Cookie: bob.cookieHeader },
  });
  if (!acceptRes.ok) {
    throw new Error(`Accept friend request failed (${acceptRes.status}): ${await acceptRes.text()}`);
  }
}

/**
 * Open a DM conversation between two friends.
 * Returns the conversation ID.
 */
export async function openDm(alice: TestUser, bobId: string): Promise<TestDmConversation> {
  const res = await fetch(`${API}/contacts/dm/${bobId}`, {
    method: 'POST',
    headers: { Cookie: alice.cookieHeader },
  });
  if (!res.ok) {
    throw new Error(`Open DM failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { conversation: { id: string } };
  return { id: body.conversation.id };
}
