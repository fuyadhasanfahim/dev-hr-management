"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Eye,
  Ban,
  Receipt,
  Wallet,
  CalendarClock,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { getCategoryConfig } from "@/constants/quotation-templates";
import {
  useGetReceiptsQuery,
  useVoidReceiptMutation,
  useAddPaymentMutation,
  useGetPaymentSummaryQuery,
} from "@/redux/features/receipt/receiptApi";
import { useConvertQuotationToOrderMutation } from "@/redux/features/order/orderApi";
import type { IReceipt } from "@/types/receipt.type";
import ReceiptPuppeteerPdfBtn, {
  receiptPdfFileStem,
} from "@/components/receipt/ReceiptPuppeteerPdfBtn";
import { TableContent } from "@/components/shared/table-content";
import { ColumnDef } from "@tanstack/react-table";
import { DialogContent } from "@/components/shared/dialog-content";
import { SelectContent } from "@/components/shared/select-content";
import { CalendarContent } from "@/components/shared/calendar-content";
import { CheckboxContent } from "@/components/shared/checkbox-content";
import { z } from "zod";

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  full: "Full Payment",
  partial: "Partial Payment",
  milestone: "Milestone",
};

// Zod validation schema for payment record
const paymentFormSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  paymentDate: z.string().min(1, "Payment date is required"),
  milestoneLabel: z.string().optional(),
});

function resolveQuotationTotal(r: IReceipt): number {
  if (!r.quotationId) return 0;
  if (typeof r.quotationId === "string") return 0;
  return (r.quotationId as any).totals?.grandTotal ?? 0;
}

export default function ReceiptsPage() {
  const { data: qData, isLoading, refetch } = useGetReceiptsQuery({
    limit: 1000,
  });
  const [voidReceipt, { isLoading: isVoiding }] = useVoidReceiptMutation();
  const [addPayment, { isLoading: isAddingPayment }] = useAddPaymentMutation();
  const [convertQuotationToOrder, { isLoading: isConvertingOrder }] = useConvertQuotationToOrderMutation();

  const [voidTarget, setVoidTarget] = useState<IReceipt | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // ── Add Payment Form State ───────────────────────────────────────────────
  const [paymentTarget, setPaymentTarget] = useState<IReceipt | null>(null);
  const [paymentType, setPaymentType] = useState<"full" | "partial" | "milestone">("partial");
  const [milestoneLabel, setMilestoneLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [method, setMethod] = useState("bkash");
  const [note, setNote] = useState("");
  const [autoCreateOrder, setAutoCreateOrder] = useState(false);

  // Fetch the financial summary for the currently targeted quotation
  const { data: summaryData } = useGetPaymentSummaryQuery(
    paymentTarget?.quotationGroupId || "",
    { skip: !paymentTarget }
  );

  const receipts = qData?.items || [];

  const stats = useMemo(() => {
    const issued = receipts.filter((r) => r.status === "issued");
    const totalCollected = issued.reduce((sum, r) => sum + (r.totalPaid ?? 0), 0);
    const now = new Date();
    // Use the latest payment date from paymentHistory for "this month" calc
    const thisMonth = issued
      .filter((r) => {
        const lastPayment = r.paymentHistory?.[0];
        if (!lastPayment) return false;
        const d = new Date(lastPayment.paymentDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, r) => {
        // Sum only the payments from this month
        return sum + (r.paymentHistory ?? []).filter((p) => {
          const d = new Date(p.paymentDate);
          return p.status === "recorded" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, p) => s + p.amount, 0);
      }, 0);
    const voidCount = receipts.filter((r) => r.status === "void").length;
    return {
      total: qData?.total ?? receipts.length,
      totalCollected,
      thisMonth,
      voidCount,
    };
  }, [receipts, qData?.total]);

  const confirmVoid = async () => {
    if (!voidTarget) return;
    try {
      await voidReceipt({ id: voidTarget._id, reason: voidReason || undefined }).unwrap();
      toast.success("Receipt voided");
      setVoidTarget(null);
      setVoidReason("");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to void receipt");
    }
  };

  const handleOpenAddPayment = (receipt: IReceipt) => {
    setPaymentTarget(receipt);
    setPaymentType("partial");
    setMilestoneLabel("");
    setAmount("");
    setPaymentDate(new Date());
    setMethod("bkash");
    setNote("");
    setAutoCreateOrder(false);
  };

  const handleCloseAddPayment = () => {
    setPaymentTarget(null);
  };

  const handleAddPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget) return;
    
    if (!amount.trim()) {
      toast.error("Amount is required");
      return;
    }

    const parsedAmount = parseFloat(amount);
    const formattedDateString = format(paymentDate, "yyyy-MM-dd");

    // Zod validation check
    const validation = paymentFormSchema.safeParse({
      amount: isNaN(parsedAmount) ? undefined : parsedAmount,
      paymentDate: formattedDateString,
      milestoneLabel: paymentType === "milestone" ? milestoneLabel : undefined,
    });

    if (!validation.success) {
      const errorMsg = validation.error.issues[0]?.message || "Validation failed";
      toast.error(errorMsg);
      return;
    }

    if (paymentType === "milestone" && !milestoneLabel.trim()) {
      toast.error("Milestone label is required for milestone payment type");
      return;
    }

    const toastId = toast.loading("Recording payment...");
    try {
      // Use the receipt's own _id to add a payment to it
      await addPayment({
        receiptId: paymentTarget._id,
        paymentType,
        amount: parsedAmount,
        paymentDate: formattedDateString,
        method: method || undefined,
        note: note || undefined,
        milestoneLabel: paymentType === "milestone" ? milestoneLabel : undefined,
      }).unwrap();

      toast.success("Payment recorded successfully", { id: toastId });

      // Conditionally convert to order automatically
      if (autoCreateOrder) {
        const orderToastId = toast.loading("Converting quotation to order...");
        try {
          await convertQuotationToOrder({
            quotationGroupId: paymentTarget.quotationGroupId,
          }).unwrap();
          toast.success("Order automatically generated", { id: orderToastId });
        } catch (orderErr: any) {
          toast.error(
            orderErr?.data?.message || orderErr?.message || "Payment recorded but failed to create order.",
            { id: orderToastId }
          );
        }
      }

      handleCloseAddPayment();
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to record payment", { id: toastId });
    }
  };

  const columns = useMemo<ColumnDef<IReceipt, any>[]>(
    () => [
      {
        id: "lastPaymentDate",
        header: "Last Payment",
        accessorFn: (row) => row.paymentHistory?.[0]?.paymentDate ?? row.createdAt,
        cell: ({ row }) => {
          const r = row.original;
          const last = r.paymentHistory?.[0];
          return (
            <span className="text-slate-500 dark:text-slate-400 text-sm">
              {last ? format(new Date(last.paymentDate), "MMM dd, yyyy") : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "receiptNumber",
        header: "Receipt #",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {r.receiptNumber}
            </span>
          );
        },
      },
      {
        accessorKey: "clientName",
        header: "Client",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {r.clientName}
            </span>
          );
        },
      },
      {
        id: "project",
        header: "Project",
        accessorFn: (row) => row.projectTitle,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {r.projectTitle}
              </span>
              <Badge variant="secondary" className="w-fit text-[9px] font-semibold px-1.5 py-0">
                {getCategoryConfig(r.category).label}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "stage",
        header: "Payment Status",
        accessorFn: (row) => row.paymentStatus,
        cell: ({ row }) => {
          const r = row.original;
          const cfg: Record<string, { label: string; cls: string }> = {
            pending:  { label: "Pending",  cls: "text-slate-500 border-slate-200 bg-slate-50 dark:bg-slate-900/30" },
            partial:  { label: "Partial",  cls: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" },
            paid:     { label: "Paid",     cls: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400" },
            void:     { label: "Void",     cls: "text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 dark:text-red-400" },
          };
          const c = cfg[r.paymentStatus] ?? cfg.pending;
          return (
            <Badge variant="outline" className={`capitalize text-[11px] font-semibold px-2.5 py-0.5 ${c.cls}`}>
              {c.label}
            </Badge>
          );
        },
      },
      {
        id: "quotationTotal",
        header: "Total Amount",
        accessorFn: (row) => resolveQuotationTotal(row),
        cell: ({ row }) => {
          const r = row.original;
          const total = resolveQuotationTotal(r);
          return (
            <span className="font-bold text-slate-500 dark:text-slate-400">
              {formatMoney(total, r.currency)}
            </span>
          );
        },
      },
      {
        id: "totalPaid",
        header: () => <div className="text-right">Paid Amount</div>,
        accessorFn: (row) => row.totalPaid,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="text-right">
              <span className="font-black text-slate-900 dark:text-white">
                {formatMoney(r.totalPaid ?? 0, r.currency)}
              </span>
              {(r.paymentHistory?.length ?? 0) > 0 && (
                <span className="block text-[10px] text-slate-400">
                  {r.paymentHistory.filter(p => p.status === "recorded").length} payment{r.paymentHistory.filter(p => p.status === "recorded").length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const r = row.original;
          const isVoid = r.status === "void";
          return isVoid ? (
            <Badge variant="destructive" className="capitalize text-[11px] font-semibold px-2.5 py-0.5">Void</Badge>
          ) : (
            <Badge variant="outline" className="capitalize text-[11px] font-semibold px-2.5 py-0.5 text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50">
              Issued
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const r = row.original;
          const isVoid = r.status === "void";
          return (
            <div className="flex items-center justify-end gap-1">
              {!isVoid && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8.5 w-8.5 rounded-xl text-slate-400 hover:text-brand-primary dark:hover:text-purple-400"
                  title="Add Payment"
                  onClick={() => handleOpenAddPayment(r)}
                >
                  <Plus className="h-4.5 w-4.5" />
                </Button>
              )}
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-8.5 w-8.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                title="View"
              >
                <Link href={`/receipts/${r._id}`}>
                  <Eye className="h-4.5 w-4.5" />
                </Link>
              </Button>
              <ReceiptPuppeteerPdfBtn
                receiptId={r._id}
                fileNameBase={receiptPdfFileStem(r.receiptNumber)}
                variant="ghost"
                className="h-8.5 w-8.5 p-0 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                iconOnly
              />
              {!isVoid && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8.5 w-8.5 rounded-xl text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                  title="Void receipt"
                  onClick={() => setVoidTarget(r)}
                >
                  <Ban className="h-4.5 w-4.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  const statusOptions = [
    { label: "Issued", value: "issued" },
    { label: "Void", value: "void" },
  ];

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#4E12D4]/10 text-[#4E12D4] ring-1 ring-[#4E12D4]/20 animate-pulse">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
              Payment Receipts
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Track payments received against quotations.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Receipts",
            value: stats.total,
            icon: <Receipt className="h-5 w-5 text-[#4E12D4]" />,
            color: "text-[#4E12D4] bg-[#4E12D4]/10",
          },
          {
            label: "Total Collected",
            value: formatMoney(stats.totalCollected, "৳"),
            icon: <Wallet className="h-5 w-5 text-emerald-600" />,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
          },
          {
            label: "This Month",
            value: formatMoney(stats.thisMonth, "৳"),
            icon: <CalendarClock className="h-5 w-5 text-teal-600" />,
            color: "text-teal-600 bg-teal-50 dark:bg-teal-950/20",
          },
          {
            label: "Voided",
            value: stats.voidCount,
            icon: <Ban className="h-5 w-5 text-amber-600" />,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="rounded-3xl border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 transition-all duration-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}
              >
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <Card className="border-0 bg-transparent shadow-none">
        <div className="pb-5">
          <CardTitle className="text-2xl font-black bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
            Receipt Logs
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Audit-ready log of all customer transaction tokens
          </CardDescription>
        </div>

        <TableContent
          data={receipts}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Search by receipt #, client, or project..."
          statusFilterKey="status"
          statusOptions={statusOptions}
          dateFilterKey="paymentDate"
          actionHeader={
            <Button asChild className="btn-premium">
              <Link href="/receipts/new">
                <Plus className="h-4 w-4" />
                New Receipt
              </Link>
            </Button>
          }
        />
      </Card>

      {/* Add Payment Dialog */}
      <DialogContent
        isOpen={!!paymentTarget}
        onClose={handleCloseAddPayment}
        title="Record Payment"
        description={paymentTarget ? `Record payment receipt for ${paymentTarget.quotationNumber}` : undefined}
        footer={
          <>
            <button
              type="button"
              onClick={handleCloseAddPayment}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPaymentSubmit}
              disabled={isAddingPayment || isConvertingOrder}
              className="rounded-2xl bg-brand-primary text-white text-xs font-bold px-4 py-2 hover:bg-brand-primary/90 flex items-center gap-1.5 cursor-pointer"
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
        <form onSubmit={handleAddPaymentSubmit} className="space-y-4">
          {/* Branded Financial Overview */}
          {summaryData && (() => {
            const grandTotal = summaryData.quotation?.grandTotal || 0;
            const alreadyPaid = summaryData.totalPaid || 0;
            const todayAmt = amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? parseFloat(amount) : 0;
            const remainingAfter = Math.max(0, (summaryData.remaining || 0) - todayAmt);
            const paidPercent = grandTotal > 0 ? Math.min(100, (alreadyPaid / grandTotal) * 100) : 0;
            const todayPercent = grandTotal > 0 ? Math.min(100 - paidPercent, (todayAmt / grandTotal) * 100) : 0;
            const currency = paymentTarget?.currency || "৳";
            return (
              <div className="rounded-2xl overflow-hidden border border-brand-primary/15 dark:border-brand-primary/25 animate-in fade-in duration-200 shadow-sm">
                {/* Gradient header */}
                <div className="bg-gradient-to-br from-[#4E12D4]/8 via-[#C850FA]/5 to-[#4E12D4]/4 dark:from-[#4E12D4]/20 dark:via-[#C850FA]/10 dark:to-[#4E12D4]/15 px-4 pt-3.5 pb-3.5">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Quotation Total</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                      {formatMoney(grandTotal, currency)}
                    </span>
                  </div>
                  {/* Segmented progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-slate-200/60 dark:bg-slate-800/80 overflow-hidden">
                    <div className="h-full flex">
                      <div className="h-full bg-emerald-500 transition-all duration-500 ease-out rounded-l-full" style={{ width: `${paidPercent}%` }} />
                      <div className="h-full bg-brand-accent/70 transition-all duration-500 ease-out" style={{ width: `${todayPercent}%` }} />
                    </div>
                  </div>
                  {/* Legend */}
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
                {/* Two stat cells */}
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
                Amount ({paymentTarget?.currency || "৳"}) <span className="text-red-500">*</span>
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
              checked={autoCreateOrder}
              onChange={setAutoCreateOrder}
              label="Automatically create associated Order in system?"
            />
          </div>
        </form>
      </DialogContent>

      {/* Void confirmation */}
      <AlertDialog open={!!voidTarget} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <AlertDialogContent className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-slate-900 dark:text-white">
              Void this receipt?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              The receipt stays on record for audit purposes, but its amount will
              no longer count toward the paid balance for{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {voidTarget?.projectTitle}
              </span>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 mt-4 mb-5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Reason (optional)
            </label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Entered by mistake, duplicate entry..."
              className="min-h-[80px] rounded-2xl border border-slate-200/80 dark:border-slate-800 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary placeholder:text-slate-400 p-3 text-sm focus:outline-none"
            />
          </div>
          <AlertDialogFooter className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isVoiding} className="rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmVoid();
              }}
              disabled={isVoiding}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 flex items-center gap-1.5"
            >
              {isVoiding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Voiding...
                </>
              ) : (
                "Void Receipt"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
