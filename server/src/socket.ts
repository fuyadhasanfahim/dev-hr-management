import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { registerSupportNamespace } from './socket/support.namespace.js';

let io: SocketIOServer;

// Map of userId to array of socketIds
const userSockets = new Map<string, string[]>();

export const initSocket = (server: HttpServer) => {
    io = new SocketIOServer(server, {
        cors: {
            origin: (process.env.TRUSTED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean),
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    // Initialize support namespace
    registerSupportNamespace(io);

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        socket.on('authenticate', (userId: string) => {
            if (userId) {
                const uid = userId.toString();
                socket.data.userId = uid;
                const existingSockets = userSockets.get(uid) || [];
                userSockets.set(uid, [...existingSockets, socket.id]);
                console.log(`User ${uid} authenticated on socket ${socket.id}`);
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            const userId = socket.data.userId;
            if (userId) {
                const uid = userId.toString();
                const existingSockets = userSockets.get(uid) || [];
                const updatedSockets = existingSockets.filter((id) => id !== socket.id);
                if (updatedSockets.length > 0) {
                    userSockets.set(uid, updatedSockets);
                } else {
                    userSockets.delete(uid);
                }
            }
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

export const getUserSockets = (userId: string): string[] => {
    return userSockets.get(userId?.toString()) || [];
};

export const emitToUser = (userId: string, event: string, data: any) => {
    if (!io || !userId) return;
    const uid = userId.toString();
    const sockets = userSockets.get(uid);
    if (sockets && sockets.length > 0) {
        sockets.forEach((socketId) => {
            io.to(socketId).emit(event, data);
        });
    }
};

export const broadcastEvent = (event: string, data: any) => {
    if (!io) return;
    io.emit(event, data);
};

export const broadcastPolicyPrompt = (targetUserIds: string[], policyData: any) => {
    targetUserIds.forEach((userId) => {
        emitToUser(userId, 'policy:prompt', policyData);
    });
};
