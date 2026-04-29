import type { Request, Response, NextFunction } from 'express';
import { QuotationPaymentService } from '../services/quotation-payment.service.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import { QuotationService } from '../services/quotation.service.js';

const VALID_PHASES = ['upfront', 'delivery', 'final'] as const;
type Phase = typeof VALID_PHASES[number];

/**
 * Create a Stripe PaymentIntent for a specific payment phase.
 *
 * Body: { quotationGroupId, phase, provider? }
 * Returns: { clientSecret, paymentIntentId, amountCents }
 */
async function createPaymentIntent(req: Request, res: Response, next: NextFunction) {
    try {
        const { quotationGroupId, phase, provider = 'stripe' } = req.body;

        if (!quotationGroupId) return next(new AppError('quotationGroupId is required', 400));
        if (!VALID_PHASES.includes(phase as Phase)) {
            return next(new AppError(`phase must be one of: ${VALID_PHASES.join(', ')}`, 400));
        }

        if (provider === 'stripe') {
            logger.info({ quotationGroupId, phase, provider }, 'payment.intent_create.requested');
            const result = await QuotationPaymentService.createStripePaymentIntent(
                quotationGroupId,
                phase as Phase,
            );
            logger.info({ quotationGroupId, phase, provider, paymentIntentId: result.paymentIntentId }, 'payment.intent_create.completed');
            return res.status(200).json({ success: true, data: result });
        }

        if (provider === 'paypal') {
            logger.info({ quotationGroupId, phase, provider }, 'payment.paypal_order_create.requested');
            const result = await QuotationPaymentService.createPayPalOrder(
                quotationGroupId,
                phase as Phase,
            );
            logger.info({ quotationGroupId, phase, provider }, 'payment.paypal_order_create.completed');
            return res.status(200).json({ success: true, data: result });
        }

        return next(new AppError('provider must be stripe or paypal', 400));
    } catch (err) {
        return next(err);
    }
}

/**
 * Get the full payment phase status for a quotation group.
 */
async function getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const { groupId } = req.params;
        if (!groupId) return next(new AppError('groupId is required', 400));
        const result = await QuotationPaymentService.getPaymentStatus(groupId);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No payment tracker found. Quotation may not have been accepted yet.',
            });
        }
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return next(err);
    }
}

/**
 * Public client route (token-authenticated via secure link).
 * POST /api/quotation-payments/client/:token/intent
 * Body: { phase, provider?: 'stripe' | 'paypal' }
 */
async function createClientPaymentIntent(req: Request, res: Response, next: NextFunction) {
    try {
        const { token } = req.params;
        const { phase, provider = 'stripe' } = req.body ?? {};

        if (!token) return next(new AppError('token is required', 400));
        if (!VALID_PHASES.includes(phase as Phase)) {
            return next(new AppError(`phase must be one of: ${VALID_PHASES.join(', ')}`, 400));
        }
        if (provider !== 'stripe' && provider !== 'paypal') {
            return next(new AppError('provider must be stripe or paypal', 400));
        }

        // Token is the credential. This also enforces expiry + latest-version constraints.
        const quotation = await QuotationService.getQuotationByToken(token);
        if (quotation.status !== 'accepted') {
            return next(new AppError('Quotation must be accepted before payment.', 409));
        }

        const quotationGroupId = quotation.quotationGroupId;
        logger.info({ quotationGroupId, phase, provider }, 'payment.client.intent_create.requested');

        if (provider === 'stripe') {
            const result = await QuotationPaymentService.createStripePaymentIntent(quotationGroupId, phase as Phase);
            return res.status(200).json({ success: true, data: result });
        }

        const result = await QuotationPaymentService.createPayPalOrder(quotationGroupId, phase as Phase);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return next(err);
    }
}

/**
 * Public client route (token-authenticated via secure link).
 * GET /api/quotation-payments/client/:token/status
 */
async function getClientPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const { token } = req.params;
        if (!token) return next(new AppError('token is required', 400));

        const quotation = await QuotationService.getQuotationByToken(token);
        const result = await QuotationPaymentService.getPaymentStatus(quotation.quotationGroupId);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No payment tracker found. Quotation may not have been accepted yet.',
            });
        }
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return next(err);
    }
}

export default {
    createPaymentIntent,
    getPaymentStatus,
    createClientPaymentIntent,
    getClientPaymentStatus,
};
