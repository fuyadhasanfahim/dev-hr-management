"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Plus, Loader, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  useGetReceiptsQuery,
  useVoidReceiptMutation,
} from "@/redux/features/receipt/receiptApi";
import type { IReceipt } from "@/types/receipt.type";
import { AddPaymentDialog } from "@/components/receipt/AddPaymentDialog";
import { usePermissions } from "@/hooks/use-permissions";
import { ReceiptFilters } from "@/components/receipt/ReceiptFilters";
import { ReceiptTable } from "@/components/receipt/ReceiptTable";
import { ReceiptPagination } from "@/components/receipt/ReceiptPagination";

const STATUS_OPTIONS = [
  { label: "Issued", value: "issued" },
  { label: "Void", value: "void" },
];

export default function ReceiptsPage() {
  const { data: qData, isLoading, refetch } = useGetReceiptsQuery({
    limit: 1000,
  });
  const { can } = usePermissions();
  const [voidReceipt, { isLoading: isVoiding }] = useVoidReceiptMutation();
  const [voidTarget, setVoidTarget] = useState<IReceipt | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // ── Add Payment dialog target ────────────────────────────────────────────
  const [paymentTarget, setPaymentTarget] = useState<IReceipt | null>(null);

  // ── Filters + pagination state ───────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const receipts = useMemo(() => qData?.items || [], [qData]);

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

  const receiptStats = useMemo(
    () => [
      {
        description: "Total Receipts",
        value: stats.total,
        trend: "up" as const,
        trendLabel: "All",
        footerTitle: "All receipt logs",
        isMoney: false,
      },
      {
        description: "Total Collected",
        value: formatMoney(stats.totalCollected, "৳"),
        trend: "up" as const,
        trendLabel: "Paid",
        footerTitle: "Successfully collected",
        isMoney: true,
      },
      {
        description: "This Month",
        value: formatMoney(stats.thisMonth, "৳"),
        trend: "up" as const,
        trendLabel: "Recent",
        footerTitle: "Collected this month",
        isMoney: true,
      },
      {
        description: "Voided",
        value: stats.voidCount,
        trend: "down" as const,
        trendLabel: "Void",
        footerTitle: "Voided receipts",
        isMoney: false,
      },
    ],
    [stats],
  );

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (status && r.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${r.receiptNumber || ""} ${r.clientName || ""} ${r.projectTitle || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [receipts, status, search]);

  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / limit));
  const pagedReceipts = useMemo(
    () => filteredReceipts.slice((page - 1) * limit, page * limit),
    [filteredReceipts, page, limit],
  );

  const handleFilterChange = (key: string, value: string) => {
    if (key === "search") setSearch(value);
    if (key === "status") setStatus(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setPage(1);
  };

  const confirmVoid = async () => {
    if (!voidTarget) return;
    try {
      await voidReceipt({ id: voidTarget._id, reason: voidReason || undefined }).unwrap();
      toast.success("Receipt voided");
      setVoidTarget(null);
      setVoidReason("");
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      toast.error(e?.data?.message || "Failed to void receipt");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full min-h-screen pb-10"
    >
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Payment Receipts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            Track payments received against quotations
            {isLoading && (
              <Loader className="h-3 w-3 animate-spin text-primary" />
            )}
          </p>
        </div>
        {can("receipt.create") && (
          <Button size="sm" className="h-8" asChild>
            <Link href="/receipts/new">
              <Plus className="h-3.5 w-3.5" />
              New Receipt
            </Link>
          </Button>
        )}
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────── */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        {receiptStats.map((stat) => {
          const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
          return (
            <Card key={stat.description} className="@container/card">
              <CardHeader>
                <CardDescription>{stat.description}</CardDescription>
                <CardTitle
                  className={cn(
                    "font-semibold tabular-nums whitespace-nowrap",
                    stat.isMoney
                      ? "text-lg @[250px]/card:text-xl"
                      : "text-2xl @[250px]/card:text-3xl",
                  )}
                >
                  {stat.value}
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="text-primary border-primary/30">
                    <TrendIcon className="text-primary" />
                    {stat.trendLabel}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">
                  {stat.footerTitle}
                  <TrendIcon className="size-4 text-primary" />
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* ── Filters Card ─────────────────────────────────────────── */}
      <Card className="mt-5 py-0 shadow-sm">
        <div className="px-5 py-4">
          <ReceiptFilters
            search={search}
            status={status}
            statusOptions={STATUS_OPTIONS}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        </div>
      </Card>

      {/* ── Table Card ───────────────────────────────────────────── */}
      <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <ReceiptTable
            receipts={pagedReceipts}
            isLoading={isLoading}
            onAddPayment={(r) => setPaymentTarget(r)}
            onVoid={(r) => setVoidTarget(r)}
          />
        </div>

        <Separator />

        {/* Footer: Count + Pagination */}
        <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
          <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            Showing{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {pagedReceipts.length}
            </span>{' '}
            of{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {filteredReceipts.length}
            </span>{' '}
            receipts
          </p>
          <ReceiptPagination
            currentPage={page}
            totalPages={totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      <AddPaymentDialog
        quotationGroupId={paymentTarget?.quotationGroupId ?? null}
        quotationNumber={paymentTarget?.quotationNumber}
        onClose={() => setPaymentTarget(null)}
        onRecorded={refetch}
      />

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
          <div className="space-y-1.5 mt-2 mb-2">
            <label className="text-xs font-medium text-muted-foreground">
              Reason (optional)
            </label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Entered by mistake, duplicate entry..."
              className="min-h-[80px]"
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
    </motion.div>
  );
}
