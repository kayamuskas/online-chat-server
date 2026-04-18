/**
 * password-reset.spec.ts — unit tests for password reset request/confirm flows
 *
 * Tests exercise PasswordResetService and MockMailService in isolation via mocks.
 * No real PostgreSQL or filesystem access is used.
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

interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
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

function makeResetToken(overrides: Partial<PasswordResetToken> = {}): PasswordResetToken {
  const future = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  return {
    id: 'token-uuid-1',
    user_id: 'user-uuid-1',
    token: 'opaque-reset-token-abc123',
    expires_at: future,
    used_at: null,
    created_at: new Date(),
    ...overrides,
  };
}

// ── MockMailService tests ──────────────────────────────────────────────────────

describe('MockMailService', () => {
  let MockMailService: any;
  let service: any;
  let writeSpy: ReturnType<typeof vi.fn>;
  let mkdirSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Clear module registry to get fresh import each test
    vi.resetModules();

    // Mock the fs/promises module used by MockMailService
    mkdirSpy = vi.fn().mockResolvedValue(undefined);
    writeSpy = vi.fn().mockResolvedValue(undefined);
    vi.doMock('node:fs/promises', () => ({
      mkdir: mkdirSpy,
      writeFile: writeSpy,
    }));

    const mod = await import('../../mail/mock-mail.service.js');
    MockMailService = mod.MockMailService;
    service = new MockMailService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should write a password-reset mail artifact to the outbox directory', async () => {
    await service.sendPasswordResetMail({
      to: 'alice@example.com',
      resetLink: 'http://localhost:4173/reset?token=abc123',
      username: 'alice',
    });

    // mkdir should be called to ensure the outbox exists
    expect(mkdirSpy).toHaveBeenCalledWith(
      expect.stringContaining('mail-outbox'),
      expect.objectContaining({ recursive: true }),
    );

    // writeFile should be called once
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('should write structured JSON artifact containing to, subject, and reset-link', async () => {
    await service.sendPasswordResetMail({
      to: 'alice@example.com',
      resetLink: 'http://localhost:4173/reset?token=abc123',
      username: 'alice',
    });

    const [, content] = writeSpy.mock.calls[0];
    const artifact = JSON.parse(content as string);

    expect(artifact).toMatchObject({
      to: 'alice@example.com',
      subject: expect.stringContaining('password'),
      resetLink: 'http://localhost:4173/reset?token=abc123',
      username: 'alice',
    });
    expect(artifact.generatedAt).toBeDefined();
  });

  it('should include the artifact file path in the returned metadata', async () => {
    const result = await service.sendPasswordResetMail({
      to: 'alice@example.com',
      resetLink: 'http://localhost:4173/reset?token=abc123',
      username: 'alice',
    });

    expect(result.artifactPath).toBeDefined();
    expect(typeof result.artifactPath).toBe('string');
    expect(result.artifactPath).toContain('mail-outbox');
  });

  it('should generate a unique filename per invocation', async () => {
    const r1 = await service.sendPasswordResetMail({
      to: 'alice@example.com',
      resetLink: 'http://localhost:4173/reset?token=token1',
      username: 'alice',
    });
    const r2 = await service.sendPasswordResetMail({
      to: 'bob@example.com',
      resetLink: 'http://localhost:4173/reset?token=token2',
      username: 'bob',
    });

    expect(r1.artifactPath).not.toBe(r2.artifactPath);
  });
});

// ── PasswordResetService tests ─────────────────────────────────────────────────

describe('PasswordResetService', () => {
  let PasswordResetService: any;
  let service: any;
  let mockUserRepo: any;
  let mockResetTokenRepo: any;
  let mockMailService: any;
  let mockHashPassword: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    mockHashPassword = vi.fn().mockResolvedValue('$2b$12$newhash');

    vi.doMock('../../auth/passwords.js', () => ({
      hashPassword: mockHashPassword,
      verifyPassword: vi.fn(),
    }));

    mockUserRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      updatePasswordHash: vi.fn().mockResolvedValue(undefined),
    };

    mockResetTokenRepo = {
      create: vi.fn(),
      findByToken: vi.fn(),
      markUsed: vi.fn().mockResolvedValue(undefined),
    };

    mockMailService = {
      sendPasswordResetMail: vi.fn().mockResolvedValue({ artifactPath: '/mail-outbox/test.json' }),
    };

    const mod = await import('../../auth/password-reset.service.js');
    PasswordResetService = mod.PasswordResetService;
    service = new PasswordResetService(mockUserRepo, mockResetTokenRepo, mockMailService);
  });

  // ── requestReset ────────────────────────────────────────────────────────────

  describe('requestReset', () => {
    it('should be defined', () => {
      expect(service.requestReset).toBeDefined();
    });

    it('should create a reset token and send a mail artifact when user exists', async () => {
      const user = makeUser();
      mockUserRepo.findByEmail.mockResolvedValue(user);
      mockResetTokenRepo.create.mockResolvedValue(makeResetToken());

      await service.requestReset('alice@example.com');

      expect(mockResetTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id }),
      );
      expect(mockMailService.sendPasswordResetMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: user.email,
          username: user.username,
          resetLink: expect.stringContaining('token='),
        }),
      );
    });

    it('should silently succeed when the email is not registered (no enumeration)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      // Must not throw even though user does not exist
      await expect(service.requestReset('nobody@example.com')).resolves.toBeUndefined();

      // Must not call create or sendMail
      expect(mockResetTokenRepo.create).not.toHaveBeenCalled();
      expect(mockMailService.sendPasswordResetMail).not.toHaveBeenCalled();
    });

    it('should embed the reset token in the reset link', async () => {
      const user = makeUser();
      const resetToken = makeResetToken({ token: 'my-special-token' });
      mockUserRepo.findByEmail.mockResolvedValue(user);
      mockResetTokenRepo.create.mockResolvedValue(resetToken);

      await service.requestReset(user.email);

      const call = mockMailService.sendPasswordResetMail.mock.calls[0][0];
      expect(call.resetLink).toContain('my-special-token');
    });
  });

  // ── confirmReset ────────────────────────────────────────────────────────────

  describe('confirmReset', () => {
    it('should be defined', () => {
      expect(service.confirmReset).toBeDefined();
    });

    it('should update the password hash and mark the token as used on valid token', async () => {
      const user = makeUser();
      const resetToken = makeResetToken();
      mockResetTokenRepo.findByToken.mockResolvedValue(resetToken);
      mockUserRepo.findById.mockResolvedValue(user);

      await service.confirmReset({ token: resetToken.token, newPassword: 'NewPass123!' });

      expect(mockHashPassword).toHaveBeenCalledWith('NewPass123!');
      expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith(user.id, '$2b$12$newhash');
      expect(mockResetTokenRepo.markUsed).toHaveBeenCalledWith(resetToken.id);
    });

    it('should throw BadRequestException on unknown token', async () => {
      mockResetTokenRepo.findByToken.mockResolvedValue(null);

      await expect(
        service.confirmReset({ token: 'bad-token', newPassword: 'NewPass!' }),
      ).rejects.toThrow();
    });

    it('should throw BadRequestException on already-used token', async () => {
      const usedToken = makeResetToken({ used_at: new Date() });
      mockResetTokenRepo.findByToken.mockResolvedValue(usedToken);

      await expect(
        service.confirmReset({ token: usedToken.token, newPassword: 'NewPass!' }),
      ).rejects.toThrow();
    });

    it('should throw BadRequestException on expired token', async () => {
      const expiredToken = makeResetToken({ expires_at: new Date(Date.now() - 1000) });
      mockResetTokenRepo.findByToken.mockResolvedValue(expiredToken);

      await expect(
        service.confirmReset({ token: expiredToken.token, newPassword: 'NewPass!' }),
      ).rejects.toThrow();
    });

    it('should not update hash if the user referenced by token no longer exists', async () => {
      const resetToken = makeResetToken();
      mockResetTokenRepo.findByToken.mockResolvedValue(resetToken);
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.confirmReset({ token: resetToken.token, newPassword: 'NewPass!' }),
      ).rejects.toThrow();
    });
  });
});

// ── PasswordResetController integration-style tests ───────────────────────────

describe('PasswordResetController', () => {
  let PasswordResetController: any;
  let controller: any;
  let mockService: any;

  beforeEach(async () => {
    vi.resetModules();

    mockService = {
      requestReset: vi.fn().mockResolvedValue(undefined),
      confirmReset: vi.fn().mockResolvedValue(undefined),
    };

    const mod = await import('../../auth/password-reset.controller.js');
    PasswordResetController = mod.PasswordResetController;
    controller = new PasswordResetController(mockService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call requestReset with the submitted email', async () => {
    await controller.requestReset({ email: 'alice@example.com' });
    expect(mockService.requestReset).toHaveBeenCalledWith('alice@example.com');
  });

  it('should call confirmReset with the submitted token and newPassword', async () => {
    await controller.confirmReset({ token: 'abc123', newPassword: 'NewPass!' });
    expect(mockService.confirmReset).toHaveBeenCalledWith({
      token: 'abc123',
      newPassword: 'NewPass!',
    });
  });
});
