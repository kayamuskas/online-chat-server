import { Injectable } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

function userChannel(userId: string): string {
  return `user:${userId}`;
}

@Injectable()
export class RealtimeEventsService {
  private server: Server | null = null;

  bindServer(server: Server): void {
    this.server = server;
  }

  joinUserChannel(client: Socket, userId: string): void {
    void client.join(userChannel(userId));
  }

  emitFriendRequestsUpdated(userId: string): void {
    this.server?.to(userChannel(userId)).emit('friend-requests-updated', { userId });
  }

  emitContactsUpdated(userId: string): void {
    this.server?.to(userChannel(userId)).emit('contacts-updated', { userId });
  }
}
