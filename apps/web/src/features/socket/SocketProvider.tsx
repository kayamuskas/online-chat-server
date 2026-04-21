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

  // Activity tracking: emit "activity" on user interaction so the server
  // resets the AFK timer. Throttled to at most once every 10 seconds.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    let lastEmit = 0;
    const THROTTLE_MS = 10_000;

    function emitActivity() {
      const now = Date.now();
      if (now - lastEmit < THROTTLE_MS) return;
      lastEmit = now;
      socketRef.current?.emit("activity");
    }

    const events = ["mousemove", "keydown", "click", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, emitActivity));

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        lastEmit = 0; // force immediate emit on tab focus
        emitActivity();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      events.forEach((e) => window.removeEventListener(e, emitActivity));
      document.removeEventListener("visibilitychange", handleVisibility);
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
