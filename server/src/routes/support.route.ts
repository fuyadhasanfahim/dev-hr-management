import express from 'express';
import SupportController from '../controllers/support.controller.js';
import { requireAuth, restrictTo } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import envConfig from '../config/env.config.js';
import GuestModel from '../models/guest.model.js';
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

router.post('/guest/otp', SupportController.requestGuestOtp);
router.post('/guest/verify', SupportController.verifyGuestOtp);

router.post('/attachments/presigned-url', requireUnifiedAuth, SupportController.requestPresignedUrl);
router.post('/tickets', requireUnifiedAuth, SupportController.createSupportTicket);
router.get('/tickets', requireUnifiedAuth, SupportController.listSupportTickets);
router.get('/tickets/:id', requireUnifiedAuth, SupportController.getTicketDetails);
router.post('/tickets/:id/replies', requireUnifiedAuth, SupportController.replyToTicket);
router.post('/chats/session', requireUnifiedAuth, SupportController.createChatSession);

router.patch('/tickets/:id', requireUnifiedAuth, restrictTo('admin', 'super-admin', 'manager', 'staff'), SupportController.updateTicket);
router.post('/chats/claim', requireUnifiedAuth, restrictTo('admin', 'super-admin', 'manager', 'staff'), SupportController.claimChatSession);
router.post('/chats/convert', requireUnifiedAuth, restrictTo('admin', 'super-admin', 'manager', 'staff'), SupportController.convertChatToTicket);

router.post('/admin/migrate-cloudinary', requireUnifiedAuth, restrictTo('admin', 'super-admin'), SupportController.triggerCloudinaryMigration);

export const SupportRoutes = router;
export default SupportRoutes;
