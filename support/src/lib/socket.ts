import { io, type Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5000';

let socket: Socket | null = null;

// Listeners that must outlive a socket being torn down and recreated
// (useLiveCounts disconnects on unmount) — re-attached to every new socket.
type Handler = Parameters<Socket['on']>[1];
const persistent = new Set<[string, Handler]>();

export function getSocket(): Socket {
    if (!socket) {
        socket = io(`${SERVER_URL}/support`, {
            withCredentials: true,
            autoConnect: false,
            transports: ['websocket', 'polling'],
        });
        for (const [event, handler] of persistent) socket.on(event, handler);
    }
    return socket;
}

/** Subscribes for the app's lifetime, across socket reconnects. Returns an unsubscribe. */
export function onSocketEvent(event: string, handler: Handler): () => void {
    const entry: [string, Handler] = [event, handler];
    persistent.add(entry);
    socket?.on(event, handler);
    return () => {
        persistent.delete(entry);
        socket?.off(event, handler);
    };
}

export function connectSocket(): Socket {
    const s = getSocket();
    if (!s.connected) s.connect();
    return s;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
