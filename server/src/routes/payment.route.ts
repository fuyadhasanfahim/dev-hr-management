import { Router } from 'express';
import PaymentController from '../controllers/payment.controller.js';
import { resolvePaymentToken } from '../middlewares/payment-token.middleware.js';
import { paymentLimiter } from '../middlewares/rate-limit.middleware.js';

const router: Router = Router();

// ─── Public client routes (no session — validated by the payment token itself) ───
// Stripe/PayPal create-intent, create-order, and capture routes land here in
// later phases, each behind `resolvePaymentToken` the same way.
router.get('/invoice/:token', paymentLimiter, resolvePaymentToken, PaymentController.getInvoiceByToken);

export const paymentRoute = router;
