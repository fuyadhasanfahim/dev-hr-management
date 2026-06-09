import express from 'express';
import SupportController from '../controllers/support.controller.js';
import MeetingController from '../controllers/meeting.controller.js';
import { requireAuth, restrictTo } from '../middlewares/auth.middleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
    CreateTicketValidation,
    UpdateTicketValidation,
    UpdateTicketStatusValidation,
    ConvertChatToTicketValidation,
    ConvertChatToTicketBodyValidation,
} from '../validators/ticket.validator.js';
import jwt from 'jsonwebtoken';
import envConfig from '../config/env.config.js';
import GuestModel from '../models/guest.model.js';
import { otpLimiter, generalPublicLimiter } from '../middlewares/rate-limit.middleware.js';
import type { Request, Response, NextFunction } from 'express';

const router = express.Router();

export async function requireUnifiedAuth(req: Request, res: Response, next: NextFunction) {
    const sessionToken = req.headers.authorization?.split(' ')[1];
    if (sessionToken && !req.headers.cookie?.includes('better-auth.session_token')) {
        const sessionCookie = `better-auth.session_token=${sessionToken}`;
        req.headers.cookie = req.headers.cookie 
            ? `${req.headers.cookie}; ${sessionCookie}` 
            : sessionCookie;
    }

    let authenticated = false;
    try {
        await requireAuth(req, res, () => {
            if (req.user) {
                authenticated = true;
            }
        });
    } catch (err) {
        // Ignore and check guest JWT
    }

    if (authenticated) {
        return next();
    }

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

    if (token) {
        try {
            const decoded = jwt.verify(token, envConfig.better_auth_secret) as {
                id: string;
                email: string;
                name: string;
                role: string;
            };

            if (decoded.role === 'Guest') {
                const guest = await GuestModel.findById(decoded.id);
                if (guest) {
                    req.user = {
                        id: guest._id.toString(),
                        name: guest.name,
                        email: guest.email,
                        role: 'Guest',
                    };
                    return next();
                }
            }
        } catch (err) {
            // Ignore
        }
    }

    return res.status(401).json({ success: false, message: 'Authentication required. Please login or verify guest OTP.' });
}

/**
 * Like requireUnifiedAuth, but never rejects: it attaches req.user when a valid
 * session or guest token is present and otherwise continues anonymously. Used by
 * endpoints (e.g. ticket creation) that also accept an explicit name/email for
 * unverified visitors.
 */
export async function optionalUnifiedAuth(req: Request, res: Response, next: NextFunction) {
    const sessionToken = req.headers.authorization?.split(' ')[1];
    if (sessionToken && !req.headers.cookie?.includes('better-auth.session_token')) {
        const sessionCookie = `better-auth.session_token=${sessionToken}`;
        req.headers.cookie = req.headers.cookie
            ? `${req.headers.cookie}; ${sessionCookie}`
            : sessionCookie;
    }

    let authenticated = false;
    try {
        await requireAuth(req, res, () => {
            if (req.user) authenticated = true;
        });
    } catch (err) {
        // Ignore and try the guest JWT.
    }
    if (authenticated) return next();

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    if (token) {
        try {
            const decoded = jwt.verify(token, envConfig.better_auth_secret) as {
                id: string;
                email: string;
                name: string;
                role: string;
            };
            if (decoded.role === 'Guest') {
                const guest = await GuestModel.findById(decoded.id);
                if (guest) {
                    req.user = {
                        id: guest._id.toString(),
                        name: guest.name,
                        email: guest.email,
                        role: 'Guest',
                    };
                }
            }
        } catch (err) {
            // Ignore — continue anonymously.
        }
    }

    return next();
}

// Public + abuse-prone: OTP sends a real email → strict per-IP+email throttle.
router.post('/guest/otp', otpLimiter, SupportController.requestGuestOtp);
router.post('/guest/verify', generalPublicLimiter, SupportController.verifyGuestOtp);
// Silent session renewal via the httpOnly refresh cookie (no re-OTP).
router.post('/guest/refresh', generalPublicLimiter, SupportController.refreshGuestSession);
router.post('/guest/logout', requireUnifiedAuth, SupportController.logoutGuest);

router.post('/attachments/presigned-url', requireUnifiedAuth, SupportController.requestPresignedUrl);
router.get('/attachments/view-url', requireUnifiedAuth, SupportController.getPresignedViewUrl);
router.post('/tickets', requireUnifiedAuth, validateRequest(CreateTicketValidation), SupportController.createSupportTicket);
router.get('/tickets', requireUnifiedAuth, SupportController.listSupportTickets);
// Must be registered before /tickets/:id to avoid 'admin' being captured as :id
router.get('/tickets/admin', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.listSupportTickets);
router.get('/tickets/:id', requireUnifiedAuth, SupportController.getTicketDetails);
router.post('/tickets/:id/replies', requireUnifiedAuth, SupportController.replyToTicket);
// Alias for clients that call the singular form
router.post('/tickets/:id/reply', requireUnifiedAuth, SupportController.replyToTicket);
router.post('/chats/session', generalPublicLimiter, requireUnifiedAuth, SupportController.createChatSession);

// Live Support Chat Console Endpoints (for staff dashboard)
// Static routes must come before :sessionId param routes
router.get('/chat/sessions/queued', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.listQueuedChatSessions);
router.get('/chat/sessions/active', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.listActiveChatSessions);
router.get('/chat/sessions/resolved', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.listResolvedChatSessions);
router.get('/dashboard/stats', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.getSupportDashboardStats);
router.get('/chat/sessions/unread-counts', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.getUnreadCounts);
router.get('/chat/agents', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.listAvailableAgents);
router.get('/chat/client-lookup', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.lookupClientByEmail);
router.post('/meetings', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), MeetingController.createMeeting);
router.get('/chat/sessions/:sessionId/messages', requireUnifiedAuth, SupportController.getChatSessionMessages);
router.post('/chat/sessions/:sessionId/claim', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.claimChatSessionParam);
router.post('/chat/sessions/:sessionId/close', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.closeChatSessionParam);
router.post('/chat/sessions/:sessionId/convert', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), validateRequest(ConvertChatToTicketValidation), SupportController.convertChatToTicketParam);
router.post('/chat/sessions/:sessionId/reassign', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.reassignChatSession);

router.patch('/tickets/:id', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), validateRequest(UpdateTicketValidation), SupportController.updateTicket);
router.patch('/tickets/:id/status', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), validateRequest(UpdateTicketStatusValidation), SupportController.updateTicketStatus);
router.post('/tickets/:id/assign', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.assignTicketToSelf);
router.post('/chats/claim', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), SupportController.claimChatSession);
router.post('/chats/convert', requireUnifiedAuth, restrictTo('admin', 'super_admin', 'manager', 'staff'), validateRequest(ConvertChatToTicketBodyValidation), SupportController.convertChatToTicket);

router.post('/admin/migrate-cloudinary', requireUnifiedAuth, restrictTo('admin', 'super_admin'), SupportController.triggerCloudinaryMigration);

export const SupportRoutes = router;
export default SupportRoutes;
