import { hasPermission } from '../lib/permissions.js';

/**
 * Field-level visibility gate for orders & quotations.
 *
 * Two independent permissions decide what the API sends back:
 *   - `order.viewFinancials` — prices / amounts / payment figures
 *   - `order.viewClient`     — client identity (name, email, requirements)
 *
 * Holders: super_admin (`*`), admin (`order.*`), hr_manager, and anyone in
 * the Telemarketing department (its grant carries both). Everyone else gets
 * those fields stripped from the response object here — this is not a UI
 * mask, the data never leaves the server.
 */

export type Viewer = { permissions?: readonly string[] | null } | null | undefined;

export function canViewFinancials(viewer?: Viewer): boolean {
    return hasPermission(viewer?.permissions, 'order.viewFinancials');
}

export function canViewClient(viewer?: Viewer): boolean {
    return hasPermission(viewer?.permissions, 'order.viewClient');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripOrderFinancials(obj: any): void {
    obj.isFinancialsMasked = true;

    if (obj.paymentPhases) {
        const rawDue =
            (obj.paymentPhases.upfront?.amountDue || 0) +
            (obj.paymentPhases.delivery?.amountDue || 0) +
            (obj.paymentPhases.final?.amountDue || 0);
        const rawPaid =
            (obj.paymentPhases.upfront?.amountPaid || 0) +
            (obj.paymentPhases.delivery?.amountPaid || 0) +
            (obj.paymentPhases.final?.amountPaid || 0);

        obj.paymentPhases.totalPercentage =
            rawDue > 0 ? Math.floor((rawPaid / rawDue) * 100) : 0;

        for (const k of ['upfront', 'delivery', 'final']) {
            const phase = obj.paymentPhases[k];
            if (phase && phase.amountDue > 0) {
                phase.percentage = Math.floor(
                    (phase.amountPaid / phase.amountDue) * 100,
                );
            }
            if (phase) {
                delete phase.amountDue;
                delete phase.amountPaid;
                delete phase.paymentHistory;
            }
        }
    }

    delete obj.totalAmount;
    delete obj.totalPrice;
    delete obj.grandTotal;

    if (obj.quotationSnapshot) {
        delete obj.quotationSnapshot.grandTotal;
        delete obj.quotationSnapshot.taxAmount;
        delete obj.quotationSnapshot.discountAmount;

        if (Array.isArray(obj.quotationSnapshot.services)) {
            obj.quotationSnapshot.services = obj.quotationSnapshot.services.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (svc: any) => {
                    const { basePrice, discount, taxRate, lineItems, ...rest } = svc;
                    return {
                        ...rest,
                        ...(Array.isArray(lineItems)
                            ? {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  lineItems: lineItems.map((item: any) => {
                                      const { price, ...itemRest } = item;
                                      return itemRest;
                                  }),
                              }
                            : {}),
                    };
                },
            );
        }
        if (Array.isArray(obj.quotationSnapshot.recurringCharges)) {
            obj.quotationSnapshot.recurringCharges =
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                obj.quotationSnapshot.recurringCharges.map((s: any) => {
                    const { price, ...rest } = s;
                    return rest;
                });
        }
        if (Array.isArray(obj.quotationSnapshot.scopeOfWork)) {
            obj.quotationSnapshot.scopeOfWork =
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                obj.quotationSnapshot.scopeOfWork.map((s: any) => {
                    const { price, rate, ...rest } = s;
                    return rest;
                });
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripOrderClient(obj: any): void {
    obj.isClientMasked = true;
    delete obj.clientId;
    delete obj.clientName;
    delete obj.clientEmail;
    delete obj.clientPhone;
    delete obj.clientRequirements;
    delete obj.clientAddress;
    if (obj.quotationSnapshot) {
        delete obj.quotationSnapshot.clientId;
        delete obj.quotationSnapshot.clientName;
        delete obj.quotationSnapshot.clientEmail;
        delete obj.quotationSnapshot.client;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripQuotationFinancials(obj: any): void {
    obj.isFinancialsMasked = true;

    if (obj.totals) {
        delete obj.totals.subtotal;
        delete obj.totals.discountAmount;
        delete obj.totals.taxAmount;
        delete obj.totals.grandTotal;
    }

    if (Array.isArray(obj.services)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obj.services = obj.services.map((svc: any) => {
            const { basePrice, discount, taxRate, lineItems, ...rest } = svc;
            return {
                ...rest,
                ...(Array.isArray(lineItems)
                    ? {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          lineItems: lineItems.map((item: any) => {
                              const { price, ...itemRest } = item;
                              return itemRest;
                          }),
                      }
                    : {}),
            };
        });
    }
    if (Array.isArray(obj.recurringCharges)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obj.recurringCharges = obj.recurringCharges.map((s: any) => {
            const { price, ...rest } = s;
            return rest;
        });
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripQuotationClient(obj: any): void {
    obj.isClientMasked = true;
    delete obj.client; // client identity snapshot — NOT `company` (that is us)
    delete obj.clientId;
    delete obj.clientRequirements;
}

/**
 * Strips forbidden financial / client fields from an order object based on
 * the viewer's permissions.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maskOrder(order: any, viewer?: Viewer): any {
    if (!order) return order;

    const seeMoney = canViewFinancials(viewer);
    const seeClient = canViewClient(viewer);
    if (seeMoney && seeClient) return order;

    const raw = order.toObject ? order.toObject() : order;
    const obj = JSON.parse(JSON.stringify(raw));

    if (!seeMoney) stripOrderFinancials(obj);
    if (!seeClient) stripOrderClient(obj);

    return obj;
}

/** Scrub financial / client data from a quotation payload tree. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maskQuotation(quotation: any, viewer?: Viewer): any {
    if (!quotation) return quotation;

    const seeMoney = canViewFinancials(viewer);
    const seeClient = canViewClient(viewer);
    if (seeMoney && seeClient) return quotation;

    const raw = quotation.toObject ? quotation.toObject() : quotation;
    const obj = JSON.parse(JSON.stringify(raw));

    if (!seeMoney) stripQuotationFinancials(obj);
    if (!seeClient) stripQuotationClient(obj);

    return obj;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maskOrders(orders: any[], viewer?: Viewer): any[] {
    if (!orders || !Array.isArray(orders)) return orders;
    if (canViewFinancials(viewer) && canViewClient(viewer)) return orders;
    return orders.map((o) => maskOrder(o, viewer));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maskQuotations(quotations: any[], viewer?: Viewer): any[] {
    if (!quotations || !Array.isArray(quotations)) return quotations;
    if (canViewFinancials(viewer) && canViewClient(viewer)) return quotations;
    return quotations.map((q) => maskQuotation(q, viewer));
}
