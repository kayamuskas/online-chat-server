/**
 * session-inventory.spec.ts
 *
 * Tests for session metadata extraction, persistence, and inventory/revoke operations.
 *
 * Task 1: metadata extraction helper (session-metadata.ts)
 * Task 2: session inventory and revoke surfaces (SessionRepository, AuthService, SessionManagementController)
 *
 * TDD RED phase: tests are written before implementation exists.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockDb = {
  query: vi.fn(),
};

vi.mock('../../db/postgres.service.js', () => ({
  PostgresService: vi.fn().mockImplementation(() => mockDb),
}));

const mockSessionRepo = {
  create: vi.fn(),
  findByToken: vi.fn(),
  delete: vi.fn(),
  touchLastSeen: vi.fn(),
  findAllByUserId: vi.fn(),
  deleteById: vi.fn(),
  deleteAllOtherByUserId: vi.fn(),
};

const mockUserRepo = {
  findByEmail: vi.fn(),
  findByUsername: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
};

vi.mock('../../auth/session.repository.js', () => ({
  SessionRepository: vi.fn().mockImplementation(() => mockSessionRepo),
}));

vi.mock('../../auth/user.repository.js', () => ({
  UserRepository: vi.fn().mockImplementation(() => mockUserRepo),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  extractClientIp,
  buildSessionMetadata,
} from '../../auth/session-metadata.js';
import type { SessionWithMetadata } from '../../auth/auth.types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(overrides: {
  headers?: Record<string, string | undefined>;
  ip?: string;
  remoteAddress?: string;
} = {}): {
  headers: Record<string, string | undefined>;
  ip?: string;
  socket: { remoteAddress?: string };
} {
  return {
    headers: overrides.headers ?? {},
    ip: overrides.ip,
    socket: { remoteAddress: overrides.remoteAddress ?? '127.0.0.1' },
  };
}

function makeSessionWithMetadata(overrides: Partial<SessionWithMetadata> = {}): SessionWithMetadata {
  return {
    id: 'session-uuid-1',
    user_id: 'user-uuid-1',
    session_token: 'opaque-token-abc',
    is_persistent: false,
    expires_at: new Date(Date.now() + 86400_000),
    last_seen_at: new Date(),
    created_at: new Date(),
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ...overrides,
  };
}

// ── Task 1 Tests: session-metadata helper ─────────────────────────────────────

describe('extractClientIp', () => {
  it('returns the first IP from X-Forwarded-For when present and trusted', () => {
    const req = makeRequest({
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 172.16.0.1' },
    });
    expect(extractClientIp(req)).toBe('203.0.113.5');
  });

  it('returns the direct ip field when X-Forwarded-For is absent', () => {
    const req = makeRequest({ ip: '10.0.0.42' });
    expect(extractClientIp(req)).toBe('10.0.0.42');
  });

  it('falls back to socket.remoteAddress when ip and X-Forwarded-For are absent', () => {
    const req = makeRequest({ remoteAddress: '192.168.1.100' });
    expect(extractClientIp(req)).toBe('192.168.1.100');
  });

  it('returns "unknown" when no address is available', () => {
    const req = { headers: {}, socket: {} };
    expect(extractClientIp(req)).toBe('unknown');
  });

  it('handles X-Forwarded-For with a single IP value', () => {
    const req = makeRequest({
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    expect(extractClientIp(req)).toBe('203.0.113.10');
  });

  it('trims whitespace from extracted IP values', () => {
    const req = makeRequest({
      headers: { 'x-forwarded-for': '  203.0.113.5  , 10.0.0.1' },
    });
    expect(extractClientIp(req)).toBe('203.0.113.5');
  });

  it('ignores an empty X-Forwarded-For header', () => {
    const req = makeRequest({
      headers: { 'x-forwarded-for': '' },
      ip: '10.10.10.10',
    });
    expect(extractClientIp(req)).toBe('10.10.10.10');
  });
});

describe('buildSessionMetadata', () => {
  it('returns ip_address and user_agent from the request', () => {
    const req = makeRequest({
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      ip: '1.2.3.4',
    });
    const metadata = buildSessionMetadata(req);
    expect(metadata.ip_address).toBe('1.2.3.4');
    expect(metadata.user_agent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  });

  it('sets ip_address to "unknown" when no address is available', () => {
    const req = { headers: {}, socket: {} };
    const metadata = buildSessionMetadata(req);
    expect(metadata.ip_address).toBe('unknown');
  });

  it('sets user_agent to null when User-Agent header is absent', () => {
    const req = makeRequest({ ip: '10.0.0.1' });
    const metadata = buildSessionMetadata(req);
    expect(metadata.user_agent).toBeNull();
  });
});

// ── Task 1 Tests: SessionWithMetadata type ─────────────────────────────────────

describe('SessionWithMetadata type shape', () => {
  it('includes ip_address and user_agent on top of base Session fields', () => {
    const s = makeSessionWithMetadata();
    expect(s).toHaveProperty('id');
    expect(s).toHaveProperty('user_id');
    expect(s).toHaveProperty('session_token');
    expect(s).toHaveProperty('ip_address');
    expect(s).toHaveProperty('user_agent');
    expect(s).toHaveProperty('last_seen_at');
    expect(s).toHaveProperty('created_at');
  });
});

// ── Task 2 Tests: session inventory and revoke operations ─────────────────────

import { AuthService } from '../../auth/auth.service.js';
import { SessionRepository } from '../../auth/session.repository.js';
import { UserRepository } from '../../auth/user.repository.js';
import type { PublicUser } from '../../auth/auth.types.js';

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

describe('AuthService — session inventory', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockUserRepo as unknown as UserRepository,
      mockSessionRepo as unknown as SessionRepository,
    );
  });

  it('returns all active sessions for the authenticated user', async () => {
    const sessions = [
      makeSessionWithMetadata({ id: 'sess-1', session_token: 'token-1' }),
      makeSessionWithMetadata({ id: 'sess-2', session_token: 'token-2' }),
    ];
    mockSessionRepo.findAllByUserId.mockResolvedValue(sessions);

    const result = await service.listSessions('user-uuid-1', 'token-1');

    expect(mockSessionRepo.findAllByUserId).toHaveBeenCalledWith('user-uuid-1');
    expect(result).toHaveLength(2);
  });

  it('marks the current session with isCurrentSession=true', async () => {
    const sessions = [
      makeSessionWithMetadata({ id: 'sess-1', session_token: 'current-token' }),
      makeSessionWithMetadata({ id: 'sess-2', session_token: 'other-token' }),
    ];
    mockSessionRepo.findAllByUserId.mockResolvedValue(sessions);

    const result = await service.listSessions('user-uuid-1', 'current-token');

    const current = result.find((s) => s.sessionId === 'sess-1');
    const other = result.find((s) => s.sessionId === 'sess-2');
    expect(current?.isCurrentSession).toBe(true);
    expect(other?.isCurrentSession).toBe(false);
  });

  it('returns sessions ordered with current session first', async () => {
    const sessions = [
      makeSessionWithMetadata({ id: 'sess-1', session_token: 'other-token' }),
      makeSessionWithMetadata({ id: 'sess-2', session_token: 'current-token' }),
    ];
    mockSessionRepo.findAllByUserId.mockResolvedValue(sessions);

    const result = await service.listSessions('user-uuid-1', 'current-token');

    expect(result[0].isCurrentSession).toBe(true);
  });
});

describe('AuthService — revoke session', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockUserRepo as unknown as UserRepository,
      mockSessionRepo as unknown as SessionRepository,
    );
  });

  it('revokes a session by its ID scoped to the authenticated user', async () => {
    const session = makeSessionWithMetadata({ id: 'sess-to-revoke', user_id: 'user-uuid-1' });
    mockSessionRepo.findAllByUserId.mockResolvedValue([session]);
    mockSessionRepo.deleteById.mockResolvedValue(undefined);

    await service.revokeSession('user-uuid-1', 'sess-to-revoke');

    expect(mockSessionRepo.deleteById).toHaveBeenCalledWith('sess-to-revoke', 'user-uuid-1');
  });

  it('throws NotFoundException when session does not belong to user', async () => {
    mockSessionRepo.deleteById.mockRejectedValue(new Error('not found'));

    await expect(service.revokeSession('user-uuid-1', 'sess-not-owned')).rejects.toThrow();
  });

  it('revokes all other sessions excluding the current one', async () => {
    mockSessionRepo.deleteAllOtherByUserId.mockResolvedValue(undefined);

    await service.revokeAllOtherSessions('user-uuid-1', 'current-token');

    expect(mockSessionRepo.deleteAllOtherByUserId).toHaveBeenCalledWith(
      'user-uuid-1',
      'current-token',
    );
  });

  it('supports revoking the current session itself', async () => {
    mockSessionRepo.deleteById.mockResolvedValue(undefined);
    const sessions = [makeSessionWithMetadata({ id: 'current-sess', user_id: 'user-uuid-1', session_token: 'current-token' })];
    mockSessionRepo.findAllByUserId.mockResolvedValue(sessions);

    // revokeSession is called with session ID, not token
    await service.revokeSession('user-uuid-1', 'current-sess');

    expect(mockSessionRepo.deleteById).toHaveBeenCalledWith('current-sess', 'user-uuid-1');
  });
});

describe('SessionRepository — extended inventory methods', () => {
  it('exports findAllByUserId, deleteById, deleteAllOtherByUserId', async () => {
    const mod = await import('../../auth/session.repository.js');
    const repo = new mod.SessionRepository(null as never);
    expect(typeof (repo as unknown as Record<string, unknown>)['findAllByUserId']).toBe('function');
    expect(typeof (repo as unknown as Record<string, unknown>)['deleteById']).toBe('function');
    expect(typeof (repo as unknown as Record<string, unknown>)['deleteAllOtherByUserId']).toBe('function');
  });
});
