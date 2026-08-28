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
import { Eye, Edit2, Trash2, Send, Loader2, Receipt, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { QuotationData, QuotationStatus } from "@/types/quotation.type";

const STATUS_CONFIG: Record<QuotationStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800" },
  sent: { label: "Sent", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50" },
  viewed: { label: "Viewed", className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50" },
  accepted: { label: "Accepted", className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50" },
  superseded: { label: "Superseded", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50" },
  expired: { label: "Expired", className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50" },
  change_requested: { label: "Changes Req.", className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50" },
};

interface QuotationTableProps {
  quotations: QuotationData[];
  isLoading: boolean;
  canSeeFinancials: boolean;
  sendingId: string | null;
  onView: (q: QuotationData) => void;
  onEdit: (q: QuotationData) => void;
  onDelete: (id: string) => void;
  onSend: (q: QuotationData) => void;
  onConvert: (groupId: string) => void;
  onReceipt: (q: QuotationData) => void;
}

export function QuotationTable({
  quotations,
  isLoading,
  canSeeFinancials,
  sendingId,
  onView,
  onEdit,
  onDelete,
  onSend,
  onConvert,
  onReceipt,
}: QuotationTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
            Quotation #
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ver.
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Client
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Service
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Total
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Date
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
              <TableCell><Skeleton className="h-3.5 w-[30px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[110px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[130px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[70px] ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[80px]" /></TableCell>
              <TableCell className="pr-6">
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : quotations.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="h-40 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-brand-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No quotations found matching your criteria.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          quotations.map((q) => {
            const isSuperseded = !q.isLatestVersion || q.status === "superseded";
            // Legacy quotations created before the normalized service model have no
            // `services` entries — they can never be converted to an order, so hide the action.
            const hasServices = Array.isArray(q.services) && q.services.length > 0;
            const statusKey = (q.status ?? "draft") as QuotationStatus;
            const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.draft;
            const clientName = (q.clientId as unknown as { name?: string })?.name || q.client.contactName;

            return (
              <TableRow key={q._id} className="cursor-pointer" onClick={() => onView(q)}>
                {/* Quotation # */}
                <TableCell className="pl-6">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {q.quotationNumber}
                    </span>
                    {isSuperseded && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 font-bold text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
                        OLD
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Version */}
                <TableCell>
                  <span className="text-sm text-muted-foreground font-medium">
                    v{q.version ?? 1}
                  </span>
                </TableCell>

                {/* Client */}
                <TableCell>
                  <span className="text-sm font-medium text-foreground truncate max-w-[150px] block">
                    {clientName}
                  </span>
                </TableCell>

                {/* Service */}
                <TableCell>
                  <span className="text-sm text-foreground/80">
                    {q.serviceType === "web-development" ? "Web Design & Dev" : "Photography"}
                  </span>
                </TableCell>

                {/* Total */}
                <TableCell className="text-right">
                  <span className={cn("font-semibold text-sm", !canSeeFinancials && "blur-[4px] select-none pointer-events-none")}>
                    {q.currency || "৳"}{(q.totals?.grandTotal ?? 0).toLocaleString()}
                  </span>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge variant="outline" className={cn("capitalize text-[11px] font-medium px-2 py-0.5 rounded-md", statusCfg.className)}>
                    {statusCfg.label}
                  </Badge>
                </TableCell>

                {/* Date */}
                <TableCell>
                  <span className="text-muted-foreground text-[12px] whitespace-nowrap">
                    {format(new Date(q.createdAt ?? new Date()), "MMM dd, yyyy")}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {q.isLatestVersion !== false && !q.orderId && hasServices && !["superseded", "expired"].includes(q.status || "") && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => q.quotationGroupId && onConvert(q.quotationGroupId)}
                      >
                        Convert
                      </Button>
                    )}

                    {q.isLatestVersion !== false && !["superseded", "expired"].includes(q.status || "") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Record a payment"
                        className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                        onClick={() => onReceipt(q)}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      title="View"
                      className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                      asChild
                    >
                      <Link href={`/quotations/${q._id}`}>
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </Button>

                    {q.isLatestVersion !== false && !["superseded", "rejected", "expired"].includes(q.status || "") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Send"
                        className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                        onClick={() => onSend(q)}
                        disabled={sendingId === q._id}
                      >
                        {sendingId === q._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      className="h-7 w-7 text-muted-foreground hover:text-brand-accent hover:bg-brand-accent/10"
                      onClick={() => onEdit(q)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => q._id && onDelete(q._id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
