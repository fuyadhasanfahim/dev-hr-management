import type { Request, Response, NextFunction } from 'express';
import { QuotationPaymentService } from '../services/quotation-payment.service.js';
import { AppError } from '../utils/AppError.js';

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
            const result = await QuotationPaymentService.createStripePaymentIntent(
                quotationGroupId,
                phase as Phase,
            );
            return res.status(200).json({ success: true, data: result });
        }

        if (provider === 'paypal') {
            const result = await QuotationPaymentService.createPayPalOrder(
                quotationGroupId,
                phase as Phase,
            );
            return res.status(200).json({ success: true, data: result });
        }

        return next(new AppError('provider must be stripe or paypal', 400));
    } catch (err) {
        next(err);
    }
}

/**
 * Get the full payment phase status for a quotation group.
 */
async function getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const { groupId } = req.params;
        const result = await QuotationPaymentService.getPaymentStatus(groupId);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'No payment tracker found. Quotation may not have been accepted yet.',
            });
        }
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

export default {
    createPaymentIntent,
    getPaymentStatus,
};
