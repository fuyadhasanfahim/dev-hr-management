import express from 'express';
import AIChatController from '../controllers/ai-chat.controller.js';
import { requireUnifiedAuth, optionalUnifiedAuth } from './support.route.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { CreateTicketFromAIValidation } from '../validators/ticket.validator.js';
import { aiChatLimiter, generalPublicLimiter } from '../middlewares/rate-limit.middleware.js';

const router = express.Router();

// Public endpoint — no auth required for basic AI chat (rate-limited: Gemini cost)
router.post('/chat', aiChatLimiter, AIChatController.chat);

// Public endpoint — get info about Web Briks services
router.get('/info', generalPublicLimiter, AIChatController.getInfo);

// Optional auth — verified guests/clients are attributed via their session; an
// unverified visitor may instead supply name + email in the body.
router.post('/ticket', optionalUnifiedAuth, validateRequest(CreateTicketFromAIValidation), AIChatController.createTicketFromAI);

// Auth required — connect to live human support
router.post('/live-support', requireUnifiedAuth, AIChatController.connectLiveSupport);

export const AIChatRoutes = router;
export default AIChatRoutes;
