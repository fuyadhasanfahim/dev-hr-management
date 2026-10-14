import type { IPaymentMilestone, IQuotationService } from "@/types/quotation.type";

/**
 * Everything the A4 quotation document needs. Both the wizard payload (before save) and a saved
 * `QuotationData` satisfy it, so the preview, the PDF and the email attachment are always identical.
 */
export interface QuotationDocInput {
    quotationNumber?: string;
    company: { name: string; address?: string; email?: string; phone?: string; website?: string; logo?: string };
    client: { contactName: string; companyName?: string; address?: string; email?: string; phone?: string };
    details: { title: string; date: string; validUntil: string };
    currency?: string;
    overview?: string;
    services: IQuotationService[];
    notIncluded?: string[];
    clientRequirements?: string[];
    includedSupport?: string[];
    keyTerms?: string[];
    workflow?: string[];
    paymentMilestones?: IPaymentMilestone[];
}
