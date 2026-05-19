import { Server, Socket } from 'socket.io';
import { socketAuthMiddleware } from './socket-auth.middleware.js';
import ChatSessionModel, { ChatSessionStatus } from '../models/chat-session.model.js';
import ChatMessageModel, { ChatSenderModel } from '../models/chat-message.model.js';
import { addToChatQueue, removeFromChatQueue } from '../services/redis-queue.service.js';
import { logger } from '../lib/logger.js';
import { Types } from 'mongoose';

export function registerSupportNamespace(io: Server) {
    const supportNamespace = io.of('/support');

    supportNamespace.use(socketAuthMiddleware);

    supportNamespace.on('connection', (socket: Socket) => {
        const user = socket.data.user;
        logger.info(`[Support Socket] User connected: ${user.name} (${user.role}) - Socket: ${socket.id}`);

        socket.on('chat:join', async ({ sessionId }: { sessionId: string }) => {
            try {
                if (!sessionId) {
                    socket.emit('error', { message: 'Session ID is required' });
                    return;
                }

                const session = await ChatSessionModel.findOne({ sessionId });
                if (!session) {
                    socket.emit('error', { message: 'Chat session not found' });
                    return;
                }

                if (user.role === 'Guest' && session.guestId?.toString() !== user.id) {
                    socket.emit('error', { message: 'Access denied to this support session' });
                    return;
                }
                if (user.role === 'client' && session.clientId?.toString() !== user.id) {
                    socket.emit('error', { message: 'Access denied to this support session' });
                    return;
                }

                socket.join(sessionId);
                logger.info(`[Support Socket] User ${user.name} joined room: ${sessionId}`);

                const messages = await ChatMessageModel.find({ sessionId: session._id }).sort({ createdAt: 1 }).limit(100);
                socket.emit('chat:joined', { session, messages });

                if (user.role !== 'Guest' && user.role !== 'client') {
                    socket.to(sessionId).emit('chat:agent_joined', {
                        agentId: user.id,
                        agentName: user.name,
                    });
                }
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:join: ${err.message}`);
                socket.emit('error', { message: 'Failed to join support session' });
            }
        });

        socket.on('chat:message', async ({ sessionId, text, content, attachments }: { sessionId: string; text?: string; content?: string; attachments?: string[] }) => {
            try {
                if (!sessionId) {
                    socket.emit('error', { message: 'Session ID is required' });
                    return;
                }

                const session = await ChatSessionModel.findOne({ sessionId });
                if (!session) {
                    socket.emit('error', { message: 'Chat session not found' });
                    return;
                }

                if (session.status === ChatSessionStatus.ENDED) {
                    socket.emit('error', { message: 'This chat session has ended' });
                    return;
                }

                let senderModel = ChatSenderModel.CLIENT;
                if (user.role !== 'Guest' && user.role !== 'client') {
                    senderModel = ChatSenderModel.STAFF;
                } else if (user.role === 'Guest') {
                    senderModel = ChatSenderModel.GUEST;
                }

                const message = await ChatMessageModel.create({
                    sessionId: session._id,
                    sender: new Types.ObjectId(user.id),
                    senderModel,
                    senderName: user.name,
                    content: text || content || '',
                    attachments: attachments || [],
                });

                supportNamespace.to(sessionId).emit('chat:message', message);

                if (senderModel === ChatSenderModel.CLIENT || senderModel === ChatSenderModel.GUEST) {
                    if (session.status === ChatSessionStatus.QUEUED) {
                        await addToChatQueue(sessionId);
                        supportNamespace.to('agents_presence').emit('queue:new_message', { sessionId });
                    }
                }
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:message: ${err.message}`);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('chat:typing', ({ sessionId, isTyping }: { sessionId: string; isTyping: boolean }) => {
            socket.to(sessionId).emit('chat:typing', {
                userId: user.id,
                userName: user.name,
                isTyping,
            });
        });

        socket.on('chat:seen', async ({ sessionId, messageId }: { sessionId: string; messageId: string }) => {
            try {
                if (messageId) {
                    await ChatMessageModel.updateOne({ _id: messageId }, { $addToSet: { readBy: new Types.ObjectId(user.id) } });
                    socket.to(sessionId).emit('chat:seen', { messageId });
                }
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:seen: ${err.message}`);
            }
        });

        socket.on('chat:close', async ({ sessionId }: { sessionId: string }) => {
            try {
                const session = await ChatSessionModel.findOne({ sessionId });
                if (session) {
                    session.status = ChatSessionStatus.ENDED;
                    await session.save();
                    await removeFromChatQueue(sessionId);

                    supportNamespace.to(sessionId).emit('chat:closed', {
                        sessionId,
                        endedBy: user.name,
                    });
                    logger.info(`[Support Socket] Support session ${sessionId} closed by ${user.name}`);
                }
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:close: ${err.message}`);
            }
        });

        socket.on('agent:register_presence', () => {
            if (user.role !== 'Guest' && user.role !== 'client') {
                socket.join('agents_presence');
                logger.info(`[Support Socket] Agent registered for presence updates: ${user.name}`);
            }
        });

        socket.on('disconnect', () => {
            logger.info(`[Support Socket] Socket disconnected: ${socket.id}`);
        });
    });
}
