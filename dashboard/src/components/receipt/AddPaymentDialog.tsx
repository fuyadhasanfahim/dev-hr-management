"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import {
  useAddPaymentMutation,
  useGetPaymentSummaryQuery,
} from "@/redux/features/receipt/receiptApi";
import { useConvertQuotationToOrderMutation } from "@/redux/features/order/orderApi";
import { downloadReceiptPdf, receiptPdfFileStem } from "@/lib/download-receipt-pdf";
import { DialogContent } from "@/components/shared/dialog-content";
import { SelectContent } from "@/components/shared/select-content";
import { CalendarContent } from "@/components/shared/calendar-content";
import { CheckboxContent } from "@/components/shared/checkbox-content";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";

const paymentFormSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  paymentDate: z.string().min(1, "Payment date is required"),
  milestoneLabel: z.string().optional(),
});

const paymentTypeOptions = [
  { label: "Partial Payment", value: "partial" },
  { label: "Full Payment", value: "full" },
  { label: "Milestone", value: "milestone" },
];

const methodOptions = [
  { label: "bKash", value: "bkash" },
  { label: "Nagad", value: "nagad" },
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Cash", value: "cash" },
];

interface AddPaymentDialogProps {
  /** Quotation group to record a payment against — its zero-payment Receipt is resolved automatically. */
  quotationGroupId: string | null;
  /** Shown in the dialog title/description when the summary hasn't loaded yet. */
  quotationNumber?: string;
  onClose: () => void;
  /** Called after a payment is successfully recorded (and, if requested, an order created). */
  onRecorded?: () => void;
}

export function AddPaymentDialog({
  quotationGroupId,
  quotationNumber,
  onClose,
  onRecorded,
}: AddPaymentDialogProps) {
  const isOpen = !!quotationGroupId;

  const [paymentType, setPaymentType] = useState<"full" | "partial" | "milestone">("partial");
  const [milestoneLabel, setMilestoneLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [method, setMethod] = useState("bkash");
  const [note, setNote] = useState("");
  const [autoCreateOrder, setAutoCreateOrder] = useState(false);

  const [addPayment, { isLoading: isAddingPayment }] = useAddPaymentMutation();
  const [convertQuotationToOrder, { isLoading: isConvertingOrder }] =
    useConvertQuotationToOrderMutation();

  const { data: summaryData } = useGetPaymentSummaryQuery(quotationGroupId || "", {
    skip: !isOpen,
  });

  // Reset form state each time a new quotation is targeted.
  useEffect(() => {
    if (!isOpen) return;
    setPaymentType("partial");
    setMilestoneLabel("");
    setAmount("");
    setPaymentDate(new Date());
    setMethod("bkash");
    setNote("");
    setAutoCreateOrder(false);
  }, [isOpen, quotationGroupId]);

  // An Order already exists for this quotation — auto-creating another one is a no-op, disable it.
  useEffect(() => {
    if (summaryData?.quotation.orderId && autoCreateOrder) {
      setAutoCreateOrder(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryData?.quotation.orderId]);

  const isFullyPaid = !!summaryData && summaryData.remaining <= 0.009;
  const hasExistingOrder = !!summaryData?.quotation.orderId;
  const currency = summaryData?.quotation.currency || "৳";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotationGroupId) return;

    if (!amount.trim()) {
      toast.error("Amount is required");
      return;
    }

    const parsedAmount = parseFloat(amount);
    const formattedDateString = format(paymentDate, "yyyy-MM-dd");

    const validation = paymentFormSchema.safeParse({
      amount: isNaN(parsedAmount) ? undefined : parsedAmount,
      paymentDate: formattedDateString,
      milestoneLabel: paymentType === "milestone" ? milestoneLabel : undefined,
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || "Validation failed");
      return;
    }

    if (paymentType === "milestone" && !milestoneLabel.trim()) {
      toast.error("Milestone label is required for milestone payment type");
      return;
    }

    const receiptId = summaryData?.receipt?._id;
    if (!receiptId) {
      toast.error("No receipt ledger found for this quotation. Please contact support.");
      return;
    }

    const toastId = toast.loading("Recording payment...");
    try {
      const result = await addPayment({
        receiptId,
        paymentType,
        amount: parsedAmount,
        paymentDate: formattedDateString,
        method: method || undefined,
        note: note || undefined,
        milestoneLabel: paymentType === "milestone" ? milestoneLabel : undefined,
      }).unwrap();

      toast.success("Payment recorded successfully", { id: toastId });

      // Close right away — the PDF download and (optional) order creation
      // continue in the background and report their own progress via toasts.
      onRecorded?.();
      onClose();

      const pdfToastId = toast.loading("Generating receipt PDF...");
      downloadReceiptPdf(result.receipt._id, receiptPdfFileStem(result.receipt.receiptNumber)).then(
        (downloaded) => {
          if (downloaded) {
            toast.success("Receipt PDF downloaded", { id: pdfToastId });
          } else {
            toast.dismiss(pdfToastId);
          }
        }
      );

      if (autoCreateOrder && !hasExistingOrder) {
        const orderToastId = toast.loading("Converting quotation to order...");
        convertQuotationToOrder({ quotationGroupId })
          .unwrap()
          .then(() => {
            toast.success("Order automatically generated", { id: orderToastId });
            onRecorded?.();
          })
          .catch((orderErr: any) => {
            toast.error(
              orderErr?.data?.message || orderErr?.message || "Payment recorded but failed to create order.",
              { id: orderToastId }
            );
          });
      }
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to record payment", { id: toastId });
    }
  };

  const displayNumber = summaryData?.quotation.quotationNumber || quotationNumber;

  return (
    <DialogContent
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      description={displayNumber ? `Record payment receipt for ${displayNumber}` : undefined}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isAddingPayment || isConvertingOrder || isFullyPaid}
            className="rounded-2xl bg-brand-primary text-white text-xs font-bold px-4 py-2 hover:bg-brand-primary/90 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAddingPayment || isConvertingOrder ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Payment"
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Branded Financial Overview */}
        {summaryData && (() => {
          const grandTotal = summaryData.quotation?.grandTotal || 0;
          const alreadyPaid = summaryData.totalPaid || 0;
          const todayAmt = amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? parseFloat(amount) : 0;
          const remainingAfter = Math.max(0, (summaryData.remaining || 0) - todayAmt);
          const paidPercent = grandTotal > 0 ? Math.min(100, (alreadyPaid / grandTotal) * 100) : 0;
          const todayPercent = grandTotal > 0 ? Math.min(100 - paidPercent, (todayAmt / grandTotal) * 100) : 0;
          return (
            <div className="rounded-2xl overflow-hidden border border-brand-primary/15 dark:border-brand-primary/25 animate-in fade-in duration-200 shadow-sm">
              <div className="bg-gradient-to-br from-[#4E12D4]/8 via-[#C850FA]/5 to-[#4E12D4]/4 dark:from-[#4E12D4]/20 dark:via-[#C850FA]/10 dark:to-[#4E12D4]/15 px-4 pt-3.5 pb-3.5">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Quotation Total</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                    {formatMoney(grandTotal, currency)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200/60 dark:bg-slate-800/80 overflow-hidden">
                  <div className="h-full flex">
                    <div className="h-full bg-emerald-500 transition-all duration-500 ease-out rounded-l-full" style={{ width: `${paidPercent}%` }} />
                    <div className="h-full bg-brand-accent/70 transition-all duration-500 ease-out" style={{ width: `${todayPercent}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                    <span className="h-1.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                    Already paid
                  </span>
                  {todayAmt > 0 && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                      <span className="h-1.5 w-2.5 rounded-full bg-brand-accent/70 inline-block" />
                      This payment
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800/80 bg-white/70 dark:bg-slate-900/30">
                <div className="px-4 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 mb-0.5">Today's Payment</p>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-none">
                    {todayAmt > 0 ? formatMoney(todayAmt, currency) : <span className="text-slate-300 dark:text-slate-600 text-sm font-semibold">—</span>}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-primary dark:text-purple-400 mb-0.5">Remaining After</p>
                  <p className="text-base font-black text-brand-primary dark:text-purple-300 leading-none">
                    {formatMoney(remainingAfter, currency)}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {isFullyPaid && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 p-3.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            This quotation is already fully paid. No further payments can be recorded.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Payment Type */}
          <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Payment Type
            </label>
            <SelectContent
              value={paymentType}
              onChange={(val) => setPaymentType(val as any)}
              options={paymentTypeOptions}
              align={summaryData ? "down" : "up"}
            />
          </div>

          {/* Payment Method */}
          <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Payment Method
            </label>
            <SelectContent
              value={method}
              onChange={setMethod}
              options={methodOptions}
              align={summaryData ? "down" : "up"}
            />
          </div>

          {/* Milestone Label */}
          {paymentType === "milestone" && (
            <div className="flex flex-col gap-1.5 col-span-2 animate-in slide-in-from-top-2 duration-200">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Milestone Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 50% Advance, Delivery Stage..."
                value={milestoneLabel}
                onChange={(e) => setMilestoneLabel(e.target.value)}
                className="w-full h-10 px-3.5 py-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-slate-800 dark:text-slate-100"
              />
            </div>
          )}

          {/* Amount */}
          <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Amount ({currency}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 px-3.5 py-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Payment Date */}
          <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <CalendarContent
              value={paymentDate}
              onChange={setPaymentDate}
              align={summaryData ? "down" : "up"}
            />
          </div>
        </div>

        {/* Note */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Note (optional)
          </label>
          <Textarea
            placeholder="Add payment transaction note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[70px] rounded-2xl border border-slate-200/85 dark:border-slate-800 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary placeholder:text-slate-450 p-3 text-sm focus:outline-none bg-white/70 dark:bg-slate-900/50"
          />
        </div>

        {/* Auto Create Order Checkbox */}
        <div className="pt-2">
          <CheckboxContent
            checked={autoCreateOrder && !hasExistingOrder}
            onChange={setAutoCreateOrder}
            disabled={hasExistingOrder}
            label={
              hasExistingOrder
                ? "Order already created for this quotation"
                : "Automatically create associated Order in system?"
            }
          />
        </div>
      </form>
    </DialogContent>
  );
}
