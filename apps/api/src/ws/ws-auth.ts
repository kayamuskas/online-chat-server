/**
 * ws-auth — WebSocket session token extraction helper.
 *
 * Parses the session cookie from a Socket.IO handshake to extract the
 * opaque session token used by the HTTP auth layer.
 *
 * Threat model: T-03-05 — presence sockets must not bypass the existing
 * auth/session boundary. This helper enforces that by extracting the same
 * session cookie the HTTP guards rely on.
 *
 * Cookie name: 'session' (matches the cookie set by auth.controller.ts)
 */

import type { Socket } from 'socket.io';

const SESSION_COOKIE_NAME = 'session';

/**
 * Parse a raw cookie header string and extract the named cookie value.
 * Returns undefined if the cookie is not found.
 */
function parseCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key?.trim() === name) {
      return rest.join('=').trim() || undefined;
    }
  }
  return undefined;
}

/**
 * Extract the session token from the socket's handshake cookie header.
 * Returns null if no session cookie is present.
 */
export function extractSessionToken(socket: Socket): string | null {
  const cookieHeader = socket.handshake.headers['cookie'];
  if (!cookieHeader) return null;

  const value = parseCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  return value ?? null;
}
