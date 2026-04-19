import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { connectSocket, disconnectSocket } from "../../lib/socket";

const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
  authenticated: boolean;
  children: ReactNode;
}

export function SocketProvider({
  authenticated,
  children,
}: SocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);
  const [, forceRender] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (authenticated) {
      socketRef.current = connectSocket();
    } else {
      disconnectSocket();
      socketRef.current = null;
    }

    forceRender();

    return () => {
      if (authenticated) {
        disconnectSocket();
      }
      if (!authenticated) {
        socketRef.current = null;
      }
    };
  }, [authenticated]);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
