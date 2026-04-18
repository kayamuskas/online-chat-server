/**
 * Phase 3 API client — auth flows + session management.
 *
 * All requests are made to the NestJS API running on SERVICE_PORTS.apiHttp.
 * Credentials (session cookies) are sent with every request via credentials: "include".
 *
 * Covers:
 *   POST   /api/v1/auth/register
 *   POST   /api/v1/auth/sign-in
 *   POST   /api/v1/auth/sign-out
 *   GET    /api/v1/auth/me
 *   POST   /api/v1/auth/change-password
 *   POST   /api/v1/auth/password-reset/request
 *   POST   /api/v1/auth/password-reset/confirm
 *   GET    /api/v1/sessions
 *   DELETE /api/v1/sessions/others
 *   DELETE /api/v1/sessions/:id
 */

import { SERVICE_PORTS } from "@chat/shared";

const BASE_URL = `http://localhost:${SERVICE_PORTS.apiHttp}/api/v1`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

/**
 * A session inventory item as returned by GET /api/v1/sessions.
 * Mirrors SessionInventoryItem from the API auth.types.ts.
 */
export interface SessionInventoryItem {
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  isPersistent: boolean;
  isCurrentSession: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }

  const data = await res.json();

  if (!res.ok) {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }

  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
  });

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }

  const data = await res.json();

  if (!res.ok) {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }

  return data as T;
}

// ── Auth API calls ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Returns the newly created user. Throws on duplicate email/username (409).
 */
export async function register(params: {
  email: string;
  username: string;
  password: string;
}): Promise<{ user: PublicUser }> {
  return post("/auth/register", params);
}

/**
 * POST /api/v1/auth/sign-in
 * Issues a session cookie. Returns the authenticated user.
 */
export async function signIn(params: {
  email: string;
  password: string;
  keepSignedIn: boolean;
}): Promise<{ user: PublicUser }> {
  return post("/auth/sign-in", params);
}

/**
 * POST /api/v1/auth/sign-out
 * Invalidates the current browser session. Returns undefined (204).
 */
export async function signOut(): Promise<void> {
  return post("/auth/sign-out");
}

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user or throws 401.
 */
export async function me(): Promise<{ user: PublicUser }> {
  return get("/auth/me");
}

/**
 * POST /api/v1/auth/change-password
 * Requires current session + current password verification. Returns undefined (204).
 */
export async function changePassword(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  return post("/auth/change-password", params);
}

/**
 * POST /api/v1/auth/password-reset/request
 * Silently enqueues a reset mail artifact. Always returns 200.
 */
export async function requestPasswordReset(params: {
  email: string;
}): Promise<void> {
  return post("/auth/password-reset/request", params);
}

/**
 * POST /api/v1/auth/password-reset/confirm
 * Validates one-time token and updates the password.
 */
export async function confirmPasswordReset(params: {
  token: string;
  newPassword: string;
}): Promise<void> {
  return post("/auth/password-reset/confirm", params);
}

// ── Session management API calls ──────────────────────────────────────────────

/**
 * GET /api/v1/sessions
 * Returns the active session inventory for the current user.
 * Current session is first; isCurrentSession marks "This browser".
 */
export async function listSessions(): Promise<{ sessions: SessionInventoryItem[] }> {
  return get("/sessions");
}

/**
 * DELETE /api/v1/sessions/others
 * Signs out all other sessions. Current session is preserved. Returns undefined (204).
 */
export async function revokeOtherSessions(): Promise<void> {
  const res = await fetch(`${BASE_URL}/sessions/others`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
}

/**
 * DELETE /api/v1/sessions/:id
 * Revokes a specific session by ID.
 * If the revoked session is the current one, the server clears the cookie.
 * Returns undefined (204).
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
}
