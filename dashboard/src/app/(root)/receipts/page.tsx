"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Search,
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
} from "@/redux/features/receipt/receiptApi";
import type { IReceipt } from "@/types/receipt.type";
import ReceiptPuppeteerPdfBtn, {
  receiptPdfFileStem,
} from "@/components/receipt/ReceiptPuppeteerPdfBtn";

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  full: "Full Payment",
  partial: "Partial Payment",
  milestone: "Milestone",
};

export default function ReceiptsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching } = useGetReceiptsQuery({
    page: 1,
    limit: 100,
    search: search || undefined,
  });
  const [voidReceipt, { isLoading: isVoiding }] = useVoidReceiptMutation();

  const [voidTarget, setVoidTarget] = useState<IReceipt | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const receipts = data?.items || [];

  const stats = useMemo(() => {
    const issued = receipts.filter((r) => r.status === "issued");
    const totalCollected = issued.reduce((sum, r) => sum + r.amount, 0);
    const now = new Date();
    const thisMonth = issued
      .filter((r) => {
        const d = new Date(r.paymentDate);
        return (
          d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, r) => sum + r.amount, 0);
    const voidCount = receipts.filter((r) => r.status === "void").length;
    return {
      total: data?.total ?? receipts.length,
      totalCollected,
      thisMonth,
      voidCount,
    };
  }, [receipts, data?.total]);

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

  return (
    <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Payment Receipts
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track payments received against quotations.
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/receipts/new">
            <Plus className="h-4 w-4" />
            New Receipt
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Receipts",
            value: stats.total,
            icon: <Receipt className="h-5 w-5" />,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Total Collected",
            value: formatMoney(stats.totalCollected, "৳"),
            icon: <Wallet className="h-5 w-5" />,
            color: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "This Month",
            value: formatMoney(stats.thisMonth, "৳"),
            icon: <CalendarClock className="h-5 w-5" />,
            color: "text-teal-600 bg-teal-50",
          },
          {
            label: "Voided",
            value: stats.voidCount,
            icon: <Ban className="h-5 w-5" />,
            color: "text-amber-600 bg-amber-50",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="rounded-2xl border bg-card p-5 transition-all duration-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}
              >
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-black tracking-tight">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by receipt #, client, or project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading || isFetching ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading receipts...
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {search
              ? "No receipts match your search."
              : "No receipts yet. Record your first payment."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => {
                const isVoid = receipt.status === "void";
                return (
                  <TableRow key={receipt._id} className={isVoid ? "opacity-60" : ""}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {receipt.paymentDate
                        ? format(new Date(receipt.paymentDate), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {receipt.receiptNumber}
                    </TableCell>
                    <TableCell>{receipt.clientName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {receipt.projectTitle}
                        </span>
                        <Badge variant="secondary" className="w-fit text-[10px] font-medium">
                          {getCategoryConfig(receipt.category).label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {PAYMENT_TYPE_LABELS[receipt.paymentType] || receipt.paymentType}
                      </span>
                      {receipt.milestoneLabel && (
                        <span className="block text-xs text-muted-foreground">
                          {receipt.milestoneLabel}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(receipt.amount, receipt.currency)}
                    </TableCell>
                    <TableCell>
                      {isVoid ? (
                        <Badge variant="destructive">Void</Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
                          Issued
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="View"
                        >
                          <Link href={`/receipts/${receipt._id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <ReceiptPuppeteerPdfBtn
                          receiptId={receipt._id}
                          fileNameBase={receiptPdfFileStem(receipt.receiptNumber)}
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          iconOnly
                        />
                        {!isVoid && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Void receipt"
                            onClick={() => setVoidTarget(receipt)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Void confirmation */}
      <AlertDialog open={!!voidTarget} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              The receipt stays on record for audit purposes, but its amount will
              no longer count toward the paid balance for{" "}
              <span className="font-medium text-foreground">
                {voidTarget?.projectTitle}
              </span>
              .
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
                confirmVoid();
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
    </div>
  );
}
