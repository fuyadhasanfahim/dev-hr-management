import { z } from 'zod';
import { PricingModel, ServiceCategory } from '../models/service.model.js';

export const ServiceValidation = z.object({
    body: z.object({
        name: z.string().min(3).trim(),
        category: z.nativeEnum(ServiceCategory),
        pricingModel: z.nativeEnum(PricingModel),
        basePrice: z.number().min(0).optional(),
        currency: z.string().length(3).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
    }),
});
