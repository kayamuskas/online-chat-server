import { SERVICE_PORTS } from "@chat/shared";
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) {
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  socket = io(`http://localhost:${SERVICE_PORTS.apiHttp}`, {
    withCredentials: true,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
