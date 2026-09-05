import { Router } from 'express';
import PaymentController from '../controllers/payment.controller.js';
import { resolvePaymentToken } from '../middlewares/payment-token.middleware.js';
import { paymentLimiter } from '../middlewares/rate-limit.middleware.js';

const router: Router = Router();

// ─── Public client routes (no session — validated by the payment token itself) ───
// PayPal create-order/capture-order routes land here in the next phase, the
// same way. The Stripe *webhook* is intentionally NOT here — it's mounted
// directly on the app in app.ts, ahead of the JSON body parser, since
// signature verification needs the raw request bytes.
router.get('/invoice/:token', paymentLimiter, resolvePaymentToken, PaymentController.getInvoiceByToken);
router.post('/stripe/create-intent', paymentLimiter, resolvePaymentToken, PaymentController.createStripeIntent);

export const paymentRoute = router;
