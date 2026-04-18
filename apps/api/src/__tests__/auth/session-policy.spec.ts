/**
 * Task 2 TDD — RED phase
 *
 * Tests for the centralized session-policy helper.
 * These tests encode the exact Phase 2 session-duration rules so later
 * controllers cannot silently drift from the approved semantics.
 *
 * Approved rules (from 02-CONTEXT.md):
 *  - TRANSIENT  (no Keep me signed in): browser-close semantics + 24 h hard cap
 *  - PERSISTENT (Keep me signed in):    30-day idle timeout
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  buildSessionExpiry,
  SESSION_TRANSIENT_TTL_MS,
  SESSION_PERSISTENT_TTL_MS,
  SESSION_TRANSIENT_TTL_SECONDS,
  SESSION_PERSISTENT_TTL_SECONDS,
  isCookiePersistent,
} from '../../auth/session-policy.js';
import { SessionPolicy } from '../../auth/auth.types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

describe('session policy constants', () => {
  it('TRANSIENT TTL is exactly 24 hours in ms', () => {
    expect(SESSION_TRANSIENT_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('PERSISTENT TTL is exactly 30 days in ms', () => {
    expect(SESSION_PERSISTENT_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('TRANSIENT TTL in seconds is 86400', () => {
    expect(SESSION_TRANSIENT_TTL_SECONDS).toBe(86_400);
  });

  it('PERSISTENT TTL in seconds is 2592000 (30 days)', () => {
    expect(SESSION_PERSISTENT_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});

// ── buildSessionExpiry ────────────────────────────────────────────────────────

describe('buildSessionExpiry', () => {
  const NOW = new Date('2026-01-01T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TRANSIENT: expires_at is exactly 24 h from now', () => {
    const { expiresAt } = buildSessionExpiry(SessionPolicy.TRANSIENT);
    const expected = new Date(NOW + SESSION_TRANSIENT_TTL_MS);
    expect(expiresAt.getTime()).toBe(expected.getTime());
  });

  it('PERSISTENT: expires_at is exactly 30 days from now', () => {
    const { expiresAt } = buildSessionExpiry(SessionPolicy.PERSISTENT);
    const expected = new Date(NOW + SESSION_PERSISTENT_TTL_MS);
    expect(expiresAt.getTime()).toBe(expected.getTime());
  });

  it('TRANSIENT: sessionTtlSeconds is 86400 seconds', () => {
    const { sessionTtlSeconds } = buildSessionExpiry(SessionPolicy.TRANSIENT);
    expect(sessionTtlSeconds).toBe(SESSION_TRANSIENT_TTL_SECONDS);
  });

  it('PERSISTENT: sessionTtlSeconds is 2592000 seconds (30 days)', () => {
    const { sessionTtlSeconds } = buildSessionExpiry(SessionPolicy.PERSISTENT);
    expect(sessionTtlSeconds).toBe(SESSION_PERSISTENT_TTL_SECONDS);
  });

  it('TRANSIENT: isPersistent flag is false', () => {
    const { isPersistent } = buildSessionExpiry(SessionPolicy.TRANSIENT);
    expect(isPersistent).toBe(false);
  });

  it('PERSISTENT: isPersistent flag is true', () => {
    const { isPersistent } = buildSessionExpiry(SessionPolicy.PERSISTENT);
    expect(isPersistent).toBe(true);
  });
});

// ── isCookiePersistent ────────────────────────────────────────────────────────

describe('isCookiePersistent', () => {
  it('returns false when keepSignedIn is false', () => {
    expect(isCookiePersistent(false)).toBe(false);
  });

  it('returns true when keepSignedIn is true', () => {
    expect(isCookiePersistent(true)).toBe(true);
  });

  it('maps false -> TRANSIENT policy correctly', () => {
    const policy = isCookiePersistent(false)
      ? SessionPolicy.PERSISTENT
      : SessionPolicy.TRANSIENT;
    expect(policy).toBe(SessionPolicy.TRANSIENT);
  });

  it('maps true -> PERSISTENT policy correctly', () => {
    const policy = isCookiePersistent(true)
      ? SessionPolicy.PERSISTENT
      : SessionPolicy.TRANSIENT;
    expect(policy).toBe(SessionPolicy.PERSISTENT);
  });
});
