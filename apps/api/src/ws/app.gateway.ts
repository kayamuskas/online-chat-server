import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

/**
 * AppGateway — Phase 1 WebSocket boundary.
 *
 * SECURITY NOTE (T-01-07): This gateway exposes only a handshake/ping surface.
 * No room, auth, or message actions are implemented here. Additional handlers
 * must not be added until Phase 2 auth guards are in place.
 *
 * The gateway listens on the default Socket.IO namespace ('/') so that the
 * REST and WebSocket surfaces share the same Nest application instance.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  handleConnection(client: Socket): void {
    client.emit('ready', { status: 'connected', service: 'api' });
  }

  handleDisconnect(_client: Socket): void {
    // no cleanup required in Phase 1
  }

  /**
   * ping → pong handshake.
   *
   * Returns a pong payload so smoke tests and the web client can confirm the
   * WebSocket transport is alive without triggering domain behavior.
   */
  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() _data?: unknown,
    @ConnectedSocket() _client?: Socket,
  ): { event: string; data: { status: string } } {
    return { event: 'pong', data: { status: 'ok' } };
  }
}
