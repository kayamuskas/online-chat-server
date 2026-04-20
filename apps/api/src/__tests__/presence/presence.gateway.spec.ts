/**
 * AppGateway presence integration tests — TDD RED phase (Task 1)
 *
 * Covers:
 *  - Gateway rejects unauthenticated connections (no session cookie)
 *  - Gateway registers tabConnected on authenticated connection
 *  - Gateway calls tabDisconnected on disconnect
 *  - Gateway calls tabActivity on 'activity' event
 *  - Gateway emits 'presence' event back to the caller on 'getPresence' request
 *
 * Uses plain object stubs instead of NestJS testing module to avoid
 * the @nestjs/testing devDependency requirement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppGateway } from '../../ws/app.gateway.js';
import type { PresenceService } from '../../presence/presence.service.js';
import type { AuthService } from '../../auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../../auth/session-cookie.js';

// ── stubs ─────────────────────────────────────────────────────────────────────

function makePresenceService(): PresenceService {
  return {
    tabConnected: vi.fn(),
    tabDisconnected: vi.fn(),
    tabActivity: vi.fn(),
    getUserPresence: vi.fn().mockReturnValue('online'),
    getUsersPresence: vi.fn().mockReturnValue({}),
    shutdown: vi.fn(),
  } as unknown as PresenceService;
}

function makeAuthService(userId: string | null = 'user-123'): AuthService {
  return {
    getCurrentUser: vi.fn().mockImplementation(async (token: string) => {
      if (!token || token === 'bad') return null;
      return { user: { id: userId, username: 'alice' }, session: { id: 'sess-1', session_token: token } };
    }),
  } as unknown as AuthService;
}

function makeSocket(cookie?: string): {
  id: string;
  handshake: { headers: { cookie?: string } };
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
} {
  return {
    id: 'socket-xyz',
    handshake: { headers: { cookie } },
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AppGateway presence', () => {
  let gateway: AppGateway;
  let presenceService: PresenceService;
  let authService: AuthService;

  beforeEach(() => {
    presenceService = makePresenceService();
    authService = makeAuthService();
    gateway = new AppGateway(presenceService, authService);
  });

  // ── Authentication gate ─────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('disconnects sockets that present no session cookie', async () => {
      const socket = makeSocket(undefined);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(presenceService.tabConnected).not.toHaveBeenCalled();
    });

    it('disconnects sockets with an invalid session token', async () => {
      const socket = makeSocket(`${SESSION_COOKIE_NAME}=bad`);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(presenceService.tabConnected).not.toHaveBeenCalled();
    });

    it('registers tabConnected for authenticated connections', async () => {
      const socket = makeSocket(`${SESSION_COOKIE_NAME}=valid-token`);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(presenceService.tabConnected).toHaveBeenCalledWith('user-123', 'socket-xyz');
    });

    it('emits ready event on successful authentication', async () => {
      const socket = makeSocket(`${SESSION_COOKIE_NAME}=valid-token`);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      expect(socket.emit).toHaveBeenCalledWith('ready', expect.objectContaining({ status: 'connected' }));
    });
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────

  describe('handleDisconnect', () => {
    it('calls tabDisconnected for previously authenticated sockets', async () => {
      const socket = makeSocket(`${SESSION_COOKIE_NAME}=valid-token`);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      gateway.handleDisconnect(socket as unknown as import('socket.io').Socket);
      expect(presenceService.tabDisconnected).toHaveBeenCalledWith('user-123', 'socket-xyz');
    });

    it('does not throw when disconnecting an unauthenticated socket', async () => {
      const socket = makeSocket(undefined);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      expect(() => gateway.handleDisconnect(socket as unknown as import('socket.io').Socket)).not.toThrow();
    });
  });

  // ── Activity event ──────────────────────────────────────────────────────────

  describe('handleActivity', () => {
    it('calls tabActivity for authenticated sockets', async () => {
      const socket = makeSocket(`${SESSION_COOKIE_NAME}=valid-token`);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      gateway.handleActivity(socket as unknown as import('socket.io').Socket);
      expect(presenceService.tabActivity).toHaveBeenCalledWith('user-123', 'socket-xyz');
    });

    it('does not call tabActivity for unauthenticated sockets', async () => {
      const socket = makeSocket(undefined);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      gateway.handleActivity(socket as unknown as import('socket.io').Socket);
      expect(presenceService.tabActivity).not.toHaveBeenCalled();
    });
  });

  // ── getPresence event ───────────────────────────────────────────────────────

  describe('handleGetPresence', () => {
    it('emits presence event with current status for requested users', async () => {
      const socket = makeSocket(`${SESSION_COOKIE_NAME}=valid-token`);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      vi.mocked(presenceService.getUsersPresence).mockReturnValue({ 'user-1': 'online', 'user-2': 'afk' });

      gateway.handleGetPresence(
        { userIds: ['user-1', 'user-2'] },
        socket as unknown as import('socket.io').Socket,
      );

      expect(socket.emit).toHaveBeenCalledWith(
        'presence',
        expect.objectContaining({ 'user-1': 'online', 'user-2': 'afk' }),
      );
    });

    it('does not emit presence for unauthenticated sockets', async () => {
      const socket = makeSocket(undefined);
      await gateway.handleConnection(socket as unknown as import('socket.io').Socket);
      socket.emit.mockClear();
      gateway.handleGetPresence({ userIds: ['user-1'] }, socket as unknown as import('socket.io').Socket);
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });
});
