import { QuotationCategory, IPaymentMilestone } from "@/types/quotation.type";

export type ReceiptPaymentType = "full" | "partial" | "milestone";
export type ReceiptStatus = "issued" | "void";

export interface IReceipt {
  _id: string;
  receiptNumber: string;

  quotationId: string;
  quotationGroupId: string;
  quotationNumber: string;

  clientId: string;
  clientName: string;
  projectTitle: string;
  category: QuotationCategory;
  currency: string;

  paymentType: ReceiptPaymentType;
  milestoneLabel?: string;
  amount: number;
  paymentDate: string;
  method?: string;
  note?: string;

  status: ReceiptStatus;
  voidReason?: string;

  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentSummaryQuotation {
  _id: string;
  quotationGroupId: string;
  quotationNumber: string;
  title: string;
  category: QuotationCategory;
  currency: string;
  grandTotal: number;
  paymentMilestones: IPaymentMilestone[];
  clientId: string;
}

export interface PaymentSummary {
  quotation: PaymentSummaryQuotation;
  receipts: IReceipt[];
  totalPaid: number;
  remaining: number;
}
