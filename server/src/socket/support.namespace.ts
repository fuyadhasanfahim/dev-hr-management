import { Server, Socket, Namespace } from 'socket.io';
import { socketAuthMiddleware } from './socket-auth.middleware.js';
import ChatSessionModel, { ChatSessionStatus } from '../models/chat-session.model.js';
import ChatMessageModel, { ChatSenderModel } from '../models/chat-message.model.js';
import TicketModel from '../models/ticket.model.js';
import { removeFromChatQueue } from '../services/redis-queue.service.js';
import { logger } from '../lib/logger.js';
import { getRedisClient } from '../lib/redis.js';
import { enqueueChatMessage } from '../services/chat-message.queue.js';
import { Types } from 'mongoose';
import { hasPermission } from '../lib/permissions.js';

let supportNamespaceRef: Namespace | null = null;

export function getSupportNamespace(): Namespace | null {
    return supportNamespaceRef;
}

/**
 * Broadcasts a `session:created` event to all online agents so a brand-new
 * queued session (created via REST when a visitor escalates) appears in the
 * console queue instantly, without waiting for the polling interval.
 */
// The visitor sees "<agent> has joined the chat" once per agent per chat, however many times the claim is repeated.
const announcedAgent = new Map<string, string>();

export function announceAgentJoined(sessionId: string, agentId: string, agentName: string): void {
    if (announcedAgent.get(sessionId) === agentId) return;
    announcedAgent.set(sessionId, agentId);
    supportNamespaceRef?.to(sessionId).emit('chat:agent_joined', { agentId, agentName });
}

export function forgetAnnouncedAgent(sessionId: string): void {
    announcedAgent.delete(sessionId);
}

export function notifyNewSession(sessionId: string): void {
    supportNamespaceRef?.to('agents_presence').emit('session:created', { sessionId });
}

/**
 * Broadcasts a ticket event (new ticket / new client reply) to all online agents
 * so the support console can alert and refresh its ticket views in real time —
 * the REST ticket endpoints have no socket of their own.
 */
export function notifyAgents(event: string, payload: Record<string, unknown>): void {
    supportNamespaceRef?.to('agents_presence').emit(event, payload);
}

/**
 * Notifies everyone watching a specific ticket (the customer's track page and any
 * staff with the ticket open) that the thread changed, so they refresh live.
 */
export function notifyTicketReply(ticketId: string, payload: Record<string, unknown> = {}): void {
    if (!ticketId) return;
    supportNamespaceRef?.to(`ticket:${ticketId}`).emit('ticket:reply', { ticketId, ...payload });
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

        // ── Ticket live updates ─────────────────────────────────────────────
        // A viewer (customer on the track page, or staff with the ticket open)
        // joins the ticket's room to receive `ticket:reply` events in real time.
        socket.on('ticket:join', async ({ ticketId }: { ticketId: string }) => {
            try {
                if (!ticketId) return;
                const ticket = await TicketModel.findById(ticketId).select('guestId clientId');
                if (!ticket) return;
                // Customers may only watch their own ticket; staff may watch any.
                if (user.role === 'Guest' && ticket.guestId?.toString() !== user.id) return;
                if (user.role === 'client' && ticket.clientId?.toString() !== user.id) return;
                socket.join(`ticket:${ticketId}`);
            } catch (err: any) {
                logger.error(`[Support Socket] Error in ticket:join: ${err.message}`);
            }
        });

        socket.on('ticket:leave', ({ ticketId }: { ticketId: string }) => {
            if (ticketId) socket.leave(`ticket:${ticketId}`);
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

                // Tell the visitor an agent has joined (once per agent, see announceAgentJoined).
                announceAgentJoined(sessionId, user.id, user.name);

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

        // A visitor/agent may only act in a chat that is theirs to use, and only while it is open for messages.
        const guardSession = async (sessionId: string): Promise<{ session: any; reason?: undefined } | { session?: undefined; reason: string }> => {
            const session: any = await ChatSessionModel.findOne({ sessionId }).select('_id status handedOffToWhatsApp guestId clientId assignedAgent');
            if (!session) return { reason: 'Chat session not found' };
            if (user.role === 'Guest' && session.guestId?.toString() !== user.id) return { reason: 'Access denied to this support session' };
            if (user.role === 'client' && session.clientId?.toString() !== user.id) return { reason: 'Access denied to this support session' };
            if (session.status === ChatSessionStatus.ENDED) return { reason: 'This chat session has ended' };
            if (session.handedOffToWhatsApp) return { reason: 'This chat continues on WhatsApp' };
            // A ticket was opened from this chat: the conversation continues in the ticket, the chat is read-only.
            if (session.status === 'converted_to_ticket') return { reason: 'A ticket was opened for this chat. The conversation continues in the ticket.' };
            return { session };
        };

        // Sent messages are echoed to the room at once and saved behind Redis (see chat-message.queue): that is what
        // makes sending, with or without files, feel instant.
        socket.on('chat:message', async (payload: { sessionId?: string; text?: string; content?: string; attachments?: string[]; clientId?: string }) => {
            const { sessionId, text, content, attachments, clientId } = payload ?? {};
            try {
                if (!sessionId) {
                    socket.emit('error', { message: 'Session ID is required' });
                    return;
                }

                const messageContent = String(text || content || '').trim().slice(0, 4000);
                const safeAttachments = (Array.isArray(attachments) ? attachments : []).filter((a) => typeof a === 'string' && a).slice(0, 10);

                // Reject messages with no text AND no attachments.
                if (!messageContent && safeAttachments.length === 0) {
                    socket.emit('error', { message: 'Message content or attachments required' });
                    return;
                }

                const guard = await guardSession(sessionId);
                if (!guard.session) {
                    socket.emit('chat:message:rejected', { clientId, reason: guard.reason });
                    socket.emit('error', { message: guard.reason });
                    return;
                }
                const session = guard.session;

                // The same re-sent message is only ever queued once.
                if (clientId) {
                    const first = await getRedisClient().set(`chatmsg:${clientId}`, '1', 'EX', 300, 'NX').catch(() => 'OK');
                    if (!first) {
                        socket.emit('chat:message:ack', { clientId, duplicate: true });
                        return;
                    }
                }

                let senderModel = ChatSenderModel.CLIENT;
                if (user.role !== 'Guest' && user.role !== 'client') {
                    senderModel = ChatSenderModel.STAFF;
                } else if (user.role === 'Guest') {
                    senderModel = ChatSenderModel.GUEST;
                }
                const fromClient = senderModel === ChatSenderModel.CLIENT || senderModel === ChatSenderModel.GUEST;

                const now = new Date().toISOString();
                const message = {
                    _id: String(new Types.ObjectId()),
                    sessionId: String(session._id),
                    sender: user.id as string,
                    senderModel,
                    senderName: user.name as string,
                    content: messageContent,
                    attachments: safeAttachments,
                    clientId,
                    readBy: [] as string[],
                    createdAt: now,
                    updatedAt: now,
                };

                supportNamespace.to(sessionId).emit('chat:message', message);
                socket.emit('chat:message:ack', { clientId, _id: message._id });

                await enqueueChatMessage({
                    message: { ...message, clientId },
                    room: sessionId,
                    fromClient,
                });
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:message: ${err.message}`);
                socket.emit('chat:message:rejected', { clientId, reason: 'Failed to send message' });
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Edit the text of a message you sent. Everyone in the chat sees it change, with an "Edited" mark.
        socket.on('chat:message:edit', async ({ sessionId, messageId, text }: { sessionId?: string; messageId?: string; text?: string }) => {
            try {
                const content = String(text ?? '').trim().slice(0, 4000);
                if (!sessionId || !messageId || !Types.ObjectId.isValid(messageId) || !content) {
                    socket.emit('chat:message:rejected', { messageId, reason: 'Write the new text first.' });
                    return;
                }
                const guard = await guardSession(sessionId);
                if (!guard.session) {
                    socket.emit('chat:message:rejected', { messageId, reason: guard.reason });
                    return;
                }
                const msg = await ChatMessageModel.findOne({ _id: messageId, sessionId: guard.session._id });
                if (!msg || msg.deletedAt) {
                    socket.emit('chat:message:rejected', { messageId, reason: 'This message can no longer be edited.' });
                    return;
                }
                if (String(msg.sender) !== user.id || msg.senderModel === ChatSenderModel.SYSTEM) {
                    socket.emit('chat:message:rejected', { messageId, reason: 'You can only edit your own messages.' });
                    return;
                }
                msg.content = content;
                msg.editedAt = new Date();
                await msg.save();
                supportNamespace.to(sessionId).emit('chat:message:updated', msg.toJSON());
                supportNamespace.to('agents_presence').emit('session:state_change', { type: 'message_updated', sessionId });
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:message:edit: ${err.message}`);
                socket.emit('chat:message:rejected', { messageId: undefined, reason: 'Could not edit the message.' });
            }
        });

        // Delete a message you sent (a manager or admin may delete any). The text and files are wiped; the thread keeps
        // a "This message was deleted" line.
        socket.on('chat:message:delete', async ({ sessionId, messageId }: { sessionId?: string; messageId?: string }) => {
            try {
                if (!sessionId || !messageId || !Types.ObjectId.isValid(messageId)) return;
                const guard = await guardSession(sessionId);
                if (!guard.session) {
                    socket.emit('chat:message:rejected', { messageId, reason: guard.reason });
                    return;
                }
                const msg = await ChatMessageModel.findOne({ _id: messageId, sessionId: guard.session._id });
                if (!msg || msg.deletedAt) return;
                const mine = String(msg.sender) === user.id;
                const admin = user.role === 'admin' || user.role === 'super_admin';
                if (msg.senderModel === ChatSenderModel.SYSTEM || (!mine && !admin)) {
                    socket.emit('chat:message:rejected', { messageId, reason: 'You can only delete your own messages.' });
                    return;
                }
                msg.content = '';
                msg.attachments = [];
                msg.deletedAt = new Date();
                await msg.save();
                supportNamespace.to(sessionId).emit('chat:message:updated', msg.toJSON());
                supportNamespace.to('agents_presence').emit('session:state_change', { type: 'message_updated', sessionId });
            } catch (err: any) {
                logger.error(`[Support Socket] Error in chat:message:delete: ${err.message}`);
                socket.emit('chat:message:rejected', { messageId: undefined, reason: 'Could not delete the message.' });
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

        // Only staff with support access get support alerts — new chats,
        // tickets and WhatsApp messages all go to this room.
        socket.on('agent:register_presence', () => {
            if (user.role !== 'Guest' && user.role !== 'client' && hasPermission(user.permissions, 'support.access')) {
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
