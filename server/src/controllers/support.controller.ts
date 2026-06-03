import type { Request, Response } from 'express';
import guestAuthService from '../services/guest-auth.service.js';
import attachmentService from '../services/attachment.service.js';
import supportTicketService from '../services/support-ticket.service.js';
import liveChatService from '../services/live-chat.service.js';
import cloudinaryMigrationService from '../services/cloudinary-migration.service.js';
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
 * Client/Guest: Create support ticket.
 */
async function createSupportTicket(req: Request, res: Response) {
    try {
        const { subject, text, attachments, priority } = req.body;
        
        const args: any = {
            subject,
            text,
            attachments,
            priority,
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
        const { status, priority, assignedTo, tags } = req.body;
        
        const updates: any = {};
        if (status) updates.status = status;
        if (priority) updates.priority = priority;
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
        const { sessionId, reason } = req.body;
        const result = await liveChatService.convertChatToTicket(sessionId, reason);
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

        const { reason } = req.body;
        const result = await liveChatService.convertChatToTicket(sessionId, reason);
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

export default {
    requestGuestOtp,
    verifyGuestOtp,
    requestPresignedUrl,
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
    getChatSessionMessages,
    claimChatSessionParam,
    closeChatSessionParam,
    convertChatToTicketParam,
    updateTicketStatus,
    assignTicketToSelf,
    reassignChatSession,
    getUnreadCounts,
    listAvailableAgents,
};
