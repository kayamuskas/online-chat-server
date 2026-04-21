/**
 * change-password.spec.ts — unit tests for the authenticated password-change flow.
 *
 * Tests exercise ChangePasswordService and the auth controller extension in isolation.
 * No real PostgreSQL access is used.
 *
 * RED phase: all tests are written first, then implementation is added.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Type contracts ─────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

// ── Mock factories ─────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-1',
    email: 'alice@example.com',
    username: 'alice',
    password_hash: '$2b$12$fakehash',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    ...overrides,
  };
}

// ── ChangePasswordService tests ────────────────────────────────────────────────

describe('ChangePasswordService', () => {
  let ChangePasswordService: any;
  let service: any;
  let mockUserRepo: any;
  let mockVerifyPassword: ReturnType<typeof vi.fn>;
  let mockHashPassword: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    mockVerifyPassword = vi.fn().mockResolvedValue(true);
    mockHashPassword = vi.fn().mockResolvedValue('$2b$12$newhash');

    vi.doMock('../../auth/passwords.js', () => ({
      verifyPassword: mockVerifyPassword,
      hashPassword: mockHashPassword,
    }));

    mockUserRepo = {
      findById: vi.fn(),
      updatePasswordHash: vi.fn().mockResolvedValue(true),
    };

    const mod = await import('../../auth/change-password.service.js');
    ChangePasswordService = mod.ChangePasswordService;
    service = new ChangePasswordService(mockUserRepo);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose a changePassword method', () => {
    expect(typeof service.changePassword).toBe('function');
  });

  // ── Successful password change ───────────────────────────────────────────────

  it('should verify the current password before updating', async () => {
    const user = makeUser();
    mockUserRepo.findById.mockResolvedValue(user);

    await service.changePassword({
      userId: user.id,
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    });

    expect(mockVerifyPassword).toHaveBeenCalledWith('OldPass123!', user.password_hash);
  });

  it('should hash the new password and update the stored hash', async () => {
    const user = makeUser();
    mockUserRepo.findById.mockResolvedValue(user);

    await service.changePassword({
      userId: user.id,
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    });

    expect(mockHashPassword).toHaveBeenCalledWith('NewPass456!');
    expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith(user.id, '$2b$12$newhash');
  });

  // ── Error cases ──────────────────────────────────────────────────────────────

  it('should throw UnauthorizedException when the current password is wrong', async () => {
    const user = makeUser();
    mockUserRepo.findById.mockResolvedValue(user);
    mockVerifyPassword.mockResolvedValue(false);

    await expect(
      service.changePassword({
        userId: user.id,
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPass456!',
      }),
    ).rejects.toThrow();
  });

  it('should not update the hash when the current password is wrong', async () => {
    const user = makeUser();
    mockUserRepo.findById.mockResolvedValue(user);
    mockVerifyPassword.mockResolvedValue(false);

    try {
      await service.changePassword({
        userId: user.id,
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPass456!',
      });
    } catch {
      // expected
    }

    expect(mockUserRepo.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('should throw if the user record cannot be found', async () => {
    mockUserRepo.findById.mockResolvedValue(null);

    await expect(
      service.changePassword({
        userId: 'nonexistent-id',
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      }),
    ).rejects.toThrow();
  });

  it('should not call verifyPassword if the user is not found', async () => {
    mockUserRepo.findById.mockResolvedValue(null);

    try {
      await service.changePassword({
        userId: 'nonexistent-id',
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      });
    } catch {
      // expected
    }

    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });
});

// ── AuthController password-change endpoint tests ─────────────────────────────

describe('AuthController — change-password endpoint', () => {
  let AuthController: any;
  let controller: any;
  let mockAuthService: any;
  let mockChangePasswordService: any;

  beforeEach(async () => {
    vi.resetModules();

    mockAuthService = {
      register: vi.fn(),
      signIn: vi.fn(),
      getCurrentUser: vi.fn(),
      signOut: vi.fn(),
    };

    mockChangePasswordService = {
      changePassword: vi.fn().mockResolvedValue(undefined),
    };

    const mod = await import('../../auth/auth.controller.js');
    AuthController = mod.AuthController;
    controller = new AuthController(mockAuthService, mockChangePasswordService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should expose a changePassword method', () => {
    expect(typeof controller.changePassword).toBe('function');
  });

  it('should call changePasswordService.changePassword with userId from authContext and body', async () => {
    const mockAuthContext = {
      user: { id: 'user-uuid-1', email: 'alice@example.com', username: 'alice' },
      session: {},
    };

    await controller.changePassword(
      mockAuthContext,
      { currentPassword: 'OldPass123!', newPassword: 'NewPass456!' },
    );

    expect(mockChangePasswordService.changePassword).toHaveBeenCalledWith({
      userId: 'user-uuid-1',
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    });
  });
});
