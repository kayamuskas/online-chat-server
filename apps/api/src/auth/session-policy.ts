/**
 * Session-policy helper.
 *
 * Encodes the Phase 2 session-duration rules approved in 02-CONTEXT.md:
 *
 *   TRANSIENT  (Keep me signed in = OFF):
 *     - Session cookie (no persistent Max-Age in browser terms, BUT we still
 *       set a server-side expiry cap of 24 hours so the row can be cleaned up).
 *     - Hard expiry cap: 24 hours from creation.
 *
 *   PERSISTENT (Keep me signed in = ON):
 *     - Persistent cookie with Max-Age = 30 days.
 *     - Idle timeout: 30 days from last activity (updated on each request).
 *
 * These constants and helpers are the single source of truth for session
 * semantics. All HTTP handlers must use buildSessionExpiry() rather than
 * computing their own TTLs.
 */

import { SessionPolicy } from './auth.types.js';

// ── Duration constants ─────────────────────────────────────────────────────────

/** 24 hours in milliseconds (TRANSIENT hard cap). */
export const SESSION_TRANSIENT_TTL_MS = 24 * 60 * 60 * 1000;

/** 30 days in milliseconds (PERSISTENT idle timeout). */
export const SESSION_PERSISTENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 24 hours in seconds — used as cookie Max-Age for TRANSIENT sessions. */
export const SESSION_TRANSIENT_TTL_SECONDS = 24 * 60 * 60; // 86400

/** 30 days in seconds — used as cookie Max-Age for PERSISTENT sessions. */
export const SESSION_PERSISTENT_TTL_SECONDS = 30 * 24 * 60 * 60; // 2592000

// ── Expiry builder ────────────────────────────────────────────────────────────

export interface SessionExpiry {
  /** Absolute timestamp to store in sessions.expires_at. */
  expiresAt: Date;
  /**
   * Server-side session TTL in seconds.
   * For TRANSIENT this mirrors the 24-hour hard cap, but the browser cookie
   * remains session-only because session-cookie.ts omits Max-Age unless the
   * session is persistent.
   */
  sessionTtlSeconds: number;
  /** Whether the session row should be treated as persistent (is_persistent column). */
  isPersistent: boolean;
}

/**
 * Build session expiry metadata from a SessionPolicy value.
 * Call this once at sign-in time and persist the result alongside the session row.
 */
export function buildSessionExpiry(policy: SessionPolicy): SessionExpiry {
  const now = Date.now();

  if (policy === SessionPolicy.PERSISTENT) {
    return {
      expiresAt: new Date(now + SESSION_PERSISTENT_TTL_MS),
      sessionTtlSeconds: SESSION_PERSISTENT_TTL_SECONDS,
      isPersistent: true,
    };
  }

  // TRANSIENT: 24-hour hard cap
  return {
    expiresAt: new Date(now + SESSION_TRANSIENT_TTL_MS),
    sessionTtlSeconds: SESSION_TRANSIENT_TTL_SECONDS,
    isPersistent: false,
  };
}

// ── Policy selector ───────────────────────────────────────────────────────────

/**
 * Convert the "Keep me signed in" checkbox state to a persistence flag.
 * Use this in sign-in handlers to determine which SessionPolicy to apply.
 */
export function isCookiePersistent(keepSignedIn: boolean): boolean {
  return keepSignedIn;
}

/**
 * Derive a SessionPolicy enum value from the "Keep me signed in" input.
 * Convenience wrapper for handlers that work with the enum directly.
 */
export function resolveSessionPolicy(keepSignedIn: boolean): SessionPolicy {
  return keepSignedIn ? SessionPolicy.PERSISTENT : SessionPolicy.TRANSIENT;
}
