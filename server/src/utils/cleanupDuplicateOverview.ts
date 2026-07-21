import QuotationModel from '../models/quotation.model.js';
import OrderModel from '../models/order.model.js';
import { logger } from '../lib/logger.js';

export async function cleanupDuplicateOverviewInDB(): Promise<{ updatedQuotationsCount: number; updatedOrdersCount: number }> {
    let updatedQuotationsCount = 0;
    let updatedOrdersCount = 0;

    try {
        // 1. Cleanup Quotation documents
        const quotations = await QuotationModel.find({
            overview: { $exists: true, $ne: '' }
        });

        for (const q of quotations) {
            const overviewText = (q.overview || '').trim().toLowerCase();
            if (!overviewText || !Array.isArray(q.services)) continue;

            let modified = false;
            q.services.forEach((s: any) => {
                const scopeDesc = (s.scopeDescription || '').trim().toLowerCase();
                if (scopeDesc && (scopeDesc === overviewText || overviewText.includes(scopeDesc) || scopeDesc.includes(overviewText))) {
                    s.scopeDescription = '';
                    modified = true;
                }
            });

            if (modified) {
                await q.save();
                updatedQuotationsCount++;
            }
        }

        // 2. Cleanup Order documents
        const orders = await OrderModel.find({
            'quotationSnapshot.overview': { $exists: true, $ne: '' }
        });

        for (const order of orders) {
            const overviewText = (order.quotationSnapshot?.overview || '').trim().toLowerCase();
            const services = order.quotationSnapshot?.services;
            if (!overviewText || !Array.isArray(services)) continue;

            let modified = false;
            services.forEach((s: any) => {
                const scopeDesc = (s.scopeDescription || '').trim().toLowerCase();
                if (scopeDesc && (scopeDesc === overviewText || overviewText.includes(scopeDesc) || scopeDesc.includes(overviewText))) {
                    s.scopeDescription = '';
                    modified = true;
                }
            });

            if (modified) {
                order.markModified('quotationSnapshot');
                await order.save();
                updatedOrdersCount++;
            }
        }

        logger.info({ updatedQuotationsCount, updatedOrdersCount }, 'Database overview deduplication completed successfully');
    } catch (err) {
        logger.error({ err }, 'Failed to run database overview deduplication');
    }

    return { updatedQuotationsCount, updatedOrdersCount };
}
