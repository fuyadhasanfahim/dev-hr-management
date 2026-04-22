import { z } from 'zod';
import { PricingModel } from '../models/service.model.js';
import { OrderType } from '../models/order.model.js';

const orderItemSchema = z.object({
    serviceId: z.string().optional(),
    name: z.string().min(1, 'Item name is required'),
    pricingModel: z.nativeEnum(PricingModel),
    unitPrice: z.number().min(0),
    quantity: z.number().min(1).optional(),
    hours: z.number().min(0.1).optional(),
}).superRefine((data, ctx) => {
    // Pricing Model Validation Logic
    if (data.pricingModel === PricingModel.HOURLY && !data.hours) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Hours are required for hourly pricing model',
            path: ['hours'],
        });
    }
    if (data.pricingModel === PricingModel.FIXED && !data.quantity) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Quantity is required for fixed pricing model',
            path: ['quantity'],
        });
    }
});

export const OrderValidation = z.object({
    body: z.object({
        clientId: z.string().min(1, 'Client ID is required'),
        title: z.string().min(3),
        description: z.string().optional(),
        orderType: z.nativeEnum(OrderType),
        currency: z.string().length(3).optional(),
        items: z.array(orderItemSchema).min(1, 'At least one item is required'),
    }),
});
