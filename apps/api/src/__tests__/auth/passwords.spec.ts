/**
 * Task 2 TDD — RED phase
 *
 * Tests for the centralized password helper boundary.
 * These tests verify that hashing and verification work correctly without
 * exposing algorithm details to callers.
 */

import { describe, it, expect } from 'vitest';

// Import the module under test — will fail until passwords.ts exists
import { hashPassword, verifyPassword } from '../../auth/passwords.js';

describe('hashPassword', () => {
  it('returns a non-empty string', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('produces a different hash each call (salted)', async () => {
    const h1 = await hashPassword('same-password');
    const h2 = await hashPassword('same-password');
    expect(h1).not.toBe(h2);
  });

  it('does not return the plaintext password', async () => {
    const password = 'super-secret-password';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
  });

  it('produces a hash that looks like a bcrypt/argon2 digest', async () => {
    const hash = await hashPassword('any-password');
    // bcrypt hashes start with $2b$ or $2a$; argon2 starts with $argon2
    const looksHashed = hash.startsWith('$2b$') || hash.startsWith('$2a$') || hash.startsWith('$argon2');
    expect(looksHashed).toBe(true);
  });
});

describe('verifyPassword', () => {
  it('returns true when password matches the hash', async () => {
    const password = 'correct-password';
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('returns false when password does not match the hash', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('returns false for empty string against a real hash', async () => {
    const hash = await hashPassword('some-password');
    const result = await verifyPassword('', hash);
    expect(result).toBe(false);
  });

  it('is safe to call with an invalid hash format (returns false, does not throw)', async () => {
    const result = await verifyPassword('any-password', 'not-a-valid-hash');
    expect(result).toBe(false);
  });
});
