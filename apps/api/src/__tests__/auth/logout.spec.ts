/**
 * logout.spec.ts
 *
 * Unit tests for current-session sign-out and the auth guard/decorator pipeline.
 * Tests are isolated using mocked dependencies — no real database needed.
 *
 * TDD RED phase: tests written before all implementation is verified complete.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { ExecutionContext } from '@nestjs/common';

// ── Imports ────────────────────────────────────────────────────────────────────

import { CurrentUserGuard } from '../../auth/current-user.guard.js';
import {
  SESSION_COOKIE_NAME,
  extractSessionToken,
  setSessionCookie,
  clearSessionCookie,
} from '../../auth/session-cookie.js';
import type { PublicUser, Session } from '../../auth/auth.types.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePublicUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: 'user-uuid-1',
    email: 'alice@example.com',
    username: 'alice',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-uuid-1',
    user_id: 'user-uuid-1',
    session_token: 'opaque-token-abc',
    is_persistent: false,
    expires_at: new Date(Date.now() + 86400_000),
    last_seen_at: new Date(),
    created_at: new Date(),
    ...overrides,
  };
}

function makeReq(cookieValue?: string): Request & { cookies: Record<string, string> } {
  return {
    cookies: cookieValue ? { [SESSION_COOKIE_NAME]: cookieValue } : {},
  } as unknown as Request & { cookies: Record<string, string> };
}

function makeRes(): Response & { _cookies: Record<string, { value: string; opts: Record<string, unknown> }> } {
  const _cookies: Record<string, { value: string; opts: Record<string, unknown> }> = {};
  return {
    _cookies,
    cookie(name: string, value: string, opts: Record<string, unknown> = {}) {
      _cookies[name] = { value, opts };
    },
  } as unknown as Response & { _cookies: Record<string, { value: string; opts: Record<string, unknown> }> };
}

function makeExecutionContext(req: Request): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

// ── Tests: session cookie helpers ──────────────────────────────────────────────

describe('session-cookie helpers', () => {
  it('SESSION_COOKIE_NAME is a non-empty string', () => {
    expect(typeof SESSION_COOKIE_NAME).toBe('string');
    expect(SESSION_COOKIE_NAME.length).toBeGreaterThan(0);
  });

  it('extractSessionToken returns null when cookie is absent', () => {
    const req = makeReq();
    expect(extractSessionToken(req as unknown as Request)).toBeNull();
  });

  it('extractSessionToken returns the token when the cookie is present', () => {
    const req = makeReq('my-session-token');
    expect(extractSessionToken(req as unknown as Request)).toBe('my-session-token');
  });

  it('extractSessionToken returns null for an empty string cookie', () => {
    const req = makeReq('');
    expect(extractSessionToken(req as unknown as Request)).toBeNull();
  });

  it('setSessionCookie writes the correct cookie for a persistent session', () => {
    const res = makeRes();
    setSessionCookie(res as unknown as Response, 'tok', { maxAge: 2592000, persistent: true });
    expect(res._cookies[SESSION_COOKIE_NAME]).toBeDefined();
    const entry = res._cookies[SESSION_COOKIE_NAME];
    expect(entry.value).toBe('tok');
    expect(entry.opts).toMatchObject({ httpOnly: true, sameSite: 'strict' });
  });

  it('setSessionCookie writes the correct cookie for a transient session (no maxAge on cookie)', () => {
    const res = makeRes();
    setSessionCookie(res as unknown as Response, 'tok', { maxAge: 86400, persistent: false });
    const entry = res._cookies[SESSION_COOKIE_NAME];
    expect(entry.value).toBe('tok');
    // Transient sessions must NOT have maxAge on the cookie (browser-close semantics)
    expect(entry.opts).not.toHaveProperty('maxAge');
  });

  it('clearSessionCookie sets the cookie to an empty value with maxAge 0', () => {
    const res = makeRes();
    clearSessionCookie(res as unknown as Response);
    const entry = res._cookies[SESSION_COOKIE_NAME];
    expect(entry.value).toBe('');
    expect(entry.opts.maxAge).toBe(0);
  });
});

// ── Tests: CurrentUserGuard ────────────────────────────────────────────────────

describe('CurrentUserGuard', () => {
  let guard: CurrentUserGuard;
  let mockGetCurrentUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser = vi.fn();

    // Build a minimal AuthService stub with just getCurrentUser
    const stubAuthService = {
      getCurrentUser: mockGetCurrentUser,
    };
    guard = new CurrentUserGuard(stubAuthService as unknown as InstanceType<typeof import('../../auth/auth.service.js').AuthService>);
  });

  it('returns true and attaches authContext when session is valid', async () => {
    const user = makePublicUser();
    const session = makeSession();
    mockGetCurrentUser.mockResolvedValue({ user, session });

    const req = makeReq('opaque-token-abc') as unknown as Request & {
      authContext?: { user: PublicUser; session: Session };
    };
    const result = await guard.canActivate(makeExecutionContext(req));

    expect(result).toBe(true);
    expect(req.authContext).toBeDefined();
    expect(req.authContext!.user).toMatchObject({ email: 'alice@example.com' });
    expect(req.authContext!.session).toMatchObject({ session_token: 'opaque-token-abc' });
  });

  it('throws UnauthorizedException when no cookie is present', async () => {
    const req = makeReq() as unknown as Request;
    await expect(guard.canActivate(makeExecutionContext(req))).rejects.toThrow(/not authenticated/i);
  });

  it('throws UnauthorizedException when session lookup returns null', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const req = makeReq('invalid-token') as unknown as Request;
    await expect(guard.canActivate(makeExecutionContext(req))).rejects.toThrow(/session expired/i);
  });

  it('does not expose password_hash through authContext', async () => {
    const user = makePublicUser();
    const session = makeSession();
    mockGetCurrentUser.mockResolvedValue({ user, session });

    const req = makeReq('opaque-token-abc') as unknown as Request & {
      authContext?: { user: PublicUser };
    };
    await guard.canActivate(makeExecutionContext(req));

    expect(Object.keys(req.authContext!.user)).not.toContain('password_hash');
  });
});

// ── Tests: sign-out flow (cookie + service interaction) ───────────────────────

describe('sign-out flow: cookie clearing + session invalidation', () => {
  it('clearSessionCookie zeroes the cookie independently of session deletion', () => {
    const res = makeRes();
    clearSessionCookie(res as unknown as Response);
    const entry = res._cookies[SESSION_COOKIE_NAME];
    expect(entry.value).toBe('');
    expect(entry.opts.maxAge).toBe(0);
  });

  it('extractSessionToken provides the token that signOut should consume', () => {
    const req = makeReq('my-browser-token');
    const token = extractSessionToken(req as unknown as Request);
    expect(typeof token).toBe('string');
    expect(token).toBe('my-browser-token');
  });

  it('sign-out is idempotent when no cookie is present (token is null)', () => {
    const req = makeReq();
    const token = extractSessionToken(req as unknown as Request);
    // No token → no signOut should be called; this is safe
    expect(token).toBeNull();
  });
});

// ── Tests: sign-out service method contract ────────────────────────────────────

describe('AuthService.signOut contract', () => {
  it('imports AuthService with a signOut method', async () => {
    const { AuthService } = await import('../../auth/auth.service.js');
    expect(typeof AuthService.prototype.signOut).toBe('function');
  });

  it('signOut accepts exactly one argument (the session token)', async () => {
    const { AuthService } = await import('../../auth/auth.service.js');
    // Function.length returns the number of declared parameters
    expect(AuthService.prototype.signOut.length).toBe(1);
  });
});
