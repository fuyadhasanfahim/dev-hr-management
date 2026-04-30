"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useGetQuotationsQuery,
  useDeleteQuotationMutation,
  useSendQuotationMutation,
} from "@/redux/features/quotation/quotationApi";
import { QuotationTable } from "./components/QuotationTable";
import { QuotationEmailDialog } from "./components/QuotationEmailDialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQuotationStore } from "@/store/useQuotationStore";
import { QuotationData } from "@/types/quotation.type";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Clock,
  FileText,
  Filter,
  Plus,
  ReceiptText,
  Search,
  X,
} from "lucide-react";

/** Resolve the client `_id` even when the API populates `clientId` as an object. */
function resolveClientId(q: QuotationData): string | undefined {
  if (!q.clientId) return undefined;
  if (typeof q.clientId === "string") return q.clientId;
  const populated = q.clientId as unknown as { _id?: string };
  return populated?._id;
}

export default function QuotationsPage() {
  const router = useRouter();
  const [page] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const { data: qData, isLoading } = useGetQuotationsQuery({
    page,
    status: status === "all" ? undefined : status || undefined,
    search: search || undefined,
  });

  const [deleteQuotation] = useDeleteQuotationMutation();
  const [sendQuotation] = useSendQuotationMutation();
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

  const handleConfirmSend = async (selected: string[]) => {
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

  const handleEdit = (quotation: QuotationData) => {
    router.push(`/quotations/${quotation._id}/edit`);
  };

  const stats = [
    {
      label: "Total",
      value: qData?.total || 0,
      icon: <FileText className="h-5 w-5" />,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Latest Drafts",
      value:
        qData?.items.filter((i) => i.status === "draft" && i.isLatestVersion)
          .length || 0,
      icon: <Clock className="h-5 w-5" />,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Active Links",
      value:
        qData?.items.filter((i) => i.status === "sent" && i.isLatestVersion)
          .length || 0,
      icon: <CheckCircle className="h-5 w-5" />,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Project Value",
      value: `৳${(
        qData?.items
          .filter((i) => i.isLatestVersion)
          .reduce((acc, i) => acc + i.totals.grandTotal, 0) || 0
      ).toLocaleString()}`,
      icon: <ReceiptText className="h-5 w-5" />,
      color: "text-teal-600 bg-teal-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
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
            <div className="text-2xl font-black tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Quotation Pipeline</CardTitle>
            <CardDescription>
              Secure, version-controlled quotation-to-order workflow
            </CardDescription>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link
                href="/quotations/new"
                onClick={() => useQuotationStore.getState().reset()}
              >
                <Plus className="h-4 w-4" />
                New Quotation
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, title, or client..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>

              <Select value={status || "all"} onValueChange={setStatus}>
                <SelectTrigger className="bg-background w-[160px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="superseded">Superseded</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                className="bg-background"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                }}
                title="Clear filters"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden bg-card">
            <QuotationTable
              quotations={qData?.items || []}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSend={(id) => {
                const q = qData?.items.find((x) => x._id === id);
                if (q) handleOpenPicker(q);
              }}
              sendingId={sendingId}
            />
          </div>
        </CardContent>
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
