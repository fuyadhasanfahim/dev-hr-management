import { QuotationCategory, IPaymentMilestone } from "@/types/quotation.type";

export type ReceiptPaymentType = "full" | "partial" | "milestone";
export type ReceiptStatus = "issued" | "void";
export type PaymentStatus = "pending" | "partial" | "paid" | "void";
export type PaymentEntryStatus = "recorded" | "void";

/** A single payment transaction entry (child of IReceipt) */
export interface IReceiptPayment {
  _id: string;
  receiptId: string;

  paymentType: ReceiptPaymentType;
  milestoneLabel?: string;
  amount: number;
  paymentDate: string;
  method?: string;
  note?: string;

  status: PaymentEntryStatus;
  voidReason?: string;

  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** The receipt ledger — one per quotation */
export interface IReceipt {
  _id: string;
  receiptNumber: string;

  quotationId: string | { _id: string; totals?: { grandTotal?: number } };
  quotationGroupId: string;
  quotationNumber: string;

  clientId: string;
  clientName: string;
  projectTitle: string;
  category: QuotationCategory;
  currency: string;

  // Cached ledger totals
  totalPaid: number;
  paymentStatus: PaymentStatus;
  paymentHistory: IReceiptPayment[];

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
  /** Set once an Order has been created from this quotation group. */
  orderId?: string | null;
}

export interface PaymentSummary {
  quotation: PaymentSummaryQuotation;
  receipt: IReceipt | null;
  payments: IReceiptPayment[];
  totalPaid: number;
  remaining: number;
}
