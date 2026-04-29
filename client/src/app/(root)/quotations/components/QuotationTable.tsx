"use client";

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
import { Eye, Edit2, FileText, Trash2, Send, Loader2, GitBranch } from "lucide-react";
import Link from "next/link";
import { QuotationData, QuotationStatus } from "@/types/quotation.type";
import { format } from "date-fns";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  QuotationStatus,
  { label: string; className: string }
> = {
  draft:            { label: "Draft",            className: "bg-slate-100 text-slate-700 border-slate-200" },
  sent:             { label: "Sent",             className: "bg-blue-50 text-blue-700 border-blue-200" },
  accepted:         { label: "Accepted",         className: "bg-teal-50 text-teal-700 border-teal-200" },
  rejected:         { label: "Rejected",         className: "bg-red-50 text-red-700 border-red-200" },
  superseded:       { label: "Superseded",       className: "bg-amber-50 text-amber-700 border-amber-200" },
  expired:          { label: "Expired",          className: "bg-orange-50 text-orange-700 border-orange-200" },
  change_requested: { label: "Changes Req.",     className: "bg-purple-50 text-purple-700 border-purple-200" },
};

const SKELETON_COLS = 7;

interface QuotationTableProps {
  quotations: QuotationData[];
  isLoading: boolean;
  onEdit: (quotation: QuotationData) => void;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  sendingId?: string | null;
}

export function QuotationTable({
  quotations,
  isLoading,
  onEdit,
  onDelete,
  onSend,
  sendingId,
}: QuotationTableProps) {
  // ── Loading skeleton ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="overflow-x-auto w-full">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Quotation #</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {[...Array(SKELETON_COLS)].map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
                <TableCell>
                  <Skeleton className="h-8 w-16 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (quotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="p-4 bg-slate-50 rounded-full text-slate-400">
          <FileText className="w-8 h-8" />
        </div>
        <p className="text-base font-medium text-slate-900">No quotations yet</p>
        <p className="text-sm text-slate-500">Create your first quotation to get started.</p>
      </div>
    );
  }

  // ── Table ──────────────────────────────────────────────────────────────
  return (
    <div className="overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-medium text-slate-500">Quotation #</TableHead>
            <TableHead className="font-medium text-slate-500">Ver.</TableHead>
            <TableHead className="font-medium text-slate-500">Client</TableHead>
            <TableHead className="font-medium text-slate-500">Service</TableHead>
            <TableHead className="font-medium text-slate-500">Total</TableHead>
            <TableHead className="font-medium text-slate-500 text-center">Status</TableHead>
            <TableHead className="font-medium text-slate-500">Date</TableHead>
            <TableHead className="font-medium text-slate-500 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotations.map((q) => {
            const statusKey = (q.status ?? "draft") as QuotationStatus;
            const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.draft;
            const isSuperseded = !q.isLatestVersion || q.status === "superseded";

            return (
              <TableRow
                key={q._id}
                className={`transition-colors ${isSuperseded ? "opacity-50 hover:bg-slate-50/50" : "hover:bg-slate-50/80"}`}
              >
                {/* Quotation # */}
                <TableCell className="font-mono text-slate-900 font-medium">
                  <div className="flex items-center gap-2">
                    {q.quotationNumber}
                    {isSuperseded && (
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-50 border border-amber-200 rounded px-1">
                        OLD
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Version */}
                <TableCell>
                  <div className="flex items-center gap-1 text-slate-500">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span className="text-sm font-medium">v{q.version ?? 1}</span>
                  </div>
                </TableCell>

                {/* Client */}
                <TableCell className="text-slate-900 font-medium">
                  {(q.clientId as unknown as { name: string })?.name ||
                    q.client.contactName}
                </TableCell>

                {/* Service */}
                <TableCell className="text-slate-600">
                  {q.serviceType === "web-development"
                    ? "Web Design & Dev"
                    : "Photography"}
                </TableCell>

                {/* Total */}
                <TableCell className="font-bold text-slate-900">
                  {q.settings.currency}
                  {q.totals.grandTotal.toLocaleString()}
                </TableCell>

                {/* Status badge */}
                <TableCell className="text-center">
                  <Badge
                    variant="outline"
                    className={`${statusCfg.className} capitalize text-[11px] font-semibold px-2.5 py-0.5`}
                  >
                    {statusCfg.label}
                  </Badge>
                </TableCell>

                {/* Date */}
                <TableCell className="text-slate-500 text-sm">
                  {format(new Date(q.createdAt ?? new Date()), "MMM dd, yyyy")}
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* View */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-slate-900"
                      asChild
                    >
                      <Link href={`/quotations/${q._id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>

                    {/* Send (only for draft / change_requested on latest version) */}
                    {q.isLatestVersion !== false &&
                      (q.status === "draft" || q.status === "change_requested") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600"
                          onClick={() => q._id && onSend(q._id)}
                          disabled={sendingId === q._id}
                          title="Send to Client"
                        >
                          {sendingId === q._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-teal-600"
                      onClick={() => onEdit(q)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-500"
                      onClick={() => q._id && onDelete(q._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
