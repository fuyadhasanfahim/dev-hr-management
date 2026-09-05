import type { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service.js';

/**
 * GET /api/payments/invoice/:token — public, read-only.
 * `resolvePaymentToken` middleware has already validated the token and
 * populated `req.paymentCtx`; this handler just shapes the response.
 */
async function getInvoiceByToken(req: Request, res: Response, next: NextFunction) {
    try {
        const summary = await PaymentService.getInvoiceSummary(req.paymentCtx!);
        res.status(200).json({ success: true, data: summary });
    } catch (err) {
        next(err);
    }
}

export default {
    getInvoiceByToken,
};
