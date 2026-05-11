import { Role } from '../constants/role.js';

/**
 * Core policy gate governing absolute financial accounting clarity.
 */
export function canViewFinancials(role?: string): boolean {
    if (!role) return false;
    return [Role.SUPER_ADMIN as string, Role.ADMIN as string, Role.HR_MANAGER as string].includes(role);
}

/**
 * Recursively strips explicitly forbidden financial fields from core order objects.
 * Injects derived logical metrics preventing runtime arithmetic collision downstream.
 */
export function maskOrder(order: any, role?: string): any {
    if (!order) return order;
    
    // Direct bypass for authorized tiers
    if (canViewFinancials(role)) return order;
    
    const raw = order.toObject ? order.toObject() : order;
    // Deep copy to avoid modifying model instances by accident
    const obj = JSON.parse(JSON.stringify(raw));

    // Explicit flag marking record as logically masked for client awareness
    obj.isFinancialsMasked = true;

    // 1. Preserve logic for visual tracking bars by pre-computing dynamic thresholds
    if (obj.paymentPhases) {
        // Calculate and append logical holistic percentage metric
        const rawDue = (obj.paymentPhases.upfront?.amountDue || 0) + 
                       (obj.paymentPhases.delivery?.amountDue || 0) + 
                       (obj.paymentPhases.final?.amountDue || 0);
        const rawPaid = (obj.paymentPhases.upfront?.amountPaid || 0) + 
                        (obj.paymentPhases.delivery?.amountPaid || 0) + 
                        (obj.paymentPhases.final?.amountPaid || 0);
        
        obj.paymentPhases.totalPercentage = rawDue > 0 ? Math.floor((rawPaid / rawDue) * 100) : 0;

        // Append static fulfillment phase percentages so component layout preserves tracking state
        if (obj.paymentPhases.upfront && obj.paymentPhases.upfront.amountDue > 0) {
            obj.paymentPhases.upfront.percentage = Math.floor((obj.paymentPhases.upfront.amountPaid / obj.paymentPhases.upfront.amountDue) * 100);
        }
        if (obj.paymentPhases.delivery && obj.paymentPhases.delivery.amountDue > 0) {
            obj.paymentPhases.delivery.percentage = Math.floor((obj.paymentPhases.delivery.amountPaid / obj.paymentPhases.delivery.amountDue) * 100);
        }
        if (obj.paymentPhases.final && obj.paymentPhases.final.amountDue > 0) {
            obj.paymentPhases.final.percentage = Math.floor((obj.paymentPhases.final.amountPaid / obj.paymentPhases.final.amountDue) * 100);
        }

        // Nuke all raw dollar values to completely eliminate downstream extraction vector
        const keys = ['upfront', 'delivery', 'final'];
        keys.forEach(k => {
            if (obj.paymentPhases[k]) {
                delete obj.paymentPhases[k].amountDue;
                delete obj.paymentPhases[k].amountPaid;
                delete obj.paymentPhases[k].paymentHistory;
            }
        });
    }

    // 2. Nuke top level order pricing
    delete obj.totalAmount;
    delete obj.totalPrice;
    delete obj.grandTotal;

    // 3. Nuke nested quotation snapshots pricing data
    if (obj.quotationSnapshot) {
        delete obj.quotationSnapshot.grandTotal;
        delete obj.quotationSnapshot.taxAmount;
        delete obj.quotationSnapshot.taxRate;
        delete obj.quotationSnapshot.discount;
        delete obj.quotationSnapshot.additionalServicesTotal;
        delete obj.quotationSnapshot.subTotal;

        if (Array.isArray(obj.quotationSnapshot.additionalServices)) {
            obj.quotationSnapshot.additionalServices = obj.quotationSnapshot.additionalServices.map((s: any) => {
                const { price, ...rest } = s;
                return rest;
            });
        }
        if (Array.isArray(obj.quotationSnapshot.scopeOfWork)) {
            obj.quotationSnapshot.scopeOfWork = obj.quotationSnapshot.scopeOfWork.map((s: any) => {
                const { price, rate, ...rest } = s;
                return rest;
            });
        }
    }

    return obj;
}

/**
 * Scrub financial sensitive data from quotation payload trees.
 */
export function maskQuotation(quotation: any, role?: string): any {
    if (!quotation) return quotation;
    if (canViewFinancials(role)) return quotation;

    const raw = quotation.toObject ? quotation.toObject() : quotation;
    const obj = JSON.parse(JSON.stringify(raw));

    obj.isFinancialsMasked = true;

    if (obj.pricing) {
        delete obj.pricing.subTotal;
        delete obj.pricing.discount;
        delete obj.pricing.taxRate;
        delete obj.pricing.taxAmount;
        delete obj.pricing.grandTotal;
    }
    if (obj.totals) {
        delete obj.totals.subTotal;
        delete obj.totals.discount;
        delete obj.totals.taxAmount;
        delete obj.totals.grandTotal;
    }

    if (Array.isArray(obj.additionalServices)) {
        obj.additionalServices = obj.additionalServices.map((s: any) => {
            const { price, ...rest } = s;
            return rest;
        });
    }
    if (Array.isArray(obj.scopeOfWork)) {
        obj.scopeOfWork = obj.scopeOfWork.map((s: any) => {
            const { price, rate, amount, ...rest } = s;
            return rest;
        });
    }

    return obj;
}

/**
 * Batch iterator wrapper enabling seamless arrays mapping transparently.
 */
export function maskOrders(orders: any[], role?: string): any[] {
    if (!orders || !Array.isArray(orders)) return orders;
    if (canViewFinancials(role)) return orders;
    return orders.map(o => maskOrder(o, role));
}

export function maskQuotations(quotations: any[], role?: string): any[] {
    if (!quotations || !Array.isArray(quotations)) return quotations;
    if (canViewFinancials(role)) return quotations;
    return quotations.map(q => maskQuotation(q, role));
}
