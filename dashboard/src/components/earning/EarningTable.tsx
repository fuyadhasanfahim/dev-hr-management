import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Eye, Receipt, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { IEarning, EarningStatus } from "@/types/earning.type";
import { MONTHS } from "@/types/earning.type";

const STATUS_CONFIG: Record<EarningStatus, { label: string; dot: string; text: string }> = {
  partial: {
    label: "Partial",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  paid: {
    label: "Paid",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  void: {
    label: "Void",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
};

interface EarningTableProps {
  earnings: IEarning[];
  isLoading: boolean;
  onReceipt: (earning: IEarning) => void;
}

export function EarningTable({ earnings, isLoading, onReceipt }: EarningTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
            Order
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Client
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Total
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Paid
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
            Status
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Period
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="border-b border-border/60">
              <TableCell className="pl-6"><Skeleton className="h-3.5 w-[130px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[110px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[70px] ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[70px] ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[70px] mx-auto" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
              <TableCell className="pr-6">
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : earnings.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="h-40 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-brand-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No earnings found matching your criteria.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          earnings.map((e) => {
            const cfg = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.partial;
            const pct = e.totalAmount > 0 ? Math.min(100, Math.round((e.paidAmount / e.totalAmount) * 100)) : 0;
            const monthLabel = MONTHS.find((m) => m.value === e.month)?.label || e.month;

            return (
              <TableRow key={e._id}>
                {/* Order: quotation # first, order title underneath */}
                <TableCell className="pl-6">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-foreground truncate max-w-[160px]">
                      {e.quotationNumber}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                      {e.orderTitle}
                    </span>
                  </div>
                </TableCell>

                {/* Client */}
                <TableCell>
                  <span className="text-sm text-foreground/80 truncate max-w-[140px] block">
                    {e.clientId?.name || "N/A"}
                  </span>
                </TableCell>

                {/* Total */}
                <TableCell className="text-right">
                  <span className="text-sm text-muted-foreground">
                    {formatMoney(e.totalAmount, e.currency)}
                  </span>
                </TableCell>

                {/* Paid */}
                <TableCell>
                  <div className="w-full max-w-[130px] ml-auto space-y-1">
                    <div className="text-right text-sm text-foreground">
                      {formatMoney(e.paidAmount, e.currency)}
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct >= 100 ? "bg-emerald-500" : "bg-brand-primary",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <div className="flex justify-center">
                    <span className={cn("inline-flex items-center gap-1.5 text-sm", cfg.text)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
                      {cfg.label}
                    </span>
                  </div>
                </TableCell>

                {/* Period */}
                <TableCell>
                  <span className="text-muted-foreground text-sm whitespace-nowrap">
                    {monthLabel} {e.year}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell className="pr-6">
                  <div className="flex justify-end gap-1">
                    {e.status !== "void" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Record a payment"
                        onClick={() => onReceipt(e)}
                        className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View Receipt"
                      asChild
                      className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                    >
                      <Link href={`/receipts/${e.receiptId?._id}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
