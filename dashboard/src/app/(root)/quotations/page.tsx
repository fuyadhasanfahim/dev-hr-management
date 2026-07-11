"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  useGetQuotationsQuery,
  useDeleteQuotationMutation,
  useSendQuotationMutation,
} from "@/redux/features/quotation/quotationApi";
import { useConvertQuotationToOrderMutation } from "@/redux/features/order/orderApi";
import { QuotationEmailDialog } from "./components/QuotationEmailDialog";
import { toast } from "sonner";
import { useQuotationStore } from "@/store/useQuotationStore";
import { QuotationData, QuotationStatus } from "@/types/quotation.type";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Clock,
  FileText,
  Plus,
  ReceiptText,
  Eye,
  Edit2,
  Trash2,
  Send,
  Loader2,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Role } from "@/constants/role";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TableContent } from "@/components/shared/table-content";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  QuotationStatus,
  { label: string; className: string }
> = {
  draft:            { label: "Draft",            className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800" },
  sent:             { label: "Sent",             className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50" },
  viewed:           { label: "Viewed",           className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50" },
  accepted:         { label: "Accepted",         className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50" },
  rejected:         { label: "Rejected",         className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50" },
  superseded:       { label: "Superseded",       className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50" },
  expired:          { label: "Expired",          className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50" },
  change_requested: { label: "Changes Req.",     className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50" },
};

/** Resolve the client `_id` even when the API populates `clientId` as an object. */
function resolveClientId(q: QuotationData): string | undefined {
  if (!q.clientId) return undefined;
  if (typeof q.clientId === "string") return q.clientId;
  const populated = q.clientId as unknown as { _id?: string };
  return populated?._id;
}

export default function QuotationsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canSeeFinancials = useMemo(() => {
    const r = session?.user?.role;
    return r === Role.SUPER_ADMIN || r === Role.ADMIN || r === Role.HR_MANAGER;
  }, [session]);

  // Query all records for high-fidelity client-side sorting and filtering
  const { data: qData, isLoading, refetch } = useGetQuotationsQuery({
    limit: 1000,
  });

  const [deleteQuotation] = useDeleteQuotationMutation();
  const [sendQuotation] = useSendQuotationMutation();
  const [convertQuotationToOrder] = useConvertQuotationToOrderMutation();
  const [sendingId, setSendingId] = useState<string | null>(null);

  // ── Email recipient picker state ────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuotation, setPickerQuotation] = useState<QuotationData | null>(
    null,
  );

  const pickerClientId = useMemo(
    () => (pickerQuotation ? resolveClientId(pickerQuotation) ?? "" : ""),
    [pickerQuotation],
  );

  const handleOpenPicker = (q: QuotationData) => {
    if (!q._id) return;
    const cid = resolveClientId(q);
    if (!cid) {
      toast.error(
        "This quotation has no linked client — cannot pick recipient emails.",
      );
      return;
    }
    setPickerQuotation(q);
    setPickerOpen(true);
  };

  const handleConfirmSend = async (selected: string[], _includePaymentLink?: boolean) => {
    if (!pickerQuotation?._id) return [];
    if (selected.length === 0) {
      toast.warning("Please select at least one recipient");
      return [];
    }
    if (sendingId) return [];
    try {
      setSendingId(pickerQuotation._id);
      const result = await sendQuotation({
        id: pickerQuotation._id,
        emails: selected,
        includePaymentLink: false,
      }).unwrap();

      if (result.data.clientLink) {
        try {
          await navigator.clipboard.writeText(result.data.clientLink);
          toast.success("Client link copied to clipboard!");
        } catch {
          // Clipboard not always permitted — non-fatal.
        }
      }

      const recipients = result.data.recipients ?? [];
      const failed = recipients.filter((r) => r.status === "failed");
      const sent = recipients.filter((r) => r.status === "sent");

      if (sent.length > 0 && failed.length === 0) {
        toast.success(`Quotation sent to ${sent.length} recipient${sent.length === 1 ? "" : "s"}`);
      } else if (sent.length > 0 && failed.length > 0) {
        toast.warning(
          `Sent to ${sent.length}, failed for ${failed.length}. See dialog for details.`,
        );
      } else if (failed.length > 0) {
        toast.error(
          result.data.emailError ||
            `Failed to send to ${failed.length} recipient${failed.length === 1 ? "" : "s"}`,
        );
      } else {
        toast.warning(
          result.data.emailError ||
            "Email was not sent. Link was generated only.",
        );
      }

      return recipients;
    } catch (err) {
      toast.error((err as Error).message || "Failed to send quotation");
      return [];
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        "Are you sure? This will also delete any associated order and payment logs.",
      )
    ) {
      try {
        await deleteQuotation(id).unwrap();
        toast.success("Quotation and associated records deleted");
      } catch (err) {
        toast.error((err as Error).message || "Failed to delete quotation");
      }
    }
  };

  const handleConvertToOrder = async (groupId: string) => {
    const toastId = toast.loading("Converting quotation to order...");
    try {
      const response = await convertQuotationToOrder({ quotationGroupId: groupId }).unwrap();
      toast.success("Successfully converted to order", { id: toastId });
      refetch(); // refresh listing data to ensure the orderId updates
      // Navigate directly to new order
      if (response.data?._id) {
        router.push(`/orders/${response.data._id}`);
      }
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to convert", { id: toastId });
    }
  };

  const handleEdit = (quotation: QuotationData) => {
    router.push(`/quotations/${quotation._id}/edit`);
  };

  // ── Column Definitions for TableContent ──────────────────────────────────
  const columns = useMemo<ColumnDef<QuotationData, any>[]>(
    () => [
      {
        accessorKey: "quotationNumber",
        header: "Quotation #",
        cell: ({ row }) => {
          const q = row.original;
          const isSuperseded = !q.isLatestVersion || q.status === "superseded";
          return (
            <div className="font-mono font-bold flex items-center gap-2">
              {q.quotationNumber}
              {isSuperseded && (
                <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded px-1">
                  OLD
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "version",
        header: "Ver.",
        cell: ({ row }) => {
          const q = row.original;
          return (
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              v{q.version ?? 1}
            </span>
          );
        },
      },
      {
        id: "clientName",
        header: "Client",
        accessorFn: (row) => (row.clientId as any)?.name || row.client.contactName,
        cell: ({ row }) => {
          const q = row.original;
          return (
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {(q.clientId as any)?.name || q.client.contactName}
            </span>
          );
        },
      },
      {
        accessorKey: "serviceType",
        header: "Service",
        cell: ({ row }) => {
          const q = row.original;
          return (
            <span className="text-slate-600 dark:text-slate-355">
              {q.serviceType === "web-development" ? "Web Design & Dev" : "Photography"}
            </span>
          );
        },
      },
      {
        id: "total",
        header: "Total",
        accessorFn: (row) => row.totals?.grandTotal,
        cell: ({ row }) => {
          const q = row.original;
          return (
            <span className={cn("font-bold text-slate-900 dark:text-slate-100", !canSeeFinancials && "blur-[3px] select-none opacity-60")}>
              {canSeeFinancials ? (
                <>
                  {(q.currency || "৳")}{(q.totals?.grandTotal ?? 0).toLocaleString()}
                </>
              ) : (
                "******"
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const q = row.original;
          const statusKey = (q.status ?? "draft") as QuotationStatus;
          const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.draft;
          return (
            <Badge
              variant="outline"
              className={`${statusCfg.className} capitalize text-[11px] font-semibold px-2.5 py-0.5`}
            >
              {statusCfg.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => {
          const q = row.original;
          return (
            <span className="text-slate-500 dark:text-slate-400 text-sm">
              {format(new Date(q.createdAt ?? new Date()), "MMM dd, yyyy")}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const q = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              {/* Convert to Order */}
              {q.isLatestVersion !== false && !q.orderId && !["superseded", "expired"].includes(q.status || "") && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-7.5 px-3 rounded-xl text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                  onClick={() => q.quotationGroupId && handleConvertToOrder(q.quotationGroupId)}
                >
                  Convert
                </Button>
              )}

              {/* View */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8.5 w-8.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                asChild
              >
                <Link href={`/quotations/${q._id}`}>
                  <Eye className="h-4.5 w-4.5" />
                </Link>
              </Button>

              {/* Send */}
              {q.isLatestVersion !== false && !["superseded", "rejected", "expired"].includes(q.status || "") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8.5 w-8.5 rounded-xl text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                  onClick={() => handleOpenPicker(q)}
                  disabled={sendingId === q._id}
                >
                  {sendingId === q._id ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <Send className="h-4.5 w-4.5" />
                  )}
                </Button>
              )}

              {/* Edit */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8.5 w-8.5 rounded-xl text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                onClick={() => handleEdit(q)}
              >
                <Edit2 className="h-4.5 w-4.5" />
              </Button>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8.5 w-8.5 rounded-xl text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                onClick={() => q._id && handleDelete(q._id)}
              >
                <Trash2 className="h-4.5 w-4.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [canSeeFinancials, sendingId]
  );

  const stats = [
    {
      label: "Total",
      value: qData?.total || 0,
      icon: <FileText className="h-5 w-5 animate-pulse text-[#4E12D4]" />,
      color: "text-[#4E12D4] bg-[#4E12D4]/10",
    },
    {
      label: "Latest Drafts",
      value:
        qData?.items.filter((i) => i.status === "draft" && i.isLatestVersion)
          .length || 0,
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
    },
    {
      label: "Active Links",
      value:
        qData?.items.filter((i) => i.status === "sent" && i.isLatestVersion)
          .length || 0,
      icon: <CheckCircle className="h-5 w-5 text-emerald-500" />,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
    },
    {
      label: "Project Value",
      value: `৳${(
        qData?.items
          .filter((i) => i.isLatestVersion)
          .reduce((acc, i) => acc + i.totals.grandTotal, 0) || 0
      ).toLocaleString()}`,
      icon: <ReceiptText className="h-5 w-5 text-[#C850FA]" />,
      color: "text-[#C850FA] bg-[#C850FA]/10",
    },
  ];

  const statusOptions = [
    { label: "Draft", value: "draft" },
    { label: "Sent", value: "sent" },
    { label: "Viewed", value: "viewed" },
    { label: "Accepted", value: "accepted" },
    { label: "Rejected", value: "rejected" },
    { label: "Superseded", value: "superseded" },
    { label: "Expired", value: "expired" },
    { label: "Changes Requested", value: "change_requested" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
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

      <Card className="border-0 bg-transparent shadow-none">
        <div className="pb-5">
          <CardTitle className="text-2xl font-black bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
            Quotation Pipeline
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Secure, version-controlled quotation-to-order workflow
          </CardDescription>
        </div>

        <TableContent
          data={qData?.items || []}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Search by QTN #, title, or client..."
          statusFilterKey="status"
          statusOptions={statusOptions}
          dateFilterKey="createdAt"
          actionHeader={
            <Button asChild className="btn-premium">
              <Link
                href="/quotations/new"
                onClick={() => useQuotationStore.getState().reset()}
              >
                <Plus className="h-4 w-4" />
                New Quotation
              </Link>
            </Button>
          }
        />
      </Card>

      <QuotationEmailDialog
        open={pickerOpen}
        clientId={pickerClientId}
        quotationLabel={
          pickerQuotation
            ? `${pickerQuotation.quotationNumber ?? "QTN"} • ${
                pickerQuotation.details?.title ?? ""
              }`.trim()
            : undefined
        }
        extraEmails={
          pickerQuotation?.client?.email ? [pickerQuotation.client.email] : []
        }
        onClose={() => {
          if (!sendingId) {
            setPickerOpen(false);
            setPickerQuotation(null);
          }
        }}
        onSend={handleConfirmSend}
        isSending={Boolean(sendingId)}
      />
    </div>
  );
}
