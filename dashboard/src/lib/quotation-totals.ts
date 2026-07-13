import { IQuotationService, IQuotationLineItem, isUpfrontBillingCycle } from "@/types/quotation.type";

export interface ServiceTotal {
  category: string;
  upfrontTotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
}

/** Mirrors the server's calculateTotals() per-service math (quotation.service.ts) so the live form total matches what gets saved. */
export function computeServiceTotal(service: IQuotationService): ServiceTotal {
  const basePrice = Number(service.basePrice) || 0;
  const upfrontLineItemsTotal = (service.lineItems || []).reduce((acc, item) => {
    if (isUpfrontBillingCycle(item.billingCycle)) {
      return acc + (Number(item.price) || 0) * (item.quantity ?? 1);
    }
    return acc;
  }, 0);
  const upfrontTotal = basePrice + upfrontLineItemsTotal;
  const discountAmount = (upfrontTotal * (Number(service.discount) || 0)) / 100;
  const afterDiscount = upfrontTotal - discountAmount;
  const taxAmount = (afterDiscount * (Number(service.taxRate) || 0)) / 100;
  const grandTotal = afterDiscount + taxAmount;
  return { category: service.category, upfrontTotal, discountAmount, taxAmount, grandTotal };
}

export function computeQuotationTotals(services: IQuotationService[]): {
  perService: ServiceTotal[];
  totals: { subtotal: number; discountAmount: number; taxAmount: number; grandTotal: number };
  recurringCharges: IQuotationLineItem[];
} {
  const perService = services.map(computeServiceTotal);

  const recurringCharges: IQuotationLineItem[] = [];
  services.forEach((s) => {
    (s.lineItems || []).forEach((item) => {
      if (!isUpfrontBillingCycle(item.billingCycle)) recurringCharges.push(item);
    });
  });

  const discountAmount = perService.reduce((a, s) => a + s.discountAmount, 0);
  const taxAmount = perService.reduce((a, s) => a + s.taxAmount, 0);
  const subtotal = perService.reduce((a, s) => a + (s.upfrontTotal - s.discountAmount), 0);
  const grandTotal = perService.reduce((a, s) => a + s.grandTotal, 0);

  return {
    perService,
    totals: { subtotal, discountAmount, taxAmount, grandTotal },
    recurringCharges,
  };
}
