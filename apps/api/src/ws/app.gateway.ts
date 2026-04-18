/**
 * AppGateway — authenticated WebSocket presence transport.
 *
 * Phase 3 upgrade: turns the Phase 1 handshake-only gateway into a full
 * presence transport that:
 *  1. Authenticates connections via the existing session cookie.
 *  2. Registers/deregisters tabs with PresenceService on connect/disconnect.
 *  3. Accepts client 'activity' events (mouse, keyboard, focus, visibility)
 *     and forwards them to PresenceService to reset the AFK timer.
 *  4. Answers 'getPresence' requests by returning a PresenceMap to the caller.
 *
 * Threat model:
 *  T-03-05 — sockets that fail session auth are disconnected immediately.
 *  T-03-06 — per-tab runtime state is tracked with heartbeat/AFK semantics
 *             rather than trusting a single connect/disconnect event.
 */

import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { extractSessionToken } from './ws-auth.js';
import { PresenceService } from '../presence/presence.service.js';
import { AuthService } from '../auth/auth.service.js';

/** Minimal payload for the 'getPresence' event from the client. */
interface GetPresencePayload {
  userIds: string[];
}

const MAX_PRESENCE_USER_IDS = 500;

@WebSocketGateway({ cors: { origin: '*' } })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  /**
   * Socket-ID → userId map for authenticated connections.
   * Used to look up userId on disconnect and activity events without
   * re-validating the session cookie on every message.
   */
  private readonly socketUserMap = new Map<string, string>();

  constructor(
    private readonly presenceService: PresenceService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Handle new socket connections.
   *
   * 1. Extract the session token from the handshake cookie.
   * 2. Validate against the auth service.
   * 3. If invalid → disconnect immediately (Threat T-03-05).
   * 4. If valid → register the tab with PresenceService.
   */
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

    const userId = result.user.id;
    this.socketUserMap.set(client.id, userId);
    this.presenceService.tabConnected(userId, client.id);

    client.emit('ready', { status: 'connected', service: 'api' });
  }

  /**
   * Handle socket disconnections.
   *
   * Deregisters the tab from PresenceService. If this was the last tab for
   * the user, PresenceService will persist durable last seen.
   */
  handleDisconnect(client: Socket): void {
    const userId = this.socketUserMap.get(client.id);
    if (!userId) return;

    this.socketUserMap.delete(client.id);
    this.presenceService.tabDisconnected(userId, client.id);
  }

  /**
   * Handle client activity signals (mouse, keyboard, focus, visibility).
   *
   * Updates the tab's lastActivityAt timestamp to reset the AFK timer.
   * Unauthenticated sockets are silently ignored.
   */
  @SubscribeMessage('activity')
  handleActivity(@ConnectedSocket() client: Socket): void {
    const userId = this.socketUserMap.get(client.id);
    if (!userId) return;
    this.presenceService.tabActivity(userId, client.id);
  }

  /**
   * Handle 'getPresence' requests from authenticated clients.
   *
   * Returns a PresenceMap for the requested user IDs. Unauthenticated
   * sockets receive no response.
   */
  @SubscribeMessage('getPresence')
  handleGetPresence(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ): void {
    const userId = this.socketUserMap.get(client.id);
    if (!userId) return;

    const payload = data as Partial<GetPresencePayload> | null;
    const userIds = Array.isArray(payload?.userIds)
      ? payload.userIds
          .filter((value): value is string => typeof value === 'string')
          .slice(0, MAX_PRESENCE_USER_IDS)
      : [];

    const presenceMap = this.presenceService.getUsersPresence(userIds);
    client.emit('presence', presenceMap);
  }

  /**
   * ping → pong handshake (preserved from Phase 1).
   *
   * Returns a pong payload so smoke tests and the web client can confirm
   * the WebSocket transport is alive. Now requires authentication.
   */
  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() _data?: unknown,
    @ConnectedSocket() _client?: Socket,
  ): { event: string; data: { status: string } } {
    return { event: 'pong', data: { status: 'ok' } };
  }
}
