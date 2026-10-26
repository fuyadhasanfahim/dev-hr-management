import express from 'express';
import AIChatController from '../controllers/ai-chat.controller.js';
import { requireUnifiedAuth, optionalUnifiedAuth } from './support.route.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { CreateTicketFromAIValidation } from '../validators/ticket.validator.js';
import { isAiActive } from '../services/ai-settings.service.js';
import { aiChatLimiter, generalPublicLimiter } from '../middlewares/rate-limit.middleware.js';
import { verifyTurnstile } from '../middlewares/turnstile.middleware.js';

const router = express.Router();

// Public endpoint — no auth required for basic AI chat (rate-limited: OpenAI cost)
router.post('/chat', aiChatLimiter, optionalUnifiedAuth, AIChatController.chat);

// Public endpoint — get info about Web Briks services
router.get('/info', generalPublicLimiter, AIChatController.getInfo);

// Public — lets the widget know whether the AI is on, to offer live support instead when it is not
router.get('/status', generalPublicLimiter, async (_req, res) => {
    res.status(200).json({ success: true, available: await isAiActive('web_chat') });
});

// Optional auth — verified guests/clients are attributed via their session; an
// unverified visitor may instead supply name + email in the body.
router.post('/ticket', optionalUnifiedAuth, verifyTurnstile, validateRequest(CreateTicketFromAIValidation), AIChatController.createTicketFromAI);

// Auth required — connect to live human support
router.post('/live-support', requireUnifiedAuth, AIChatController.connectLiveSupport);

export const AIChatRoutes = router;
export default AIChatRoutes;
