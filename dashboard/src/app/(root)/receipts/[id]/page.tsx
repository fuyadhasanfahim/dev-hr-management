"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Receipt,
  Wallet,
  Mail,
  Ban,
  Loader2,
  FileText,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
import { formatMoney } from "@/lib/money";
import { getCategoryConfig } from "@/constants/quotation-templates";
import {
  useGetReceiptByIdQuery,
  useGetPaymentSummaryQuery,
  useSendReceiptMutation,
  useVoidReceiptMutation,
  useVoidPaymentMutation,
} from "@/redux/features/receipt/receiptApi";
import ReceiptPuppeteerPdfBtn, {
  receiptPdfFileStem,
} from "@/components/receipt/ReceiptPuppeteerPdfBtn";
import { ReceiptEmailDialog } from "@/components/receipt/ReceiptEmailDialog";

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  full: "Full Payment",
  partial: "Partial Payment",
  milestone: "Milestone Payment",
};

export default function ReceiptDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: receipt, isLoading } = useGetReceiptByIdQuery(id, { skip: !id });
  const { data: summary } = useGetPaymentSummaryQuery(receipt?.quotationGroupId || "", {
    skip: !receipt?.quotationGroupId,
  });

  const [sendReceipt, { isLoading: isSending }] = useSendReceiptMutation();
  const [voidReceipt, { isLoading: isVoiding }] = useVoidReceiptMutation();

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const [voidPaymentTarget, setVoidPaymentTarget] = useState<string | null>(null);
  const [voidPaymentReason, setVoidPaymentReason] = useState("");
  const [voidPayment, { isLoading: isVoidingPayment }] = useVoidPaymentMutation();

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading receipt...
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Receipt not found or has been removed.</p>
        <Button onClick={() => router.push("/receipts")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Receipts
        </Button>
      </div>
    );
  }

  const isVoid = receipt.status === "void";
  const catConfig = getCategoryConfig(receipt.category);
  const money = (n: number) => formatMoney(n, receipt.currency);

  const grandTotal = summary?.quotation.grandTotal ?? 0;
  const totalPaid = receipt.totalPaid ?? 0;
  const remaining = Math.max(0, grandTotal - totalPaid);
  const isFullyPaid = remaining <= 0.009;
  const progressPct = grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0;

  const handleSend = async (selectedEmails: string[]) => {
    try {
      const result = await sendReceipt({ id: receipt._id, emails: selectedEmails }).unwrap();
      const recipients = result.data.recipients ?? [];
      const sent = recipients.filter((r) => r.status === "sent");
      const failed = recipients.filter((r) => r.status === "failed");
      if (sent.length > 0 && failed.length === 0) {
        toast.success(`Receipt sent to ${sent.length} recipient${sent.length === 1 ? "" : "s"}`);
      } else if (sent.length > 0) {
        toast.warning(`Sent to ${sent.length}, failed for ${failed.length}.`);
      } else {
        toast.error("Failed to send receipt email");
      }
      return recipients;
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to send receipt");
      return [];
    }
  };

  const handleVoid = async () => {
    try {
      await voidReceipt({ id: receipt._id, reason: voidReason || undefined }).unwrap();
      toast.success("Receipt voided");
      setVoidDialogOpen(false);
      setVoidReason("");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to void receipt");
    }
  };

  const handleVoidPayment = async () => {
    if (!voidPaymentTarget) return;
    try {
      await voidPayment({
        receiptId: receipt._id,
        paymentId: voidPaymentTarget,
        reason: voidPaymentReason || undefined,
      }).unwrap();
      toast.success("Payment entry voided");
      setVoidPaymentTarget(null);
      setVoidPaymentReason("");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to void payment");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full shadow-sm"
            onClick={() => router.push("/receipts")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {receipt.receiptNumber}
              </h1>
              <Badge variant="secondary">{catConfig.label}</Badge>
              {isVoid ? (
                <Badge variant="destructive">Void</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-emerald-700 border-emerald-200 bg-emerald-50"
                >
                  Issued
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Payment receipt for {receipt.projectTitle}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReceiptPuppeteerPdfBtn
            receiptId={receipt._id}
            fileNameBase={receiptPdfFileStem(receipt.receiptNumber)}
            variant="outline"
          />
          {!isVoid && (
            <>
              <Button onClick={() => setEmailDialogOpen(true)} disabled={isSending}>
                <Mail className="h-4 w-4" />
                Send to Client
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setVoidDialogOpen(true)}
              >
                <Ban className="h-4 w-4" />
                Void
              </Button>
            </>
          )}
        </div>
      </div>

      {isVoid && receipt.voidReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span className="font-semibold">Voided:</span> {receipt.voidReason}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Receipt Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-bold text-muted-foreground">
                    Project
                  </span>
                  <p className="font-medium">{receipt.projectTitle}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-bold text-muted-foreground">
                    Quotation
                  </span>
                  <p className="font-medium">{receipt.quotationNumber}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-bold text-muted-foreground">
                    Client
                  </span>
                  <p className="font-medium">{receipt.clientName}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-bold text-muted-foreground">
                    Payment Status
                  </span>
                  <p className="font-medium capitalize">{receipt.paymentStatus || "pending"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Created At
                  </span>
                  <p className="font-medium">
                    {receipt.createdAt
                      ? format(new Date(receipt.createdAt), "PPP")
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {receipt.paymentHistory && receipt.paymentHistory.length > 0 && (
            <Card>
              <CardHeader className="border-b bg-muted/10">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Payment History / Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs uppercase font-semibold">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Method</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">Status</th>
                        {!isVoid && <th className="py-2 px-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {receipt.paymentHistory.map((p) => {
                        const isPaymentVoid = p.status === "void";
                        return (
                          <tr key={p._id} className="hover:bg-muted/5 transition-colors">
                            <td className="py-3 px-3">
                              {p.paymentDate ? format(new Date(p.paymentDate), "MMM dd, yyyy") : "—"}
                            </td>
                            <td className="py-3 px-3 font-medium">
                              {PAYMENT_TYPE_LABELS[p.paymentType] || p.paymentType}
                              {p.milestoneLabel ? ` (${p.milestoneLabel})` : ""}
                            </td>
                            <td className="py-3 px-3 capitalize">{p.method || "—"}</td>
                            <td className={`py-3 px-3 text-right font-semibold ${isPaymentVoid ? "line-through text-muted-foreground" : "text-slate-900 dark:text-white"}`}>
                              {money(p.amount)}
                            </td>
                            <td className="py-3 px-3">
                              {isPaymentVoid ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Void</Badge>
                              ) : (
                                <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-[10px] px-1.5 py-0">Active</Badge>
                              )}
                              {isPaymentVoid && p.voidReason && (
                                <span className="block text-[10px] text-red-500 mt-0.5 max-w-[150px] truncate" title={p.voidReason}>
                                  Reason: {p.voidReason}
                                </span>
                              )}
                            </td>
                            {!isVoid && (
                              <td className="py-3 px-3 text-right">
                                {!isPaymentVoid && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                    onClick={() => setVoidPaymentTarget(p._id)}
                                  >
                                    <Ban className="h-3 w-3 mr-1" />
                                    Void
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — financial breakdown */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Financial Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Contract Value</span>
                <span className="font-semibold">{money(grandTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Collected</span>
                <span className="font-bold text-emerald-600">
                  {money(totalPaid)}
                </span>
              </div>

              <Separator />

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {progressPct.toFixed(0)}% collected
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  isFullyPaid ? "border-emerald-200 bg-emerald-50" : "border-primary/20 bg-primary/5"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {isFullyPaid ? "Status" : "Remaining Balance"}
                </span>
                <div
                  className={`text-3xl font-black tracking-tight mt-1 ${
                    isFullyPaid ? "text-emerald-600" : "text-primary"
                  }`}
                >
                  {isFullyPaid ? "Paid in Full" : money(remaining)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ReceiptEmailDialog
        open={emailDialogOpen}
        clientId={receipt.clientId}
        receiptLabel={`${receipt.receiptNumber} • ${receipt.projectTitle}`}
        onClose={() => !isSending && setEmailDialogOpen(false)}
        onSend={handleSend}
        isSending={isSending}
      />

      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              The receipt stays on record for audit purposes, but its amount will
              no longer count toward the paid balance for{" "}
              <span className="font-medium text-foreground">{receipt.projectTitle}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Reason (optional)
            </label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Entered by mistake, duplicate entry..."
              className="min-h-[70px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleVoid();
              }}
              disabled={isVoiding}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isVoiding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Voiding...
                </>
              ) : (
                "Void Receipt"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!voidPaymentTarget} onOpenChange={(open) => !open && setVoidPaymentTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this payment transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This specific payment transaction will be marked as voided. The receipt ledger's paid balance will automatically be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Reason (optional)
            </label>
            <Textarea
              value={voidPaymentReason}
              onChange={(e) => setVoidPaymentReason(e.target.value)}
              placeholder="e.g. Incorrect amount, bounced payment..."
              className="min-h-[70px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoidingPayment}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleVoidPayment();
              }}
              disabled={isVoidingPayment}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isVoidingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Voiding...
                </>
              ) : (
                "Void Payment"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
