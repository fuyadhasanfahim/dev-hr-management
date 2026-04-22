import { z } from 'zod';
import { PaymentMethod } from '../models/payment.model.js';

export const PaymentValidation = z.object({
    body: z.object({
        invoiceId: z.string().min(1, 'Invoice ID is required'),
        amount: z.number().positive('Amount must be positive'),
        method: z.nativeEnum(PaymentMethod),
        transactionId: z.string().optional(),
        notes: z.string().optional(),
    }).refine(data => {
        // Require transactionId for digital payments
        if ((data.method === PaymentMethod.STRIPE || data.method === PaymentMethod.PAYPAL) && !data.transactionId) {
            return false;
        }
        return true;
    }, {
        message: "Transaction ID is required for Stripe or PayPal payments",
        path: ["transactionId"],
    }),
});
