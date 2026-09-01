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
import { Badge } from "@/components/ui/badge";
import { Eye, Plus, Ban, Receipt as ReceiptIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { getCategoryConfig } from "@/constants/quotation-templates";
import ReceiptPuppeteerPdfBtn, { receiptPdfFileStem } from "@/components/receipt/ReceiptPuppeteerPdfBtn";
import type { IReceipt } from "@/types/receipt.type";
import { usePermissions } from "@/hooks/use-permissions";

function resolveQuotationTotal(r: IReceipt): number {
  if (!r.quotationId) return 0;
  if (typeof r.quotationId === "string") return 0;
  return r.quotationId.totals?.grandTotal ?? 0;
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  pending: { label: "Pending", dot: "bg-slate-400", text: "text-muted-foreground" },
  partial: { label: "Partial", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  paid: { label: "Paid", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  void: { label: "Void", dot: "bg-red-500", text: "text-red-700 dark:text-red-400" },
};

interface ReceiptTableProps {
  receipts: IReceipt[];
  isLoading: boolean;
  onAddPayment: (receipt: IReceipt) => void;
  onVoid: (receipt: IReceipt) => void;
}

export function ReceiptTable({ receipts, isLoading, onAddPayment, onVoid }: ReceiptTableProps) {
  const { can } = usePermissions();
  const canAddPayment = can("receipt.create");
  const canVoid = can("receipt.update");
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
            Receipt #
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Client
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Project
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payment Status
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Total
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Paid
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Last Payment
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
              <TableCell className="pl-6"><Skeleton className="h-3.5 w-[100px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[110px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[130px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[70px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[70px] ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[70px] ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
              <TableCell className="pr-6">
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : receipts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="h-40 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <ReceiptIcon className="h-5 w-5 text-brand-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No receipts found matching your criteria.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          receipts.map((r) => {
            const isVoid = r.status === "void";
            const paymentCfg = PAYMENT_STATUS_CONFIG[r.paymentStatus] ?? PAYMENT_STATUS_CONFIG.pending;
            const total = resolveQuotationTotal(r);
            const recordedCount = r.paymentHistory?.filter((p) => p.status === "recorded").length ?? 0;
            const lastPayment = r.paymentHistory?.[0];

            return (
              <TableRow key={r._id}>
                {/* Receipt # */}
                <TableCell className="pl-6">
                  <span className="font-mono text-sm text-foreground">
                    {r.receiptNumber}
                  </span>
                </TableCell>

                {/* Client */}
                <TableCell>
                  <span className="text-sm text-foreground/80 truncate max-w-[140px] block">
                    {r.clientName}
                  </span>
                </TableCell>

                {/* Project */}
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-foreground truncate max-w-[160px]">
                      {r.projectTitle}
                    </span>
                    <Badge variant="secondary" className="w-fit text-[9px] font-medium px-1.5 py-0">
                      {getCategoryConfig(r.category).label}
                    </Badge>
                  </div>
                </TableCell>

                {/* Payment Status */}
                <TableCell>
                  <span className={cn("inline-flex items-center gap-1.5 text-sm", paymentCfg.text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", paymentCfg.dot)} />
                    {paymentCfg.label}
                  </span>
                </TableCell>

                {/* Total Amount */}
                <TableCell className="text-right">
                  <span className="text-sm text-muted-foreground">
                    {formatMoney(total, r.currency)}
                  </span>
                </TableCell>

                {/* Paid Amount */}
                <TableCell className="text-right">
                  <div>
                    <span className="text-sm text-foreground">
                      {formatMoney(r.totalPaid ?? 0, r.currency)}
                    </span>
                    {recordedCount > 0 && (
                      <span className="block text-[11px] text-muted-foreground">
                        {recordedCount} payment{recordedCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-sm",
                      isVoid ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isVoid ? "bg-red-500" : "bg-emerald-500")} />
                    {isVoid ? "Void" : "Issued"}
                  </span>
                </TableCell>

                {/* Last Payment */}
                <TableCell>
                  <span className="text-muted-foreground text-sm whitespace-nowrap">
                    {lastPayment ? format(new Date(lastPayment.paymentDate), "MMM dd, yyyy") : "—"}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell className="pr-6">
                  <div className="flex items-center justify-end gap-1">
                    {!isVoid && canAddPayment && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Add Payment"
                        onClick={() => onAddPayment(r)}
                        className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View"
                      asChild
                      className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                    >
                      <Link href={`/receipts/${r._id}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <ReceiptPuppeteerPdfBtn
                      receiptId={r._id}
                      fileNameBase={receiptPdfFileStem(r.receiptNumber)}
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                      iconOnly
                    />
                    {!isVoid && canVoid && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Void receipt"
                        onClick={() => onVoid(r)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
