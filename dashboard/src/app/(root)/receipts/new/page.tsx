"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Receipt,
  Wallet,
  CheckCircle2,
  ChevronDown,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatMoney } from "@/lib/money";
import { getCategoryConfig } from "@/constants/quotation-templates";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import { useGetQuotationsQuery } from "@/redux/features/quotation/quotationApi";
import {
  useAddPaymentMutation,
  useGetPaymentSummaryQuery,
} from "@/redux/features/receipt/receiptApi";
import { downloadReceiptPdf, receiptPdfFileStem } from "@/lib/download-receipt-pdf";
import type { ReceiptPaymentType } from "@/types/receipt.type";

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  full: "Full Payment",
  partial: "Partial Payment",
  milestone: "Milestone Payment",
};

function DatePickerInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dateObj = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between text-left font-normal"
        >
          {dateObj ? (
            format(dateObj, "PPP")
          ) : (
            <span className="text-muted-foreground">Pick a date</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateObj}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          defaultMonth={dateObj}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export default function NewReceiptPage() {
  const router = useRouter();

  const [clientId, setClientId] = useState("");
  const [quotationId, setQuotationId] = useState("");

  const [paymentType, setPaymentType] = useState<ReceiptPaymentType>("full");
  const [milestoneLabel, setMilestoneLabel] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");

  const { data: clientsData, isLoading: clientsLoading } = useGetClientsQuery({});
  const { data: quotationsData, isLoading: quotationsLoading } = useGetQuotationsQuery({
    clientId: clientId || undefined,
    isLatestVersion: true,
    limit: 100,
  });
  const [addPayment, { isLoading: isCreating }] = useAddPaymentMutation();

  const selectedQuotation = useMemo(
    () => quotationsData?.items.find((q) => q._id === quotationId),
    [quotationsData, quotationId],
  );
  const quotationGroupId = selectedQuotation?.quotationGroupId || "";

  const { data: summary, isLoading: summaryLoading } = useGetPaymentSummaryQuery(
    quotationGroupId,
    { skip: !quotationGroupId },
  );

  const clientOptions: ComboboxOption[] = useMemo(
    () =>
      (clientsData?.clients || []).map((c) => ({
        value: c._id,
        label: c.name,
        description: c.emails?.[0],
      })),
    [clientsData],
  );

  const quotationOptions: ComboboxOption[] = useMemo(
    () =>
      (quotationsData?.items || []).map((q) => ({
        value: q._id as string,
        label: `${q.quotationNumber} — ${q.details?.title || "Untitled"}`,
        description: `${q.client?.contactName || ""} • ${formatMoney(
          q.totals?.grandTotal || 0,
          q.currency,
        )}`,
      })),
    [quotationsData],
  );

  const isFullyPaid = !!summary && summary.remaining <= 0.009;
  const catConfig = summary ? getCategoryConfig(summary.quotation.category) : null;

  // Keep the "Full remaining amount" prefill in sync once the summary loads —
  // it isn't available yet at the moment a quotation is first selected, since
  // that query resolves asynchronously after paymentType already defaults to "full".
  useEffect(() => {
    if (summary && paymentType === "full") {
      setAmount(Number(summary.remaining.toFixed(2)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.remaining]);

  const handleQuotationChange = (id: string) => {
    setQuotationId(id);
    setPaymentType("full");
    setMilestoneLabel("");
    setAmount("");
  };

  const applyPaymentType = (type: ReceiptPaymentType) => {
    setPaymentType(type);
    if (type === "full" && summary) {
      setAmount(Number(summary.remaining.toFixed(2)));
    } else {
      setAmount("");
    }
    if (type !== "milestone") setMilestoneLabel("");
  };

  const applyMilestone = (label: string, percentage: number) => {
    setPaymentType("milestone");
    setMilestoneLabel(label);
    if (summary) {
      const suggested = (summary.quotation.grandTotal * percentage) / 100;
      setAmount(Number(suggested.toFixed(2)));
    }
  };

  const handleSave = async () => {
    if (!quotationId) return toast.error("Please select a quotation first");
    if (!amount || Number(amount) <= 0) return toast.error("Enter a valid amount");
    if (paymentType === "milestone" && !milestoneLabel.trim()) {
      return toast.error("Enter a stage/milestone label");
    }
    if (summary && Number(amount) > summary.remaining + 0.01) {
      return toast.error(
        `Amount exceeds remaining balance (${formatMoney(summary.remaining, summary.quotation.currency)})`,
      );
    }

    try {
      const receiptId = summary?.receipt?._id;
      if (!receiptId) return toast.error("No receipt ledger found for this quotation. Please contact support.");
      const result = await addPayment({
        receiptId,
        paymentType,
        ...(paymentType === "milestone" ? { milestoneLabel: milestoneLabel.trim() } : {}),
        amount: Number(amount),
        paymentDate,
        ...(method.trim() ? { method: method.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap();
      toast.success("Payment recorded successfully!");

      const pdfToastId = toast.loading("Generating receipt PDF...");
      const downloaded = await downloadReceiptPdf(
        result.receipt._id,
        receiptPdfFileStem(result.receipt.receiptNumber)
      );
      if (downloaded) {
        toast.success("Receipt PDF downloaded", { id: pdfToastId });
      } else {
        toast.dismiss(pdfToastId);
      }

      router.push(`/receipts/${result.receipt._id}`);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to record receipt");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Receipt className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Receipt</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Record a payment received from a client.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Quotation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Client (optional filter)
                  </label>
                  <Combobox
                    options={clientOptions}
                    value={clientId}
                    onChange={(v) => {
                      setClientId(v);
                      setQuotationId("");
                    }}
                    isLoading={clientsLoading}
                    placeholder="All clients"
                    searchPlaceholder="Search clients..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Quotation
                  </label>
                  <Combobox
                    options={quotationOptions}
                    value={quotationId}
                    onChange={handleQuotationChange}
                    isLoading={quotationsLoading}
                    placeholder="Select a quotation"
                    searchPlaceholder="Search by number, title, client..."
                    emptyText="No quotations found."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {quotationGroupId && (
            <>
              {/* Previous receipts — read-only history */}
              {summary && summary.payments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Previous Payments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {summary.payments.map((p) => (
                      <div
                        key={p._id}
                        className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-sm opacity-70 pointer-events-none select-none"
                        aria-disabled="true"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground capitalize">
                            {PAYMENT_TYPE_LABELS[p.paymentType] || p.paymentType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {p.paymentDate
                              ? format(new Date(p.paymentDate), "MMM d, yyyy")
                              : "—"}
                            {p.milestoneLabel ? ` • ${p.milestoneLabel}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {formatMoney(p.amount, summary.quotation.currency)}
                          </span>
                          <Badge
                            variant={p.status === "void" ? "destructive" : "outline"}
                            className="text-[10px]"
                          >
                            {p.status === "void" ? "Void" : "Recorded"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Payment form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isFullyPaid ? (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      This quotation is already fully paid. No further receipts
                      can be recorded.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Payment Type
                          </label>
                          <Select
                            value={paymentType}
                            onValueChange={(v) => applyPaymentType(v as ReceiptPaymentType)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">Full remaining amount</SelectItem>
                              <SelectItem value="partial">Partial payment</SelectItem>
                              <SelectItem value="milestone">Milestone stage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Amount
                          </label>
                          <Input
                            type="number"
                            value={amount}
                            onChange={(e) =>
                              setAmount(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {paymentType === "milestone" && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            Stage / Milestone
                          </label>
                          {summary && summary.quotation.paymentMilestones?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {summary.quotation.paymentMilestones.map((m, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => applyMilestone(m.label, m.percentage)}
                                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                    milestoneLabel === m.label
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "hover:bg-muted"
                                  }`}
                                >
                                  {m.label} ({m.percentage}%)
                                </button>
                              ))}
                            </div>
                          )}
                          <Input
                            value={milestoneLabel}
                            onChange={(e) => setMilestoneLabel(e.target.value)}
                            placeholder="e.g. Upfront on acceptance"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Payment Date
                          </label>
                          <DatePickerInput value={paymentDate} onChange={setPaymentDate} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Method (optional)
                          </label>
                          <Input
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            placeholder="e.g. Bank transfer, bKash..."
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Note (optional)
                        </label>
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Internal note about this payment..."
                          className="min-h-[70px]"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Sidebar — payment summary */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3 text-sm">
              {!quotationGroupId ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Select a quotation to see its balance.
                </p>
              ) : summaryLoading || !summary ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Project</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{summary.quotation.title}</span>
                      {catConfig && <Badge variant="secondary">{catConfig.label}</Badge>}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Grand Total</span>
                    <span className="font-semibold">
                      {formatMoney(summary.quotation.grandTotal, summary.quotation.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Already Paid</span>
                    <span className="font-semibold text-emerald-600">
                      {formatMoney(summary.totalPaid, summary.quotation.currency)}
                    </span>
                  </div>

                  <div
                    className={`rounded-xl border p-4 ${
                      isFullyPaid
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-primary/20 bg-primary/5"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      {isFullyPaid ? "Status" : "Remaining Balance"}
                    </span>
                    <div
                      className={`text-2xl font-black tracking-tight mt-1 ${
                        isFullyPaid ? "text-emerald-600" : "text-primary"
                      }`}
                    >
                      {isFullyPaid
                        ? "Paid in Full"
                        : formatMoney(summary.remaining, summary.quotation.currency)}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            <div className="px-6 pb-6">
              <Button
                onClick={handleSave}
                disabled={isCreating || !quotationGroupId || isFullyPaid}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Receipt
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
