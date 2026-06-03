import { Server, Socket, Namespace } from 'socket.io';
import { socketAuthMiddleware } from './socket-auth.middleware.js';
import ChatSessionModel, { ChatSessionStatus } from '../models/chat-session.model.js';
import ChatMessageModel, { ChatSenderModel } from '../models/chat-message.model.js';
import { addToChatQueue, removeFromChatQueue } from '../services/redis-queue.service.js';
import { logger } from '../lib/logger.js';
import { Types } from 'mongoose';

let supportNamespaceRef: Namespace | null = null;

export function getSupportNamespace(): Namespace | null {
    return supportNamespaceRef;
}

/**
 * Broadcasts a `session:created` event to all online agents so a brand-new
 * queued session (created via REST when a visitor escalates) appears in the
 * console queue instantly, without waiting for the polling interval.
 */
export function notifyNewSession(sessionId: string): void {
    supportNamespaceRef?.to('agents_presence').emit('session:created', { sessionId });
}

export function registerSupportNamespace(io: Server) {
    const supportNamespace = io.of('/support');
    supportNamespaceRef = supportNamespace;

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

                // NOTE: joining a room is silent. The "agent has joined" notice is
                // emitted from the `chat:claim` handler, fired only on a real claim.

                // Visitor presence: remember the room on the socket and announce the
                // visitor is online so any "away" state clears when they return.
                if (user.role === 'Guest' || user.role === 'client') {
                    socket.data.joinedSessionId = sessionId;
                    socket.to(sessionId).emit('chat:visitor_presence', { sessionId, online: true });
                    supportNamespace.to('agents_presence').emit('chat:visitor_presence', { sessionId, online: true });
                }
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:join: ${err.message}`);
                socket.emit('error', { message: 'Failed to join support session' });
            }
        });

        socket.on('chat:visitor_away', ({ sessionId }: { sessionId: string }) => {
            try {
                if (!sessionId) return;
                // Visitor stepped out of live chat (back to AI) without ending it.
                socket.to(sessionId).emit('chat:visitor_presence', { sessionId, online: false });
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:visitor_away: ${err.message}`);
            }
        });

        socket.on('chat:claim', async ({ sessionId }: { sessionId: string }) => {
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

                // Staff only — visitors cannot claim a session.
                if (user.role === 'Guest' || user.role === 'client') {
                    return;
                }

                // Tell the visitor an agent has joined (fires on real claim only).
                socket.to(sessionId).emit('chat:agent_joined', {
                    agentId: user.id,
                    agentName: user.name,
                });

                // Move the session queued → active live in every agent's sidebar.
                supportNamespace.to('agents_presence').emit('session:state_change', {
                    type: 'claimed',
                    sessionId,
                });
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:claim: ${err.message}`);
                socket.emit('error', { message: 'Failed to claim support session' });
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

                // Touch the session so list ordering + "last active" time stay fresh.
                session.updatedAt = new Date();
                await session.save();

                supportNamespace.to(sessionId).emit('chat:message', message);

                const fromClient =
                    senderModel === ChatSenderModel.CLIENT || senderModel === ChatSenderModel.GUEST;

                // Notify every agent's sidebar so unread counts, last-message preview
                // and timestamps update live (not just on the slow polling interval).
                supportNamespace.to('agents_presence').emit('session:new_message', {
                    sessionId,
                    status: session.status,
                    fromClient,
                    lastMessage: {
                        content: message.content,
                        attachments: message.attachments,
                        createdAt: message.createdAt,
                    },
                });

                if (fromClient && session.status === ChatSessionStatus.QUEUED) {
                    await addToChatQueue(sessionId);
                    supportNamespace.to('agents_presence').emit('queue:new_message', { sessionId });
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

        socket.on('chat:seen', async ({ sessionId, messageId }: { sessionId: string; messageId?: string }) => {
            try {
                const session = await ChatSessionModel.findOne({ sessionId });
                if (!session) return;

                const agentOid = new Types.ObjectId(user.id);
                await ChatMessageModel.updateMany(
                    {
                        sessionId: session._id,
                        sender: { $ne: agentOid },
                        readBy: { $ne: agentOid },
                    },
                    { $addToSet: { readBy: agentOid } },
                );
                socket.to(sessionId).emit('chat:seen', { sessionId, messageId });
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
                    supportNamespace.to('agents_presence').emit('session:state_change', { type: 'closed', sessionId });
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
            try {
                const sid = socket.data.joinedSessionId;
                if (sid && (user.role === 'Guest' || user.role === 'client')) {
                    // Visitor's tab closed / navigated away — mark them offline.
                    socket.to(sid).emit('chat:visitor_presence', { sessionId: sid, online: false });
                    supportNamespace.to('agents_presence').emit('chat:visitor_presence', { sessionId: sid, online: false });
                }
            } catch (err: any) {
                logger.error(`[Support Socket] Error broadcasting disconnect presence: ${err.message}`);
            }
        });
    });
}
