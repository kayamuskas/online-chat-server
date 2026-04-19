/**
 * MessagesGateway — Phase 6 realtime message fanout.
 *
 * Responsibilities:
 * - Accept 'joinRoom' / 'leaveRoom' / 'joinDm' / 'leaveDm' events from
 *   authenticated clients so they can subscribe to conversation updates.
 * - Emit 'message-created' and 'message-edited' events to the correct
 *   Socket.IO room after a write succeeds via the HTTP layer.
 *
 * Authentication model (D-34):
 * - This gateway uses the same session-cookie pattern as AppGateway.
 * - handleConnection validates the session token from the handshake cookie;
 *   unauthenticated connections are disconnected immediately.
 * - socketUserMap mirrors the pattern in AppGateway for the messaging namespace.
 *
 * Architecture note:
 * - MessagesGateway runs on the same Socket.IO server as AppGateway (same port,
 *   different namespace: '/messages'). The Socket.IO Server instance is shared
 *   within the same NestJS application; both gateways emit on the same underlying
 *   server, but subscribe to different events.
 * - REST owns all state mutations and history recovery (D-33).
 * - WebSocket is limited to fanout — no client may initiate a message write
 *   through the WebSocket channel (D-34).
 *
 * Threat model:
 * - T-06-05: Only authenticated sockets may subscribe to room/DM streams.
 * - T-06-06: 'joinRoom' / 'joinDm' events do NOT re-check membership at the
 *            gateway layer; access is enforced at the HTTP write path.
 *            Phase 9 may tighten this with membership verification at join time.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { extractSessionToken } from '../ws/ws-auth.js';
import type { Message } from './messages.types.js';

// ── Join/leave payload shapes ─────────────────────────────────────────────────

interface JoinRoomPayload {
  roomId?: string;
}

interface LeaveRoomPayload {
  roomId?: string;
}

interface JoinDmPayload {
  conversationId?: string;
}

interface LeaveDmPayload {
  conversationId?: string;
}

// ── Channel name helpers ──────────────────────────────────────────────────────

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

function dmChannel(conversationId: string): string {
  return `dm:${conversationId}`;
}

// ── Gateway ───────────────────────────────────────────────────────────────────

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  /**
   * Socket-ID → userId map for authenticated connections.
   * Populated on successful handleConnection; cleared on handleDisconnect.
   */
  private readonly socketUserMap = new Map<string, string>();

  constructor(private readonly authService: AuthService) {}

  // ── Connection lifecycle ──────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    const token = extractSessionToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    const result = await this.authService.getCurrentUser(token);
    if (!result) {
      client.disconnect(true);
      return;
    }

    this.socketUserMap.set(client.id, result.user.id);
  }

  handleDisconnect(client: Socket): void {
    this.socketUserMap.delete(client.id);
  }

  // ── Room subscription ─────────────────────────────────────────────────────

  /**
   * Handle 'joinRoom' from authenticated clients.
   *
   * Subscribes the socket to the room channel so it receives
   * 'message-created' and 'message-edited' push events for that room.
   * Unauthenticated sockets are silently ignored.
   */
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ): void {
    const userId = this.socketUserMap.get(client.id);
    if (!userId) return;

    const payload = data as Partial<JoinRoomPayload> | null;
    const roomId = typeof payload?.roomId === 'string' ? payload.roomId.trim() : '';
    if (!roomId) return;

    void client.join(roomChannel(roomId));
  }

  /**
   * Handle 'leaveRoom' from authenticated clients.
   */
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ): void {
    const payload = data as Partial<LeaveRoomPayload> | null;
    const roomId = typeof payload?.roomId === 'string' ? payload.roomId.trim() : '';
    if (!roomId) return;

    void client.leave(roomChannel(roomId));
  }

  // ── DM subscription ───────────────────────────────────────────────────────

  /**
   * Handle 'joinDm' from authenticated clients.
   */
  @SubscribeMessage('joinDm')
  handleJoinDm(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ): void {
    const userId = this.socketUserMap.get(client.id);
    if (!userId) return;

    const payload = data as Partial<JoinDmPayload> | null;
    const conversationId =
      typeof payload?.conversationId === 'string' ? payload.conversationId.trim() : '';
    if (!conversationId) return;

    void client.join(dmChannel(conversationId));
  }

  /**
   * Handle 'leaveDm' from authenticated clients.
   */
  @SubscribeMessage('leaveDm')
  handleLeaveDm(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ): void {
    const payload = data as Partial<LeaveDmPayload> | null;
    const conversationId =
      typeof payload?.conversationId === 'string' ? payload.conversationId.trim() : '';
    if (!conversationId) return;

    void client.leave(dmChannel(conversationId));
  }

  // ── Broadcast helpers (called from MessagesController) ────────────────────

  /**
   * Broadcast a 'message-created' event to all sockets subscribed to the
   * relevant conversation channel.
   *
   * Called by MessagesController after a successful message write (D-34).
   */
  async broadcastMessageCreated(message: Message): Promise<void> {
    const channel =
      message.conversation_type === 'room'
        ? roomChannel(message.conversation_id)
        : dmChannel(message.conversation_id);

    this.server.to(channel).emit('message-created', {
      conversation_type: message.conversation_type,
      conversation_id: message.conversation_id,
      message: {
        id: message.id,
        author_id: message.author_id,
        content: message.content,
        reply_to_id: message.reply_to_id,
        edited_at: message.edited_at,
        conversation_watermark: message.conversation_watermark,
        created_at: message.created_at,
      },
    });
  }

  /**
   * Broadcast a 'message-edited' event to all sockets subscribed to the
   * relevant conversation channel.
   *
   * MSG-04: Only content and edited_at change; watermark and created_at are preserved.
   */
  async broadcastMessageEdited(message: Message): Promise<void> {
    const channel =
      message.conversation_type === 'room'
        ? roomChannel(message.conversation_id)
        : dmChannel(message.conversation_id);

    this.server.to(channel).emit('message-edited', {
      conversation_type: message.conversation_type,
      conversation_id: message.conversation_id,
      message: {
        id: message.id,
        author_id: message.author_id,
        content: message.content,
        reply_to_id: message.reply_to_id,
        edited_at: message.edited_at,
        conversation_watermark: message.conversation_watermark,
        created_at: message.created_at,
      },
    });
  }
}
