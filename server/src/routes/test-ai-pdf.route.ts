import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import TestAiPdfController from '../controllers/test-ai-pdf.controller.js';

const router: Router = Router();

// Public + hits a paid OpenAI API, so keep this tight regardless of the global limiter.
const testPdfLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
});

router.post('/pdf', testPdfLimiter, TestAiPdfController.downloadTestPdf);

export const testAiPdfRoute: Router = router;
