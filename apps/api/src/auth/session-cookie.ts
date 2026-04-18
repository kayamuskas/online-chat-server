/**
 * session-cookie.ts — canonical cookie issuance and clearing policy.
 *
 * One place manages all HttpOnly session cookie semantics:
 *   - Cookie name
 *   - Security flags (HttpOnly, Secure in production, SameSite=Strict)
 *   - Max-Age for persistent vs. transient sessions
 *   - Cookie clearing (sign-out)
 *
 * Controllers and guards must import from this module rather than setting
 * cookies inline, so session semantics cannot drift between handlers.
 */

interface RequestLike {
  cookies?: Record<string, string | undefined>;
}

interface ResponseLike {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
}

/** Name of the session cookie sent to the browser. */
export const SESSION_COOKIE_NAME = 'chat_session';

/**
 * Read the raw session token from the incoming request cookie.
 * Returns null if the cookie is absent or empty.
 */
export function extractSessionToken(req: RequestLike): string | null {
  const value = (req.cookies as Record<string, string | undefined>)[SESSION_COOKIE_NAME];
  if (!value || value.trim() === '') return null;
  return value;
}

export interface SetCookieOptions {
  /** Max-Age in seconds — from buildSessionExpiry().sessionTtlSeconds. */
  maxAge: number;
  /**
   * When false, the cookie is a "session cookie" (browser-close semantics).
   * When true, Max-Age is applied so the cookie survives browser restart.
   */
  persistent: boolean;
}

/**
 * Write the session cookie to the HTTP response.
 *
 * HttpOnly: always (JS must not read the token).
 * Secure: set only outside test environments to allow plain HTTP in dev/QA.
 * SameSite: 'strict' — protects against CSRF.
 */
export function setSessionCookie(res: ResponseLike, token: string, opts: SetCookieOptions): void {
  const isProduction = process.env['NODE_ENV'] === 'production';

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    // For transient sessions: omit maxAge entirely so the browser treats it
    // as a session cookie (cleared on browser close). The server still
    // enforces the 24-hour cap via the session row's expires_at.
    ...(opts.persistent ? { maxAge: opts.maxAge * 1000 } : {}),
    path: '/',
  });
}

/**
 * Clear the session cookie on sign-out.
 *
 * Sends a Set-Cookie header that zeroes out the existing cookie.
 * The cookie options (httpOnly, sameSite, etc.) must match what was set
 * originally, or some browsers ignore the clear request.
 */
export function clearSessionCookie(res: ResponseLike): void {
  const isProduction = process.env['NODE_ENV'] === 'production';

  res.cookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}
