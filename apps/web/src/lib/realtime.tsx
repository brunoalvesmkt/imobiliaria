"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const RealtimeContext = createContext<Socket | null>(null);

/**
 * Conecta ao `RealtimeGateway` (Socket.IO, namespace padrão) uma única vez
 * por sessão do painel. A autenticação é pelo cookie de sessão da API
 * (`withCredentials: true`) — o gateway lê o token do cookie
 * `tenant_access_token` quando não recebe `auth.token` no handshake (ver
 * apps/api/src/realtime/realtime.gateway.ts). O servidor junta o cliente
 * automaticamente na room `tenant:<tenantId>` — nada a fazer aqui além de
 * escutar os eventos.
 */
export function RealtimeProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const instance = io(API_URL, { withCredentials: true, transports: ["websocket", "polling"] });
    socketRef.current = instance;
    setSocket(instance);

    return () => {
      instance.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [enabled]);

  return <RealtimeContext.Provider value={socket}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeSocket(): Socket | null {
  return useContext(RealtimeContext);
}

/** Assina um evento do gateway enquanto o componente estiver montado e o socket conectado. */
export function useRealtimeEvent<T = unknown>(event: string, handler: (payload: T) => void): void {
  const socket = useRealtimeSocket();

  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event]);
}
