import { io, type Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(`${SERVER_URL}/support`, {
            withCredentials: true,
            autoConnect: false,
            transports: ['websocket', 'polling'],
        });
    }
    return socket;
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
