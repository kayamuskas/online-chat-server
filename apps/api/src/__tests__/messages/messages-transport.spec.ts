/**
 * messages-transport.spec.ts — Transport-layer tests for MessagesController and MessagesGateway.
 *
 * Tests the HTTP controller and WebSocket gateway at the unit level without NestJS DI
 * or a real server. All dependencies are replaced with typed stubs/mocks using vitest.
 *
 * Coverage:
 *
 * MessagesController (HTTP surface):
 *   - Authorized room send: calls service.sendMessage, broadcasts, returns 201
 *   - Authorized DM send: calls service.sendMessage, broadcasts, returns 201
 *   - Authorized room history: calls service.listHistory, returns messages + range
 *   - Authorized DM history: calls service.listHistory, returns messages + range
 *   - Authorized room edit: calls service.editMessage, broadcasts, returns 200
 *   - Authorized DM edit: calls service.editMessage, broadcasts, returns 200
 *   - Rejected send (service throws ForbiddenException): propagates to caller
 *   - Rejected send (invalid body): throws BadRequestException before service call
 *   - Rejected edit (service throws ForbiddenException): propagates to caller
 *
 * MessagesGateway (WebSocket fanout):
 *   - broadcastMessageCreated emits 'message-created' to the correct room channel
 *   - broadcastMessageCreated emits 'message-created' to the correct DM channel
 *   - broadcastMessageEdited emits 'message-edited' to the correct room channel
 *   - broadcastMessageEdited emits 'message-edited' to the correct DM channel
 *   - handleJoinRoom subscribes authenticated socket to room channel
 *   - handleJoinDm subscribes authenticated socket to DM channel
 *   - handleJoinRoom ignores unauthenticated socket
 *   - handleJoinDm ignores unauthenticated socket
 *   - handleLeaveRoom removes socket from room channel
 *   - handleLeaveDm removes socket from DM channel
 *   - handleConnection disconnects socket with no session cookie
 *   - handleConnection disconnects socket with invalid session token
 *   - handleConnection registers authenticated socket in socketUserMap
 *   - handleDisconnect removes socket from socketUserMap
 *
 * Acceptance criteria (from plan):
 * - REST endpoints exist for room and DM history/send/edit
 * - Realtime push reuses authenticated socket context rather than introducing a second auth flow
 * - Transport tests cover both authorized and rejected messaging paths
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { MessagesController } from '../../messages/messages.controller.js';
import { MessagesGateway } from '../../messages/messages.gateway.js';
import type { MessagesService } from '../../messages/messages.service.js';
import type { MessageHistoryResult } from '../../messages/messages.repository.js';
import type { Message, MessageView } from '../../messages/messages.types.js';
import type { AuthContext } from '../../auth/current-user.guard.js';
import { SESSION_COOKIE_NAME } from '../../auth/session-cookie.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-uuid-1',
    conversation_type: 'room',
    conversation_id: 'room-uuid-1',
    author_id: 'user-uuid-1',
    content: 'Hello world',
    reply_to_id: null,
    edited_at: null,
    conversation_watermark: 1,
    created_at: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

function makeMessageView(overrides: Partial<MessageView> = {}): MessageView {
  return {
    id: 'msg-uuid-1',
    conversation_type: 'room',
    conversation_id: 'room-uuid-1',
    author_id: 'user-uuid-1',
    author_username: 'alice',
    content: 'Hello world',
    reply_to_id: null,
    reply_preview: null,
    edited_at: null,
    conversation_watermark: 1,
    created_at: new Date('2026-01-01T10:00:00Z'),
    attachments: [],
    ...overrides,
  };
}

function makeHistoryResult(overrides: Partial<MessageHistoryResult> = {}): MessageHistoryResult {
  return {
    messages: [makeMessageView()],
    range: {
      firstWatermark: 1,
      lastWatermark: 1,
      hasMoreBefore: false,
      totalCount: 1,
    },
    ...overrides,
  };
}

function makeAuthContext(userId = 'user-uuid-1'): AuthContext {
  return {
    user: { id: userId, username: 'alice', email: 'alice@example.com', created_at: new Date() },
    session: {
      id: 'session-1',
      user_id: userId,
      token: 'tok',
      created_at: new Date(),
      last_active_at: new Date(),
      expires_at: new Date(Date.now() + 3600_000),
      ip_address: '127.0.0.1',
      user_agent: 'test',
    },
  };
}

// ── Controller stubs ──────────────────────────────────────────────────────────

function makeServiceStub(): MessagesService {
  return {
    sendMessage: vi.fn(),
    listHistory: vi.fn(),
    editMessage: vi.fn(),
  } as unknown as MessagesService;
}

function makeGatewayStub(): MessagesGateway {
  return {
    broadcastMessageCreated: vi.fn().mockResolvedValue(undefined),
    broadcastMessageEdited: vi.fn().mockResolvedValue(undefined),
  } as unknown as MessagesGateway;
}

// ── MessagesController tests ──────────────────────────────────────────────────

describe('MessagesController', () => {
  let service: MessagesService;
  let gateway: MessagesGateway;
  let controller: MessagesController;
  const ctx = makeAuthContext();

  beforeEach(() => {
    service = makeServiceStub();
    gateway = makeGatewayStub();
    controller = new MessagesController(service, gateway);
  });

  // ── Room history ────────────────────────────────────────────────────────────

  describe('getRoomHistory', () => {
    it('returns messages and range for authorized room member', async () => {
      const result = makeHistoryResult();
      vi.mocked(service.listHistory).mockResolvedValue(result);

      const response = await controller.getRoomHistory('room-uuid-1', {}, ctx);

      expect(service.listHistory).toHaveBeenCalledWith('user-uuid-1', {
        conversation_type: 'room',
        conversation_id: 'room-uuid-1',
        before_watermark: undefined,
        limit: undefined,
      });
      expect(response).toEqual(result);
    });

    it('passes before_watermark and limit query params', async () => {
      const result = makeHistoryResult();
      vi.mocked(service.listHistory).mockResolvedValue(result);

      await controller.getRoomHistory(
        'room-uuid-1',
        { before_watermark: '10', limit: '25' },
        ctx,
      );

      expect(service.listHistory).toHaveBeenCalledWith('user-uuid-1', {
        conversation_type: 'room',
        conversation_id: 'room-uuid-1',
        before_watermark: 10,
        limit: 25,
      });
    });

    it('propagates ForbiddenException from service (D-30)', async () => {
      vi.mocked(service.listHistory).mockRejectedValue(
        new ForbiddenException('You are banned from this room'),
      );

      await expect(controller.getRoomHistory('room-uuid-1', {}, ctx)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ── Room send ───────────────────────────────────────────────────────────────

  describe('sendRoomMessage', () => {
    it('sends message, broadcasts, and returns 201 payload', async () => {
      const msg = makeMessageView();
      vi.mocked(service.sendMessage).mockResolvedValue(msg);

      const response = await controller.sendRoomMessage(
        'room-uuid-1',
        { content: 'Hello world' },
        ctx,
      );

      expect(service.sendMessage).toHaveBeenCalledWith({
        conversation_type: 'room',
        conversation_id: 'room-uuid-1',
        author_id: 'user-uuid-1',
        content: 'Hello world',
        reply_to_id: null,
      });
      expect(gateway.broadcastMessageCreated).toHaveBeenCalledWith(msg);
      expect(response).toEqual({ message: msg });
    });

    it('includes reply_to_id when provided', async () => {
      const msg = makeMessageView({ reply_to_id: 'parent-uuid' });
      vi.mocked(service.sendMessage).mockResolvedValue(msg);

      await controller.sendRoomMessage(
        'room-uuid-1',
        { content: 'Reply!', reply_to_id: 'parent-uuid' },
        ctx,
      );

      expect(service.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ reply_to_id: 'parent-uuid' }),
      );
    });

    it('throws BadRequestException for empty content (before service call)', async () => {
      await expect(
        controller.sendRoomMessage('room-uuid-1', { content: '' }, ctx),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(service.sendMessage).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for missing content body', async () => {
      await expect(
        controller.sendRoomMessage('room-uuid-1', {}, ctx),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('propagates ForbiddenException from service (D-30)', async () => {
      vi.mocked(service.sendMessage).mockRejectedValue(
        new ForbiddenException('You are not a member of this room'),
      );

      await expect(
        controller.sendRoomMessage('room-uuid-1', { content: 'Hi' }, ctx),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(gateway.broadcastMessageCreated).not.toHaveBeenCalled();
    });
  });

  // ── Room edit ───────────────────────────────────────────────────────────────

  describe('editRoomMessage', () => {
    it('edits message, broadcasts, and returns updated message', async () => {
      const msg = makeMessage({ content: 'Updated content', edited_at: new Date() });
      vi.mocked(service.editMessage).mockResolvedValue(msg);

      const response = await controller.editRoomMessage(
        'msg-uuid-1',
        { new_content: 'Updated content' },
        ctx,
      );

      expect(service.editMessage).toHaveBeenCalledWith({
        message_id: 'msg-uuid-1',
        caller_id: 'user-uuid-1',
        new_content: 'Updated content',
      });
      expect(gateway.broadcastMessageEdited).toHaveBeenCalledWith(msg);
      expect(response).toEqual({ message: msg });
    });

    it('throws BadRequestException for missing new_content', async () => {
      await expect(
        controller.editRoomMessage('msg-uuid-1', {}, ctx),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(service.editMessage).not.toHaveBeenCalled();
    });

    it('propagates ForbiddenException from service (MSG-04 author check)', async () => {
      vi.mocked(service.editMessage).mockRejectedValue(
        new ForbiddenException('Forbidden: only the author may edit this message'),
      );

      await expect(
        controller.editRoomMessage('msg-uuid-1', { new_content: 'Hi' }, ctx),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(gateway.broadcastMessageEdited).not.toHaveBeenCalled();
    });
  });

  // ── DM history ──────────────────────────────────────────────────────────────

  describe('getDmHistory', () => {
    it('returns messages and range for DM participant (D-31)', async () => {
      const result = makeHistoryResult({
        messages: [makeMessageView({ conversation_type: 'dm', conversation_id: 'dm-uuid-1' })],
      });
      vi.mocked(service.listHistory).mockResolvedValue(result);

      const response = await controller.getDmHistory('dm-uuid-1', {}, ctx);

      expect(service.listHistory).toHaveBeenCalledWith('user-uuid-1', {
        conversation_type: 'dm',
        conversation_id: 'dm-uuid-1',
        before_watermark: undefined,
        limit: undefined,
      });
      expect(response).toEqual(result);
    });

    it('allows history on frozen DM conversation (D-32 read-only semantics)', async () => {
      // Service handles the allowFrozen=true logic; controller just delegates.
      const result = makeHistoryResult();
      vi.mocked(service.listHistory).mockResolvedValue(result);

      const response = await controller.getDmHistory('frozen-dm-uuid', {}, ctx);
      expect(response).toEqual(result);
    });
  });

  // ── DM send ─────────────────────────────────────────────────────────────────

  describe('sendDmMessage', () => {
    it('sends DM message, broadcasts to DM channel, returns 201', async () => {
      const msg = makeMessageView({ conversation_type: 'dm', conversation_id: 'dm-uuid-1' });
      vi.mocked(service.sendMessage).mockResolvedValue(msg);

      const response = await controller.sendDmMessage(
        'dm-uuid-1',
        { content: 'Hey there' },
        ctx,
      );

      expect(service.sendMessage).toHaveBeenCalledWith({
        conversation_type: 'dm',
        conversation_id: 'dm-uuid-1',
        author_id: 'user-uuid-1',
        content: 'Hey there',
        reply_to_id: null,
      });
      expect(gateway.broadcastMessageCreated).toHaveBeenCalledWith(msg);
      expect(response).toEqual({ message: msg });
    });

    it('propagates ForbiddenException for frozen DM send (D-32)', async () => {
      vi.mocked(service.sendMessage).mockRejectedValue(
        new ForbiddenException('This DM conversation is frozen and read-only (D-32)'),
      );

      await expect(
        controller.sendDmMessage('frozen-dm', { content: 'Hi' }, ctx),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(gateway.broadcastMessageCreated).not.toHaveBeenCalled();
    });
  });

  // ── DM edit ─────────────────────────────────────────────────────────────────

  describe('editDmMessage', () => {
    it('edits DM message, broadcasts, returns updated message', async () => {
      const msg = makeMessage({
        conversation_type: 'dm',
        conversation_id: 'dm-uuid-1',
        content: 'Edited',
        edited_at: new Date(),
      });
      vi.mocked(service.editMessage).mockResolvedValue(msg);

      const response = await controller.editDmMessage('msg-uuid-1', { new_content: 'Edited' }, ctx);

      expect(service.editMessage).toHaveBeenCalledWith({
        message_id: 'msg-uuid-1',
        caller_id: 'user-uuid-1',
        new_content: 'Edited',
      });
      expect(gateway.broadcastMessageEdited).toHaveBeenCalledWith(msg);
      expect(response).toEqual({ message: msg });
    });
  });
});

// ── MessagesGateway tests ─────────────────────────────────────────────────────

describe('MessagesGateway', () => {
  let authService: { getCurrentUser: ReturnType<typeof vi.fn> };
  let gateway: MessagesGateway;

  // Minimal Socket stub
  function makeSocket(id = 'socket-1', cookieHeader?: string): {
    id: string;
    handshake: { headers: Record<string, string> };
    join: ReturnType<typeof vi.fn>;
    leave: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  } {
    return {
      id,
      handshake: {
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      },
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      emit: vi.fn(),
    };
  }

  // Server stub
  const serverRoomEmit = vi.fn();
  const serverStub = {
    to: vi.fn().mockReturnValue({ emit: serverRoomEmit }),
  };

  beforeEach(() => {
    authService = { getCurrentUser: vi.fn() };
    gateway = new MessagesGateway(authService as never);
    // Inject the server stub via the private property (Reflect for testing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gateway as any).server = serverStub;
    serverStub.to.mockClear();
    serverRoomEmit.mockClear();
  });

  // ── Connection auth ─────────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('disconnects socket with no session cookie', async () => {
      const client = makeSocket('s1');
      await gateway.handleConnection(client as never);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects socket with invalid session token', async () => {
      const client = makeSocket('s2', `${SESSION_COOKIE_NAME}=bad-token`);
      authService.getCurrentUser.mockResolvedValue(null);
      await gateway.handleConnection(client as never);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('registers authenticated socket in socketUserMap', async () => {
      const client = makeSocket('s3', `${SESSION_COOKIE_NAME}=valid-token`);
      authService.getCurrentUser.mockResolvedValue({
        user: { id: 'user-uuid-1', username: 'alice' },
        session: {},
      });
      await gateway.handleConnection(client as never);
      expect(client.disconnect).not.toHaveBeenCalled();
      // Verify the socket is now accepted (join should work after this)
      gateway.handleJoinRoom({ roomId: 'r1' }, client as never);
      expect(client.join).toHaveBeenCalledWith('room:r1');
    });
  });

  describe('handleDisconnect', () => {
    it('removes socket from socketUserMap on disconnect', async () => {
      const client = makeSocket('s4', `${SESSION_COOKIE_NAME}=tok`);
      authService.getCurrentUser.mockResolvedValue({
        user: { id: 'user-uuid-2', username: 'bob' },
        session: {},
      });
      await gateway.handleConnection(client as never);
      gateway.handleDisconnect(client as never);
      // After disconnect, joinRoom should be ignored (unauthenticated path)
      gateway.handleJoinRoom({ roomId: 'r1' }, client as never);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  // ── Room subscription ───────────────────────────────────────────────────────

  describe('handleJoinRoom', () => {
    it('subscribes authenticated socket to room channel', async () => {
      const client = makeSocket('s5', `${SESSION_COOKIE_NAME}=tok`);
      authService.getCurrentUser.mockResolvedValue({
        user: { id: 'user-uuid-1', username: 'alice' },
        session: {},
      });
      await gateway.handleConnection(client as never);

      gateway.handleJoinRoom({ roomId: 'room-uuid-1' }, client as never);

      expect(client.join).toHaveBeenCalledWith('room:room-uuid-1');
    });

    it('ignores unauthenticated socket (T-06-05)', () => {
      const client = makeSocket('s6');
      gateway.handleJoinRoom({ roomId: 'room-uuid-1' }, client as never);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('ignores joinRoom with empty roomId', async () => {
      const client = makeSocket('s7', `${SESSION_COOKIE_NAME}=tok`);
      authService.getCurrentUser.mockResolvedValue({
        user: { id: 'u1', username: 'a' },
        session: {},
      });
      await gateway.handleConnection(client as never);
      gateway.handleJoinRoom({ roomId: '' }, client as never);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleLeaveRoom', () => {
    it('removes socket from room channel', () => {
      const client = makeSocket('s8');
      gateway.handleLeaveRoom({ roomId: 'room-uuid-1' }, client as never);
      expect(client.leave).toHaveBeenCalledWith('room:room-uuid-1');
    });
  });

  // ── DM subscription ─────────────────────────────────────────────────────────

  describe('handleJoinDm', () => {
    it('subscribes authenticated socket to DM channel', async () => {
      const client = makeSocket('s9', `${SESSION_COOKIE_NAME}=tok`);
      authService.getCurrentUser.mockResolvedValue({
        user: { id: 'user-uuid-1', username: 'alice' },
        session: {},
      });
      await gateway.handleConnection(client as never);

      gateway.handleJoinDm({ conversationId: 'dm-uuid-1' }, client as never);

      expect(client.join).toHaveBeenCalledWith('dm:dm-uuid-1');
    });

    it('ignores unauthenticated socket (T-06-05)', () => {
      const client = makeSocket('s10');
      gateway.handleJoinDm({ conversationId: 'dm-uuid-1' }, client as never);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleLeaveDm', () => {
    it('removes socket from DM channel', () => {
      const client = makeSocket('s11');
      gateway.handleLeaveDm({ conversationId: 'dm-uuid-1' }, client as never);
      expect(client.leave).toHaveBeenCalledWith('dm:dm-uuid-1');
    });
  });

  // ── Broadcast fanout ─────────────────────────────────────────────────────────

  describe('broadcastMessageCreated', () => {
    it('emits message-created to correct room channel (D-34)', async () => {
      const msg = makeMessageView({
        id: 'msg-1',
        conversation_type: 'room',
        conversation_id: 'room-uuid-1',
        author_id: 'user-uuid-1',
        content: 'Hello',
        conversation_watermark: 5,
      });

      await gateway.broadcastMessageCreated(msg);

      expect(serverStub.to).toHaveBeenCalledWith('room:room-uuid-1');
      expect(serverRoomEmit).toHaveBeenCalledWith(
        'message-created',
        expect.objectContaining({
          conversation_type: 'room',
          conversation_id: 'room-uuid-1',
          message: expect.objectContaining({
            id: 'msg-1',
            content: 'Hello',
            conversation_watermark: 5,
          }),
        }),
      );
    });

    it('emits message-created to correct DM channel (D-34)', async () => {
      const msg = makeMessageView({
        id: 'msg-2',
        conversation_type: 'dm',
        conversation_id: 'dm-uuid-1',
        author_id: 'user-uuid-2',
        content: 'Hey!',
        conversation_watermark: 3,
      });

      await gateway.broadcastMessageCreated(msg);

      expect(serverStub.to).toHaveBeenCalledWith('dm:dm-uuid-1');
      expect(serverRoomEmit).toHaveBeenCalledWith(
        'message-created',
        expect.objectContaining({
          conversation_type: 'dm',
          conversation_id: 'dm-uuid-1',
        }),
      );
    });
  });

  describe('broadcastMessageEdited', () => {
    it('emits message-edited to correct room channel (MSG-04, D-25)', async () => {
      const editedAt = new Date();
      const msg = {
        id: 'msg-3',
        conversation_type: 'room' as const,
        conversation_id: 'room-uuid-2',
        author_id: 'user-uuid-1',
        content: 'Edited content',
        reply_to_id: null,
        edited_at: editedAt,
        conversation_watermark: 7,
        created_at: new Date(),
      };

      await gateway.broadcastMessageEdited(msg);

      expect(serverStub.to).toHaveBeenCalledWith('room:room-uuid-2');
      expect(serverRoomEmit).toHaveBeenCalledWith(
        'message-edited',
        expect.objectContaining({
          message: expect.objectContaining({
            id: 'msg-3',
            content: 'Edited content',
            edited_at: editedAt,
            // watermark is preserved (D-25)
            conversation_watermark: 7,
          }),
        }),
      );
    });

    it('emits message-edited to correct DM channel', async () => {
      const msg = {
        id: 'msg-4',
        conversation_type: 'dm' as const,
        conversation_id: 'dm-uuid-2',
        author_id: 'user-uuid-1',
        content: 'Edited DM',
        reply_to_id: null,
        edited_at: new Date(),
        conversation_watermark: 2,
        created_at: new Date(),
      };

      await gateway.broadcastMessageEdited(msg);

      expect(serverStub.to).toHaveBeenCalledWith('dm:dm-uuid-2');
      expect(serverRoomEmit).toHaveBeenCalledWith('message-edited', expect.any(Object));
    });
  });
});
