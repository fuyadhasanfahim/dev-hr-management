"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  useGetQuotationsQuery,
  useDeleteQuotationMutation,
  useSendQuotationMutation,
} from "@/redux/features/quotation/quotationApi";
import { useConvertQuotationToOrderMutation } from "@/redux/features/order/orderApi";
import { QuotationEmailDialog } from "./components/QuotationEmailDialog";
import { AddPaymentDialog } from "@/components/receipt/AddPaymentDialog";
import { toast } from "sonner";
import { useQuotationStore } from "@/store/useQuotationStore";
import { QuotationData } from "@/types/quotation.type";
import { useRouter } from "next/navigation";
import { Loader, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Role } from "@/constants/role";
import {
  Card as StatCard,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { QuotationFilters } from "@/components/quotation/QuotationFilters";
import { QuotationTable } from "@/components/quotation/QuotationTable";
import { QuotationPagination } from "@/components/quotation/QuotationPagination";

/** Resolve the client `_id`/name even when the API populates `clientId` as an object. */
function resolveClientId(q: QuotationData): string | undefined {
  if (!q.clientId) return undefined;
  if (typeof q.clientId === "string") return q.clientId;
  const populated = q.clientId as unknown as { _id?: string };
  return populated?._id;
}

const STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Viewed", value: "viewed" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
  { label: "Superseded", value: "superseded" },
  { label: "Expired", value: "expired" },
  { label: "Changes Requested", value: "change_requested" },
];

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

  // ── Create Receipt dialog state ─────────────────────────────────────────
  const [receiptTarget, setReceiptTarget] = useState<QuotationData | null>(null);

  // ── Filters + pagination state ───────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

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
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      toast.error(e?.data?.message || e?.message || "Failed to convert", { id: toastId });
    }
  };

  const handleEdit = (quotation: QuotationData) => {
    router.push(`/quotations/${quotation._id}/edit`);
  };

  const handleView = (quotation: QuotationData) => {
    router.push(`/quotations/${quotation._id}`);
  };

  const quotations = useMemo(() => qData?.items || [], [qData]);

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      if (status && (q.status ?? "draft") !== status) return false;
      if (search) {
        const query = search.toLowerCase();
        const clientName =
          (q.clientId as unknown as { name?: string })?.name || q.client?.contactName || "";
        const haystack = `${q.quotationNumber || ""} ${q.details?.title || ""} ${clientName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [quotations, status, search]);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotations.length / limit));
  const pagedQuotations = useMemo(
    () => filteredQuotations.slice((page - 1) * limit, page * limit),
    [filteredQuotations, page, limit],
  );

  const handleFilterChange = (key: string, value: string) => {
    if (key === "search") setSearch(value);
    if (key === "status") setStatus(value);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
  };

  const stats = useMemo(() => {
    const total = qData?.total || 0;
    const latestDrafts = quotations.filter((i) => i.status === "draft" && i.isLatestVersion).length;
    const activeLinks = quotations.filter((i) => i.status === "sent" && i.isLatestVersion).length;
    const projectValue = quotations
      .filter((i) => i.isLatestVersion)
      .reduce((acc, i) => acc + (i.totals?.grandTotal || 0), 0);
    return { total, latestDrafts, activeLinks, projectValue };
  }, [qData, quotations]);

  const quotationStats = useMemo(
    () => [
      {
        description: "Total Quotations",
        value: stats.total,
        trend: "up" as const,
        trendLabel: "All",
        footerTitle: "All quotations created",
        isMoney: false,
      },
      {
        description: "Latest Drafts",
        value: stats.latestDrafts,
        trend: "down" as const,
        trendLabel: "Draft",
        footerTitle: "Not yet sent to clients",
        isMoney: false,
      },
      {
        description: "Active Links",
        value: stats.activeLinks,
        trend: "up" as const,
        trendLabel: "Sent",
        footerTitle: "Awaiting client response",
        isMoney: false,
      },
      {
        description: "Project Value",
        value: `৳${stats.projectValue.toLocaleString()}`,
        trend: "up" as const,
        trendLabel: "Value",
        footerTitle: "Across all latest versions",
        isMoney: true,
      },
    ],
    [stats],
  );

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
            Quotation Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            Secure, version-controlled quotation-to-order workflow
            {isLoading && (
              <Loader className="h-3 w-3 animate-spin text-primary" />
            )}
          </p>
        </div>
        <Button size="sm" className="h-8" asChild>
          <Link
            href="/quotations/new"
            onClick={() => useQuotationStore.getState().reset()}
          >
            <Plus className="h-3.5 w-3.5" />
            New Quotation
          </Link>
        </Button>
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────── */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        {quotationStats.map((stat) => {
          const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
          return (
            <StatCard key={stat.description} className="@container/card">
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
            </StatCard>
          );
        })}
      </div>

      {/* ── Filters Card ─────────────────────────────────────────── */}
      <Card className="mt-5 py-0 shadow-sm">
        <div className="px-5 py-4">
          <QuotationFilters
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
          <QuotationTable
            quotations={pagedQuotations}
            isLoading={isLoading}
            canSeeFinancials={canSeeFinancials}
            sendingId={sendingId}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSend={handleOpenPicker}
            onConvert={handleConvertToOrder}
            onReceipt={(q) => setReceiptTarget(q)}
          />
        </div>

        <Separator />

        {/* Footer: Count + Pagination */}
        <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
          <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            Showing{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {pagedQuotations.length}
            </span>{' '}
            of{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {filteredQuotations.length}
            </span>{' '}
            quotations
          </p>
          <QuotationPagination
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

      <AddPaymentDialog
        quotationGroupId={receiptTarget?.quotationGroupId ?? null}
        quotationNumber={receiptTarget?.quotationNumber}
        onClose={() => setReceiptTarget(null)}
        onRecorded={refetch}
      />
    </motion.div>
  );
}
