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
import { getSupportNamespace, notifyNewSession, notifyAgents, notifyTicketReply, announceAgentJoined, forgetAnnouncedAgent } from '../socket/support.namespace.js';
import mongoose from 'mongoose';
import { ensurePublicToken, emailTicketReply, trackingUrl } from '../services/ticket-notify.service.js';
import ticketPublicService from '../services/ticket-public.service.js';
import { normalizePhone, normalizeEmail } from '../services/contact.service.js';

function emitSessionStateChange(type: string, sessionId: string) {
    const ns = getSupportNamespace();
    if (ns) ns.to('agents_presence').emit('session:state_change', { type, sessionId });
}

/**
 * Public: Request OTP for Guest email verification.
 */
async function requestGuestOtp(req: Request, res: Response) {
    try {
        const { email, name, phone, isWhatsapp } = req.body;
        const result = await guestAuthService.requestGuestOtp(email, name, {
            phone: typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 40) : undefined,
            isWhatsapp: typeof isWhatsapp === 'boolean' ? isWhatsapp : undefined,
        });
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

// ── Guest refresh-token cookie helpers ──────────────────────────────────────
const GUEST_REFRESH_COOKIE = 'guest_refresh_token';
const REFRESH_COOKIE_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days

function refreshCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax' as const,
        // Subdomains (webbriks.com ↔ admin.webbriks.com) share the cookie in prod.
        ...(isProd && { domain: '.webbriks.com' }),
        path: '/api/support',
    };
}

/** Reads a named cookie from the raw Cookie header (no cookie-parser dependency). */
function readCookie(req: Request, name: string): string | undefined {
    const raw = req.headers.cookie;
    if (!raw) return undefined;
    for (const part of raw.split(';')) {
        const [k, ...v] = part.trim().split('=');
        if (k === name) return decodeURIComponent(v.join('='));
    }
    return undefined;
}

/**
 * Public: Verify Guest OTP. Returns a short-lived access token in the body and
 * sets a long-lived, rotating refresh token as an httpOnly cookie.
 */
async function verifyGuestOtp(req: Request, res: Response) {
    try {
        const { email, otp } = req.body;
        const { accessToken, refreshToken, guest } = await guestAuthService.verifyGuestOtp(email, otp);
        res.cookie(GUEST_REFRESH_COOKIE, refreshToken, {
            ...refreshCookieOptions(),
            maxAge: REFRESH_COOKIE_MAX_AGE,
        });
        // `token` key kept for backwards compatibility with existing clients.
        return res.status(200).json({ success: true, data: { token: accessToken, guest } });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Public: Exchange the refresh cookie for a fresh access token, rotating the
 * refresh cookie. Drives silent, re-OTP-free session renewal.
 */
async function refreshGuestSession(req: Request, res: Response) {
    try {
        const refreshToken = readCookie(req, GUEST_REFRESH_COOKIE);
        const result = await guestAuthService.refreshGuestSession(refreshToken || '');
        res.cookie(GUEST_REFRESH_COOKIE, result.refreshToken, {
            ...refreshCookieOptions(),
            maxAge: REFRESH_COOKIE_MAX_AGE,
        });
        return res.status(200).json({ success: true, data: { token: result.accessToken } });
    } catch (err: any) {
        // Clear a dead cookie so the browser stops sending it.
        res.clearCookie(GUEST_REFRESH_COOKIE, refreshCookieOptions());
        return res.status(err.statusCode || 401).json({ success: false, message: err.message });
    }
}

/**
 * Guest: Revoke all refresh tokens and clear the cookie.
 */
async function logoutGuest(req: Request, res: Response) {
    try {
        if (req.user?.id) {
            await guestAuthService.revokeGuestSessions(req.user.id);
        }
        res.clearCookie(GUEST_REFRESH_COOKIE, refreshCookieOptions());
        return res.status(200).json({ success: true });
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
        // Snapshot submitter identity so it always shows on the ticket.
        if (req.user?.name) args.visitorName = req.user.name;
        if (req.user?.email) args.visitorEmail = req.user.email;

        const result = await supportTicketService.createTicket(args);

        // Alert the support console about the brand-new ticket (REST has no socket).
        const isVisitor = req.user?.role === 'Guest' || req.user?.role === 'client';
        if (isVisitor) {
            notifyAgents('ticket:created', {
                ticketId: (result as any)?._id?.toString?.() ?? '',
                ticketRef: (result as any)?.ticketId ?? '',
                subject: (result as any)?.subject ?? subject ?? '',
            });
        }

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

        // A client/guest reply needs the support team's attention — alert the
        // console so it can play a sound, badge, and refresh the ticket live.
        if (senderType === 'guest' || senderType === 'client') {
            notifyAgents('ticket:new_reply', {
                ticketId: req.params.id || '',
                preview: typeof text === 'string' ? text.slice(0, 120) : '',
            });
        }

        // Live-update anyone watching this ticket (customer track page + staff
        // with it open) regardless of who replied.
        notifyTicketReply(req.params.id || '', { senderType });

        // Tickets are followed on the website: a staff reply is emailed to the customer with their private link.
        let emailed = false;
        if (senderType === 'staff' && typeof text === 'string' && text.trim()) {
            emailed = await emailTicketReply(req.params.id || '', text);
        }

        return res.status(201).json({ success: true, data: result, emailed });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Public: the current state of a ticket, by its unguessable tracking token (the link we send on WhatsApp).
 * Only what the customer needs to see: no internal notes, no staff details, no conversation.
 */
async function getPublicTicketStatus(req: Request, res: Response) {
    try {
        const token = String(req.params.token ?? '');
        if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return res.status(404).json({ success: false, message: 'Ticket not found' });
        const ticket: any = await TicketModel.findOne({ publicToken: token })
            .select('ticketId subject status priority category visitorName createdAt updatedAt')
            .lean();
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
        return res.status(200).json({
            success: true,
            data: {
                ticketId: ticket.ticketId,
                subject: ticket.subject,
                status: ticket.status,
                priority: ticket.priority,
                category: ticket.category,
                firstName: String(ticket.visitorName ?? '').trim().split(/\s+/)[0] || null,
                createdAt: ticket.createdAt,
                updatedAt: ticket.updatedAt,
            },
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: 'Could not load the ticket' });
    }
}

/**
 * Public: find an existing ticket from its number plus the email or phone it was raised with, and hand back the
 * tracking token for it. The number alone is guessable, so a matching email/phone is required, and every miss
 * (unknown number or wrong contact) returns the same 404.
 */
async function lookupPublicTicket(req: Request, res: Response) {
    try {
        const ticketId = String(req.body?.ticketId ?? '').trim().toUpperCase();
        const email = normalizeEmail(req.body?.email);
        const phone = normalizePhone(req.body?.phone);
        if (!/^TKT-\d{4,10}$/.test(ticketId) || (!email && !phone)) {
            return res.status(400).json({ success: false, message: 'Enter your ticket number (like TKT-123456) and the email or phone you used.' });
        }
        const ticket: any = await TicketModel.findOne({ ticketId })
            .select('ticketId visitorEmail visitorPhone whatsappPhone')
            .lean();
        const emailOk = !!email && normalizeEmail(ticket?.visitorEmail) === email;
        const phoneOk = !!phone && [ticket?.visitorPhone, ticket?.whatsappPhone].some((p) => normalizePhone(p) === phone);
        if (!ticket || (!emailOk && !phoneOk)) {
            return res.status(404).json({ success: false, message: "We couldn't find a ticket matching those details." });
        }
        const token = await ensurePublicToken(ticket._id);
        return res.status(200).json({ success: true, data: { ticketId: ticket.ticketId, token } });
    } catch {
        return res.status(500).json({ success: false, message: 'Could not look up the ticket' });
    }
}

/** Public: the customer's view of one ticket and its conversation, by the private token in their email link. */
async function getPublicTicketThread(req: Request, res: Response) {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const data = await ticketPublicService.getThread(String(req.params.token ?? ''));
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Could not load the ticket' });
    }
}

/** Public: the customer writes on their ticket from the link. The team is alerted like for any customer reply. */
async function postPublicTicketMessage(req: Request, res: Response) {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const { ticketMongoId, message } = await ticketPublicService.postCustomerMessage(String(req.params.token ?? ''), req.body?.text, req.body?.attachments);
        notifyAgents('ticket:new_reply', { ticketId: ticketMongoId, preview: message.text.slice(0, 120) || '(attachment)' });
        notifyTicketReply(ticketMongoId, { senderType: 'guest' });
        return res.status(201).json({ success: true, data: message });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Could not send your message' });
    }
}

/** Public: a presigned upload URL for a file the customer attaches to their ticket. */
async function requestPublicTicketUpload(req: Request, res: Response) {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const data = await ticketPublicService.requestCustomerUpload(String(req.params.token ?? ''), req.body ?? {});
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Could not start the upload' });
    }
}

/** Public: a short-lived link to open one attachment of this ticket. */
async function getPublicTicketViewUrl(req: Request, res: Response) {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const data = await ticketPublicService.getCustomerViewUrl(String(req.params.token ?? ''), req.query.fileKey);
        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Could not open the file' });
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
import GuestModel from '../models/guest.model.js';
import { logger } from '../lib/logger.js';

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
 * Staff: every website chat of the last 30 days that has at least one message, newest first, in one query set —
 * the Messages inbox shows these next to the WhatsApp conversations. `unreadCount` counts visitor messages no agent
 * has seen yet (an agent opening the chat marks them read).
 */
async function listInboxChatSessions(_req: Request, res: Response) {
    try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const sessions: any[] = await ChatSessionModel.find({ updatedAt: { $gte: since } })
            .populate('clientId', 'name emails phone')
            .populate('guestId', 'name email phone isWhatsapp')
            .sort({ updatedAt: -1 })
            .limit(200)
            .lean();

        // assignedAgent holds the signed-in user's id (not a Staff id), so names come from the user collection.
        const agentIds = [...new Set(sessions.map((s) => s.assignedAgent && String(s.assignedAgent)).filter(Boolean))] as string[];
        const agentUsers = agentIds.length
            ? await mongoose.connection
                  .collection('user')
                  .find({ _id: { $in: [...agentIds.map((id) => new mongoose.Types.ObjectId(id)), ...agentIds] } } as any)
                  .project({ name: 1, email: 1 })
                  .toArray()
            : [];
        const agentName = new Map(agentUsers.map((u: any) => [String(u._id), { name: u.name as string, email: u.email as string }]));

        const ids = sessions.map((s) => s._id);
        const [lasts, unreads, tickets] = await Promise.all([
            ChatMessageModel.aggregate([
                { $match: { sessionId: { $in: ids } } },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$sessionId',
                        content: { $first: '$content' },
                        attachments: { $first: '$attachments' },
                        createdAt: { $first: '$createdAt' },
                        senderModel: { $first: '$senderModel' },
                    },
                },
            ]),
            ChatMessageModel.aggregate([
                { $match: { sessionId: { $in: ids }, senderModel: { $in: ['Guest', 'Client'] }, 'readBy.0': { $exists: false } } },
                { $group: { _id: '$sessionId', count: { $sum: 1 } } },
            ]),
            TicketModel.find({ chatSessionId: { $in: ids } }).select('ticketId status chatSessionId').lean(),
        ]);
        const lastBy = new Map(lasts.map((l: any) => [String(l._id), l]));
        const unreadBy = new Map(unreads.map((u: any) => [String(u._id), u.count as number]));
        const ticketBy = new Map((tickets as any[]).map((t) => [String(t.chatSessionId), t]));

        const data = sessions
            .filter((s) => lastBy.has(String(s._id)))
            .map((s) => {
                const last: any = lastBy.get(String(s._id));
                const guest = s.guestId;
                const client = s.clientId;
                const ticket: any = ticketBy.get(String(s._id));
                return {
                    sessionId: s.sessionId,
                    status: s.status,
                    createdAt: s.createdAt,
                    assignedAgent: s.assignedAgent
                        ? { _id: String(s.assignedAgent), name: agentName.get(String(s.assignedAgent))?.name ?? 'A teammate', email: agentName.get(String(s.assignedAgent))?.email }
                        : null,
                    whatsappConversationId: s.whatsappConversationId ? String(s.whatsappConversationId) : null,
                    visitor: {
                        name: guest?.name ?? client?.name ?? 'Website visitor',
                        email: guest?.email ?? client?.emails?.[0] ?? null,
                        phone: guest?.phone ?? client?.phone ?? null,
                        isWhatsapp: guest?.isWhatsapp ?? null,
                        isClient: !!client,
                    },
                    lastMessage: { content: last.content, attachments: last.attachments ?? [], createdAt: last.createdAt, senderModel: last.senderModel },
                    lastMessageAt: last.createdAt,
                    unreadCount: unreadBy.get(String(s._id)) ?? 0,
                    ticket: ticket ? { id: String(ticket._id), ticketId: ticket.ticketId, status: ticket.status } : null,
                };
            })
            .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

        return res.status(200).json({ success: true, data });
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
        announceAgentJoined(sessionId, req.user?.id || '', req.user?.name || 'Support');
        emitSessionStateChange('claimed', sessionId);
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/**
 * Staff: move a website chat to WhatsApp (see liveChatService.handOffToWhatsApp).
 */
async function handOffChatToWhatsApp(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;
        if (!sessionId) return res.status(400).json({ success: false, message: 'Session ID is required' });
        const result = await liveChatService.handOffToWhatsApp(sessionId, { id: req.user?.id || '', name: req.user?.name || 'Support' });
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message });
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
        forgetAnnouncedAgent(sessionId);

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
        const before = await ChatSessionModel.findOne({ sessionId }).select('status').lean();
        const alreadyOpened = (before as any)?.status === 'converted_to_ticket';
        const result = await liveChatService.convertChatToTicket(sessionId, { reason, subject, category });
        emitSessionStateChange('converted', sessionId);

        // The first time: tell the visitor in the chat (a ticket card with their private link; the same link is
        // emailed) and make the ticket show up live in the support Tickets list.
        if (!alreadyOpened) {
            try {
                const ticket: any = await TicketModel.findOne({ ticketId: result.ticketId }).select('_id ticketId subject').lean();
                const session: any = await ChatSessionModel.findOne({ sessionId }).select('_id').lean();
                const ns = getSupportNamespace();
                if (ticket && session && ns) {
                    const token = await ensurePublicToken(ticket._id);
                    const note = await ChatMessageModel.create({
                        sessionId: session._id,
                        sender: new Types.ObjectId(req.user?.id),
                        senderModel: ChatSenderModel.SYSTEM,
                        senderName: 'System',
                        content: `Ticket ${ticket.ticketId} has been opened for you. Track it and reply here: ${trackingUrl(token)}`,
                        attachments: [],
                    });
                    ns.to(sessionId).emit('chat:message', note);
                }
                if (ticket) notifyAgents('ticket:created', { ticketId: String(ticket._id), ticketRef: ticket.ticketId, subject: ticket.subject ?? '' });
            } catch (err: any) {
                logger.warn(`[ticket] opened ${result.ticketId} but could not post the link in the chat: ${err.message}`);
            }
        }
        return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
}

/** Staff: the tickets of the person behind a website chat (by their guest or client record, or their email). */
async function listChatVisitorTickets(req: Request, res: Response) {
    try {
        const session: any = await ChatSessionModel.findOne({ sessionId: req.params.sessionId }).select('guestId clientId').lean();
        if (!session) return res.status(404).json({ success: false, message: 'Chat session not found' });
        const guest: any = session.guestId ? await GuestModel.findById(session.guestId).select('email').lean() : null;
        const or: any[] = [];
        if (session.guestId) or.push({ guestId: session.guestId });
        if (session.clientId) or.push({ clientId: session.clientId });
        if (guest?.email) or.push({ visitorEmail: String(guest.email).toLowerCase() });
        const tickets = or.length
            ? await TicketModel.find({ $or: or }).sort({ createdAt: -1 }).limit(25).select('ticketId subject status category source createdAt').lean()
            : [];
        return res.status(200).json({
            success: true,
            data: tickets.map((t: any) => ({ id: String(t._id), ticketId: t.ticketId, subject: t.subject, status: t.status, category: t.category, source: t.source, createdAt: t.createdAt })),
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
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
    refreshGuestSession,
    logoutGuest,
    requestPresignedUrl,
    getPresignedViewUrl,
    createSupportTicket,
    getTicketDetails,
    replyToTicket,
    getPublicTicketStatus,
    lookupPublicTicket,
    getPublicTicketThread,
    postPublicTicketMessage,
    requestPublicTicketUpload,
    getPublicTicketViewUrl,
    listSupportTickets,
    updateTicket,
    createChatSession,
    claimChatSession,
    convertChatToTicket,
    triggerCloudinaryMigration,
    listQueuedChatSessions,
    listActiveChatSessions,
    listResolvedChatSessions,
    listInboxChatSessions,
    getSupportDashboardStats,
    getChatSessionMessages,
    claimChatSessionParam,
    closeChatSessionParam,
    handOffChatToWhatsApp,
    convertChatToTicketParam,
    listChatVisitorTickets,
    updateTicketStatus,
    assignTicketToSelf,
    reassignChatSession,
    getUnreadCounts,
    listAvailableAgents,
    lookupClientByEmail,
};
