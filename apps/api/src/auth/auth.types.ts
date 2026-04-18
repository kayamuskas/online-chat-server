/**
 * Auth domain type contracts.
 *
 * These types are shared across the auth module boundaries (registration,
 * sign-in, session management, password reset). Username is modelled as
 * immutable-by-API — it is set at registration and never mutated afterward.
 */

// ── Core domain types ─────────────────────────────────────────────────────────

/** A user record as returned from the database. */
export interface User {
  id: string;
  email: string;
  /** Immutable after registration. Never mutated by any update handler. */
  username: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

/** A session record as returned from the database. */
export interface Session {
  id: string;
  user_id: string;
  session_token: string;
  is_persistent: boolean;
  expires_at: Date;
  last_seen_at: Date;
  created_at: Date;
}

/**
 * A session record enriched with Phase 3 client metadata.
 *
 * Extends the base Session with ip_address and user_agent columns
 * added by migration 0002_session_presence.sql.
 */
export interface SessionWithMetadata extends Session {
  /** Full client IP address captured at session creation time. */
  ip_address: string | null;
  /** Raw User-Agent header value captured at session creation time. */
  user_agent: string | null;
}

/**
 * Session inventory item returned by the list-sessions endpoint.
 *
 * Includes all display fields needed by the active-sessions UI
 * plus an isCurrentSession marker for the "This browser" badge.
 */
export interface SessionInventoryItem {
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  isPersistent: boolean;
  /** True when this row matches the caller's current session token. */
  isCurrentSession: boolean;
}

/** A password-reset token record as returned from the database. */
export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

// ── Session policy enum ───────────────────────────────────────────────────────

/**
 * Session duration policy chosen at sign-in time.
 *
 * TRANSIENT  — browser-close semantics + 24 h hard cap
 * PERSISTENT — "Keep me signed in": 30-day idle timeout
 */
export enum SessionPolicy {
  TRANSIENT  = 'transient',
  PERSISTENT = 'persistent',
}

// ── Shared request/response shapes ───────────────────────────────────────────

/** Payload passed to registration handler. */
export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

/** Payload passed to sign-in handler. */
export interface SignInInput {
  email: string;
  password: string;
  keepSignedIn: boolean;
}

/** Safe user projection — no password_hash. */
export type PublicUser = Omit<User, 'password_hash'>;
