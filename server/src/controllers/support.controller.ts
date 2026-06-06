import type { Request, Response } from 'express';
import guestAuthService from '../services/guest-auth.service.js';
import attachmentService from '../services/attachment.service.js';
import { generatePresignedViewUrl } from '../services/s3-upload.service.js';
import supportTicketService from '../services/support-ticket.service.js';
import liveChatService from '../services/live-chat.service.js';
import chatSummaryService from '../services/chat-summary.service.js';
import cloudinaryMigrationService from '../services/cloudinary-migration.service.js';
import ClientModel from '../models/client.model.js';
import StaffModel from '../models/staff.model.js';
import { getSupportNamespace, notifyNewSession } from '../socket/support.namespace.js';

function emitSessionStateChange(type: string, sessionId: string) {
    const ns = getSupportNamespace();
    if (ns) ns.to('agents_presence').emit('session:state_change', { type, sessionId });
}

/**
 * Public: Request OTP for Guest email verification.
 */
async function requestGuestOtp(req: Request, res: Response) {
    try {
        const { email, name } = req.body;
        const result = await guestAuthService.requestGuestOtp(email, name);
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Public: Verify Guest OTP and return access token.
 */
async function verifyGuestOtp(req: Request, res: Response) {
    try {
        const { email, otp } = req.body;
        const result = await guestAuthService.verifyGuestOtp(email, otp);
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Protected: Request S3 pre-signed upload URL.
 */
async function requestPresignedUrl(req: Request, res: Response) {
    try {
        const { fileName, fileType, fileSize, folder, referenceId } = req.body;
        const result = await attachmentService.requestPresignedUrl({
            fileName,
            fileType,
            fileSize,
            folder,
            referenceId,
        });
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Protected: Get a pre-signed GET URL for viewing/downloading a private S3 object.
 */
async function getPresignedViewUrl(req: Request, res: Response) {
    try {
        const fileKey = req.query.fileKey as string;
        if (!fileKey || typeof fileKey !== 'string') {
            return res.status(400).json({ success: false, message: 'fileKey query parameter is required.' });
        }

        const ALLOWED_PREFIXES = [
            'chats/', 'tickets/',
            // Keys produced by the Cloudinary → S3 migration service
            'migrated-tickets/', 'migrated-ticket-messages/', 'migrated-chat-messages/',
        ];
        if (!ALLOWED_PREFIXES.some((p) => fileKey.startsWith(p))) {
            return res.status(403).json({ success: false, message: 'Access denied: invalid file key.' });
        }

        const viewUrl = await generatePresignedViewUrl(fileKey);
        return res.status(200).json({ success: true, data: { viewUrl } });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

/**
 * Client/Guest: Create support ticket.
 */
async function createSupportTicket(req: Request, res: Response) {
    try {
        const { subject, text, attachments, priority, category } = req.body;

        const args: any = {
            subject,
            text,
            attachments,
            priority,
            category,
            source: 'direct',
        };

        if (req.user?.role === 'Guest') {
            args.guestId = req.user.id;
        } else if (req.user?.id) {
            args.clientId = req.user.id;
        }

        const result = await supportTicketService.createTicket(args);
        return res.status(201).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Retrieve ticket and details.
 */
async function getTicketDetails(req: Request, res: Response) {
    try {
        const result = await supportTicketService.getTicketDetails(req.params.id || '', {
            id: req.user?.id || '',
            role: req.user?.role || '',
        });
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Add reply to ticket.
 */
async function replyToTicket(req: Request, res: Response) {
    try {
        const { text, attachments } = req.body;
        const senderType = req.user?.role === 'Guest' ? 'guest' : (req.user?.role === 'client' ? 'client' : 'staff');
        const senderId = req.user?.id || '';

        const result = await supportTicketService.addTicketReply({
            ticketId: req.params.id || '',
            senderId,
            senderType,
            text,
            attachments,
        });

        return res.status(201).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Lists support tickets.
 */
async function listSupportTickets(req: Request, res: Response) {
    try {
        const args: any = {};
        if (req.user?.role === 'client') {
            args.clientId = req.user.id;
        } else if (req.user?.role === 'Guest') {
            args.guestId = req.user.id;
        }

        if (req.query.status) args.status = req.query.status;
        if (req.query.priority) args.priority = req.query.priority;
        if (req.query.category) args.category = req.query.category;

        const result = await supportTicketService.listTickets(args);
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Update support ticket (Staff only).
 */
async function updateTicket(req: Request, res: Response) {
    try {
        const { status, priority, category, assignedTo, tags } = req.body;
        
        const updates: any = {};
        if (status) updates.status = status;
        if (priority) updates.priority = priority;
        if (category) updates.category = category;
        if (assignedTo) updates.assignedTo = assignedTo;
        if (tags) updates.tags = tags;

        const result = await supportTicketService.updateTicket(req.params.id || '', updates);
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Creates live support chat session (Client/Guest).
 */
async function createChatSession(req: Request, res: Response) {
    try {
        const args: any = {};
        if (req.user?.role === 'Guest') {
            args.guestId = req.user.id;
        } else if (req.user?.id) {
            args.clientId = req.user.id;
        }

        const result = await liveChatService.createChatSession(args);
        notifyNewSession(result.sessionId);
        return res.status(201).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Claim/Assign agent to active chat session (Staff only).
 */
async function claimChatSession(req: Request, res: Response) {
    try {
        const { sessionId } = req.body;
        const result = await liveChatService.assignAgentToSession(sessionId, req.user?.id || '');
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Manually convert chat session to ticket.
 */
async function convertChatToTicket(req: Request, res: Response) {
    try {
        const { sessionId, reason, subject, category } = req.body;
        const result = await liveChatService.convertChatToTicket(sessionId, { reason, subject, category });
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Admin only: Trigger Cloudinary to S3 background migration.
 */
async function triggerCloudinaryMigration(_req: Request, res: Response) {
    try {
        const result = await cloudinaryMigrationService.runCloudinaryMigration();
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

import ChatSessionModel from '../models/chat-session.model.js';
import ChatMessageModel, { ChatSenderModel } from '../models/chat-message.model.js';
import TicketModel from '../models/ticket.model.js';
import { Types } from 'mongoose';

/**
 * Staff: List all queued support chat sessions.
 */
async function listQueuedChatSessions(_req: Request, res: Response) {
    try {
        const sessions = await ChatSessionModel.find({ status: 'queued' })
            .populate('clientId', 'name email')
            .populate('guestId', 'name email')
            .sort({ createdAt: 1 });

        const result = await Promise.all(
            sessions.map(async (session) => {
                const lastMessage = await ChatMessageModel.findOne({ sessionId: session._id })
                    .sort({ createdAt: -1 });
                return {
                    ...session.toObject(),
                    lastMessage: lastMessage ? {
                        content: lastMessage.content,
                        attachments: lastMessage.attachments,
                        createdAt: lastMessage.createdAt,
                    } : null,
                };
            })
        );

        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

/**
 * Staff: List all active support chat sessions.
 */
async function listActiveChatSessions(_req: Request, res: Response) {
    try {
        const sessions = await ChatSessionModel.find({ status: 'active' })
            .populate('clientId', 'name email')
            .populate('guestId', 'name email')
            .populate('assignedAgent', 'name email')
            .sort({ updatedAt: -1 });

        const result = await Promise.all(
            sessions.map(async (session) => {
                const lastMessage = await ChatMessageModel.findOne({ sessionId: session._id })
                    .sort({ createdAt: -1 });
                return {
                    ...session.toObject(),
                    lastMessage: lastMessage ? {
                        content: lastMessage.content,
                        attachments: lastMessage.attachments,
                        createdAt: lastMessage.createdAt,
                    } : null,
                };
            })
        );

        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

/**
 * Staff: List resolved (ended / converted-to-ticket) chat sessions for history.
 */
async function listResolvedChatSessions(_req: Request, res: Response) {
    try {
        const sessions = await ChatSessionModel.find({ status: { $in: ['ended', 'converted_to_ticket'] } })
            .populate('clientId', 'name email')
            .populate('guestId', 'name email')
            .populate('assignedAgent', 'name email')
            .sort({ updatedAt: -1 });

        const result = await Promise.all(
            sessions.map(async (session) => {
                const lastMessage = await ChatMessageModel.findOne({ sessionId: session._id })
                    .sort({ createdAt: -1 });
                return {
                    ...session.toObject(),
                    lastMessage: lastMessage ? {
                        content: lastMessage.content,
                        attachments: lastMessage.attachments,
                        createdAt: lastMessage.createdAt,
                    } : null,
                };
            })
        );

        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

interface DashboardActivityItem {
    type: 'chat_new' | 'chat_resolved' | 'ticket_new';
    label: string;
    at: Date;
}

/**
 * Average minutes between a visitor message (Client/Guest) and the NEXT staff
 * reply, across sessions touched today. Bounded to the 100 most recent such
 * sessions. Self-contained try/catch → returns null on any failure so it never
 * fails the parent endpoint.
 */
async function computeAvgResponseMinutes(startOfToday: Date): Promise<number | null> {
    try {
        const sessions = await ChatSessionModel.find({ updatedAt: { $gte: startOfToday } })
            .sort({ updatedAt: -1 })
            .limit(100)
            .select('_id')
            .lean();
        if (sessions.length === 0) return null;

        const ids = sessions.map((s) => s._id);
        const messages = await ChatMessageModel.find({ sessionId: { $in: ids } })
            .sort({ sessionId: 1, createdAt: 1 })
            .select('sessionId senderModel createdAt')
            .lean();

        let totalSeconds = 0;
        let pairs = 0;
        let currentSession: string | null = null;
        let pendingVisitorAt: number | null = null;

        for (const m of messages as any[]) {
            const sid = String(m.sessionId);
            if (sid !== currentSession) {
                currentSession = sid;
                pendingVisitorAt = null;
            }
            if (m.senderModel === 'Client' || m.senderModel === 'Guest') {
                // First unanswered visitor message starts the clock for this round.
                if (pendingVisitorAt === null) pendingVisitorAt = new Date(m.createdAt).getTime();
            } else if (m.senderModel === 'Staff') {
                if (pendingVisitorAt !== null) {
                    const gap = (new Date(m.createdAt).getTime() - pendingVisitorAt) / 1000;
                    if (gap >= 0) {
                        totalSeconds += gap;
                        pairs++;
                    }
                    pendingVisitorAt = null;
                }
            }
            // System messages are ignored (don't open or close a round).
        }

        if (pairs === 0) return null;
        return totalSeconds / pairs / 60;
    } catch {
        return null;
    }
}

/**
 * Latest ~6 activity events merged from recent chat sessions + tickets.
 * Self-contained try/catch → returns [] on failure.
 */
async function computeRecentActivity(): Promise<DashboardActivityItem[]> {
    try {
        const [sessions, tickets] = await Promise.all([
            ChatSessionModel.find({})
                .sort({ updatedAt: -1 })
                .limit(6)
                .populate('clientId', 'name')
                .populate('guestId', 'name')
                .lean(),
            TicketModel.find({})
                .sort({ createdAt: -1 })
                .limit(6)
                .select('subject createdAt')
                .lean(),
        ]);

        const items: DashboardActivityItem[] = [];

        for (const s of sessions as any[]) {
            const visitor = s.clientId ?? s.guestId;
            const name = visitor?.name || 'Guest';
            if (s.status === 'ended' || s.status === 'converted_to_ticket') {
                items.push({ type: 'chat_resolved', label: `Chat resolved with ${name}`, at: s.updatedAt });
            } else {
                items.push({ type: 'chat_new', label: `New live chat from ${name}`, at: s.createdAt });
            }
        }
        for (const t of tickets as any[]) {
            items.push({ type: 'ticket_new', label: `New ticket: ${t.subject}`, at: t.createdAt });
        }

        items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        return items.slice(0, 6);
    } catch {
        return [];
    }
}

/**
 * Staff: Aggregate counters + recent activity for the support console Overview.
 */
async function getSupportDashboardStats(_req: Request, res: Response) {
    try {
        // Start of "today" in the server's local timezone.
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [openTickets, liveChats, resolvedToday, avgResponseTimeMinutes, recentActivity] =
            await Promise.all([
                TicketModel.countDocuments({
                    status: { $in: ['open', 'in_progress', 'pending_client'] },
                }),
                ChatSessionModel.countDocuments({ status: 'active' }),
                ChatSessionModel.countDocuments({
                    status: { $in: ['ended', 'converted_to_ticket'] },
                    updatedAt: { $gte: startOfToday },
                }),
                computeAvgResponseMinutes(startOfToday),
                computeRecentActivity(),
            ]);

        return res.status(200).json({
            success: true,
            data: { openTickets, liveChats, resolvedToday, avgResponseTimeMinutes, recentActivity },
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
}

/**
 * Protected: Fetch chat message logs for a session.
 */
async function getChatSessionMessages(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'Session ID is required' });
        }

        const session = await ChatSessionModel.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ success: false, message: 'Chat session not found' });
        }

        const messages = await ChatMessageModel.find({ sessionId: session._id })
            .sort({ createdAt: 1 });
        return res.status(200).json({ success: true, data: messages });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

/**
 * Staff: Claim a support chat session (param based).
 */
async function claimChatSessionParam(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'Session ID is required' });
        }

        const result = await liveChatService.assignAgentToSession(sessionId, req.user?.id || '');
        emitSessionStateChange('claimed', sessionId);
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Staff: Close/End an active support chat session (param based).
 */
async function closeChatSessionParam(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'Session ID is required' });
        }

        const result = await liveChatService.endChatSession(sessionId);

        // Persist a clear "resolved" system line in the transcript and surface it
        // to the visitor (mirrors the reassign system-message pattern).
        const staff = await StaffModel.findOne({ userId: req.user?.id }).populate('userId', 'name').lean() as any;
        const agentName = staff?.userId?.name || 'Support';
        const ns = getSupportNamespace();
        if (ns) {
            const session = await ChatSessionModel.findOne({ sessionId });
            if (session) {
                const sysMsg = await ChatMessageModel.create({
                    sessionId: session._id,
                    sender: new Types.ObjectId(req.user?.id),
                    senderModel: ChatSenderModel.SYSTEM,
                    senderName: 'System',
                    content: `This conversation has been marked as resolved by ${agentName}.`,
                    attachments: [],
                });
                ns.to(sessionId).emit('chat:message', sysMsg);
                // Flip the visitor's widget to the ended state on the REST close path.
                ns.to(sessionId).emit('chat:closed', { sessionId, endedBy: agentName });
            }
        }

        // Fire-and-forget: email the visitor a resolution summary + transcript.
        // Best-effort and non-blocking — never delays or fails the close response.
        chatSummaryService.sendResolutionEmail(sessionId, agentName).catch(() => {});

        emitSessionStateChange('closed', sessionId);
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Staff: Convert chat session to ticket (param based).
 */
async function convertChatToTicketParam(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: 'Session ID is required' });
        }

        const { reason, subject, category } = req.body;
        const result = await liveChatService.convertChatToTicket(sessionId, { reason, subject, category });
        emitSessionStateChange('converted', sessionId);
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Staff: Update ticket status only.
 */
async function updateTicketStatus(req: Request, res: Response) {
    try {
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }
        const result = await supportTicketService.updateTicket(req.params.id || '', { status });
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Staff: Assign ticket to the calling staff member (resolves User → Staff).
 */
async function assignTicketToSelf(req: Request, res: Response) {
    try {
        const staff = await StaffModel.findOne({ userId: req.user?.id });
        if (!staff) {
            return res.status(404).json({ success: false, message: 'Staff profile not found for your account.' });
        }
        const result = await supportTicketService.updateTicket(req.params.id || '', {
            assignedTo: staff._id.toString(),
        });
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Staff: Reassign a chat session to another agent.
 */
async function reassignChatSession(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;
        const { agentId } = req.body;
        if (!sessionId || !agentId) {
            return res.status(400).json({ success: false, message: 'Session ID and agent ID are required' });
        }

        const result = await liveChatService.reassignSession(sessionId, agentId);

        const agent = await StaffModel.findOne({ userId: agentId }).populate('userId', 'name').lean() as any;
        const agentName = agent?.userId?.name || 'another agent';
        const ns = getSupportNamespace();
        if (ns) {
            const session = await ChatSessionModel.findOne({ sessionId });
            if (session) {
                const sysMsg = await ChatMessageModel.create({
                    sessionId: session._id,
                    sender: new Types.ObjectId(req.user?.id),
                    senderModel: ChatSenderModel.SYSTEM,
                    senderName: 'System',
                    content: `Chat reassigned to ${agentName}.`,
                    attachments: [],
                });
                ns.to(sessionId).emit('chat:message', sysMsg);
            }
            ns.to('agents_presence').emit('session:state_change', { type: 'reassigned', sessionId });
        }

        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Staff: Get unread message counts per active session.
 */
async function getUnreadCounts(req: Request, res: Response) {
    try {
        const agentId = req.user?.id || '';
        const counts = await liveChatService.getUnreadCountsForAgent(agentId);
        return res.status(200).json({ success: true, data: counts });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

/**
 * Staff: List available staff members for reassignment.
 */
async function listAvailableAgents(_req: Request, res: Response) {
    try {
        const agents = await StaffModel.find({})
            .select('name userId department designation')
            .populate('userId', 'name email image')
            .lean();
        return res.status(200).json({ success: true, data: agents });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

/**
 * Staff: Look up whether a guest email matches an existing dashboard Client.
 * Returns the matched client name or null.
 */
async function lookupClientByEmail(req: Request, res: Response) {
    try {
        const email = req.query.email as string;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ success: false, message: 'email query parameter is required.' });
        }

        const client = await ClientModel.findOne({
            emails: { $elemMatch: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i') } },
            status: 'active',
        }).select('name emails clientId').lean();

        return res.status(200).json({ success: true, data: client ? { name: client.name, clientId: (client as any).clientId || null } : null });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

export default {
    requestGuestOtp,
    verifyGuestOtp,
    requestPresignedUrl,
    getPresignedViewUrl,
    createSupportTicket,
    getTicketDetails,
    replyToTicket,
    listSupportTickets,
    updateTicket,
    createChatSession,
    claimChatSession,
    convertChatToTicket,
    triggerCloudinaryMigration,
    listQueuedChatSessions,
    listActiveChatSessions,
    listResolvedChatSessions,
    getSupportDashboardStats,
    getChatSessionMessages,
    claimChatSessionParam,
    closeChatSessionParam,
    convertChatToTicketParam,
    updateTicketStatus,
    assignTicketToSelf,
    reassignChatSession,
    getUnreadCounts,
    listAvailableAgents,
    lookupClientByEmail,
};
