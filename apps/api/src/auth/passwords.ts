/**
 * Password helper boundary.
 *
 * All password hashing and verification passes through this module.
 * Controllers and services must not call bcrypt (or any other hashing library)
 * directly — they must use these helpers so the algorithm can be changed in
 * one place without touching callers.
 *
 * Algorithm: bcrypt with a work factor of 12 (suitable for 2026 hardware).
 * Raw passwords must never be logged, stored, or returned from these functions.
 */

import bcrypt from 'bcrypt';

/** bcrypt work factor. Higher = slower hash (more brute-force resistant). */
const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt.
 * Returns a salted hash string safe to store in the database.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 * Returns true if the password matches; false otherwise.
 * Never throws on an invalid hash format — returns false instead.
 */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    // Invalid hash format or other bcrypt error — treat as no-match
    return false;
  }
}
