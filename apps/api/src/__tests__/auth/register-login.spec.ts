/**
 * register-login.spec.ts
 *
 * Unit tests for registration, sign-in, and current-user lookup.
 * Tests are isolated using mocked repositories — no real database connection needed.
 *
 * TDD RED phase: tests are written before implementation exists.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (must be declared before imports that pull in the real modules) ──────

const mockUserRepo = {
  findByEmail: vi.fn(),
  findByUsername: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
};

const mockSessionRepo = {
  create: vi.fn(),
  findByToken: vi.fn(),
  delete: vi.fn(),
  touchLastSeen: vi.fn(),
};

vi.mock('../../auth/user.repository.js', () => ({
  UserRepository: vi.fn().mockImplementation(() => mockUserRepo),
}));

vi.mock('../../auth/session.repository.js', () => ({
  SessionRepository: vi.fn().mockImplementation(() => mockSessionRepo),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

import { AuthService } from '../../auth/auth.service.js';
import { UserRepository } from '../../auth/user.repository.js';
import { SessionRepository } from '../../auth/session.repository.js';
import type { User, Session } from '../../auth/auth.types.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-1',
    email: 'alice@example.com',
    username: 'alice',
    password_hash: '$2b$12$validhash',
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AuthService — register', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockUserRepo as unknown as UserRepository,
      mockSessionRepo as unknown as SessionRepository,
    );
  });

  it('creates a new user and returns a PublicUser (no password_hash)', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.findByUsername.mockResolvedValue(null);
    mockSessionRepo.create.mockResolvedValue(makeSession());
    const user = makeUser();
    mockUserRepo.create.mockResolvedValue(user);

    const result = await service.register({
      email: 'alice@example.com',
      username: 'alice',
      password: 'Str0ngP@ss!',
    });

    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user).toMatchObject({ email: 'alice@example.com', username: 'alice' });
    expect(result.sessionToken).toBe('opaque-token-abc');
    expect(mockUserRepo.create).toHaveBeenCalledOnce();
  });

  it('throws ConflictException when email is already taken', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(makeUser());

    await expect(
      service.register({ email: 'alice@example.com', username: 'alice2', password: 'pass' }),
    ).rejects.toThrow(/email/i);
  });

  it('throws ConflictException when username is already taken', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.findByUsername.mockResolvedValue(makeUser());

    await expect(
      service.register({ email: 'new@example.com', username: 'alice', password: 'pass' }),
    ).rejects.toThrow(/username/i);
  });

  it('does not expose password_hash in the returned user', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockUserRepo.findByUsername.mockResolvedValue(null);
    mockUserRepo.create.mockResolvedValue(makeUser());
    mockSessionRepo.create.mockResolvedValue(makeSession());

    const result = await service.register({
      email: 'alice@example.com',
      username: 'alice',
      password: 'pass',
    });

    expect(Object.keys(result.user)).not.toContain('password_hash');
  });
});

describe('AuthService — signIn', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockUserRepo as unknown as UserRepository,
      mockSessionRepo as unknown as SessionRepository,
    );
  });

  it('returns session token and user on valid credentials (keepSignedIn=false)', async () => {
    const user = makeUser();
    // We need a real bcrypt hash for the password "Str0ngP@ss!"
    // Use a pre-computed hash to avoid slow bcrypt in unit tests
    const { hashPassword } = await import('../../auth/passwords.js');
    user.password_hash = await hashPassword('Str0ngP@ss!');
    mockUserRepo.findByEmail.mockResolvedValue(user);
    const session = makeSession({ is_persistent: false });
    mockSessionRepo.create.mockResolvedValue(session);

    const result = await service.signIn({
      email: 'alice@example.com',
      password: 'Str0ngP@ss!',
      keepSignedIn: false,
    });

    expect(result).toHaveProperty('sessionToken');
    expect(result).toHaveProperty('user');
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result).toHaveProperty('sessionTtlSeconds');
    expect(result).toHaveProperty('isPersistent', false);
  });

  it('returns session token and user on valid credentials (keepSignedIn=true)', async () => {
    const user = makeUser();
    const { hashPassword } = await import('../../auth/passwords.js');
    user.password_hash = await hashPassword('Str0ngP@ss!');
    mockUserRepo.findByEmail.mockResolvedValue(user);
    const session = makeSession({ is_persistent: true });
    mockSessionRepo.create.mockResolvedValue(session);

    const result = await service.signIn({
      email: 'alice@example.com',
      password: 'Str0ngP@ss!',
      keepSignedIn: true,
    });

    expect(result).toHaveProperty('isPersistent', true);
    expect(result.sessionTtlSeconds).toBeGreaterThan(86400); // 30 days > 24 hours
  });

  it('throws UnauthorizedException when user is not found', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(
      service.signIn({ email: 'nobody@example.com', password: 'pass', keepSignedIn: false }),
    ).rejects.toThrow(/invalid/i);
  });

  it('throws UnauthorizedException on wrong password', async () => {
    const user = makeUser();
    const { hashPassword } = await import('../../auth/passwords.js');
    user.password_hash = await hashPassword('correct-pass');
    mockUserRepo.findByEmail.mockResolvedValue(user);

    await expect(
      service.signIn({ email: 'alice@example.com', password: 'wrong-pass', keepSignedIn: false }),
    ).rejects.toThrow(/invalid/i);
  });

  it('creates exactly one session row per sign-in', async () => {
    const user = makeUser();
    const { hashPassword } = await import('../../auth/passwords.js');
    user.password_hash = await hashPassword('pass');
    mockUserRepo.findByEmail.mockResolvedValue(user);
    mockSessionRepo.create.mockResolvedValue(makeSession());

    await service.signIn({ email: 'alice@example.com', password: 'pass', keepSignedIn: false });

    expect(mockSessionRepo.create).toHaveBeenCalledOnce();
  });
});

describe('AuthService — getCurrentUser', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockUserRepo as unknown as UserRepository,
      mockSessionRepo as unknown as SessionRepository,
    );
  });

  it('resolves the user for a valid non-expired session token', async () => {
    const session = makeSession();
    const user = makeUser();
    mockSessionRepo.findByToken.mockResolvedValue(session);
    mockUserRepo.findById.mockResolvedValue(user);

    const result = await service.getCurrentUser('opaque-token-abc');

    expect(result).not.toBeNull();
    expect(result!.user).not.toHaveProperty('password_hash');
    expect(result!.session).toMatchObject({ session_token: 'opaque-token-abc' });
  });

  it('returns null for a non-existent session token', async () => {
    mockSessionRepo.findByToken.mockResolvedValue(null);

    const result = await service.getCurrentUser('bad-token');

    expect(result).toBeNull();
  });

  it('returns null for an expired session token', async () => {
    const expiredSession = makeSession({ expires_at: new Date(Date.now() - 1000) });
    mockSessionRepo.findByToken.mockResolvedValue(expiredSession);
    // Service should detect expiry and not even call findById
    mockUserRepo.findById.mockResolvedValue(makeUser());

    const result = await service.getCurrentUser('expired-token');

    expect(result).toBeNull();
  });
});

describe('UserRepository interface contract', () => {
  it('exports UserRepository as a class', async () => {
    const mod = await import('../../auth/user.repository.js');
    expect(mod.UserRepository).toBeDefined();
    expect(typeof mod.UserRepository).toBe('function');
  });
});

describe('SessionRepository interface contract', () => {
  it('exports SessionRepository as a class', async () => {
    const mod = await import('../../auth/session.repository.js');
    expect(mod.SessionRepository).toBeDefined();
    expect(typeof mod.SessionRepository).toBe('function');
  });
});
