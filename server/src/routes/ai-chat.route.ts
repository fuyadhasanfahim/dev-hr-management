import express from 'express';
import AIChatController from '../controllers/ai-chat.controller.js';
import { requireUnifiedAuth } from './support.route.js';
import { aiChatLimiter, generalPublicLimiter } from '../middlewares/rate-limit.middleware.js';

const router = express.Router();

// Public endpoint — no auth required for basic AI chat (rate-limited: Gemini cost)
router.post('/chat', aiChatLimiter, AIChatController.chat);

// Public endpoint — get info about Web Briks services
router.get('/info', generalPublicLimiter, AIChatController.getInfo);

// Auth required — create a ticket from AI chat conversation
router.post('/ticket', requireUnifiedAuth, AIChatController.createTicketFromAI);

// Auth required — connect to live human support
router.post('/live-support', requireUnifiedAuth, AIChatController.connectLiveSupport);

export const AIChatRoutes = router;
export default AIChatRoutes;
