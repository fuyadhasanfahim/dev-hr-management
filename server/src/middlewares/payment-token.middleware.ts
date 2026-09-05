import type { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service.js';

/**
 * Resolves and validates the payment token for a public payment request —
 * signature + expiry (JWT), then the DB-side single-use/rotation guard, then
 * a live recompute of the amount due. On success, `req.paymentCtx` carries
 * the only amount/order/receipt data downstream handlers should trust; any
 * `amount` field a client sends in the request body is for display only and
 * MUST NOT be used to charge or record a payment.
 *
 * Accepts the token from (in order): the `:token` route param, or `token` in
 * the JSON body — covers both the read-only GET summary route and the POST
 * create-intent/create-order routes.
 */
export async function resolvePaymentToken(req: Request, _res: Response, next: NextFunction) {
    try {
        const raw = (req.params?.token as string | undefined) ?? (req.body?.token as string | undefined);
        req.paymentCtx = await PaymentService.resolveActiveToken(raw ?? '');
        next();
    } catch (err) {
        next(err);
    }
}

export default resolvePaymentToken;
