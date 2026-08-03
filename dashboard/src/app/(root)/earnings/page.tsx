"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader, TrendingUp, TrendingDown } from "lucide-react";
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
import { AddPaymentDialog } from "@/components/receipt/AddPaymentDialog";
import {
  useGetEarningsQuery,
  useGetEarningStatsQuery,
  useGetEarningYearsQuery,
} from "@/redux/features/earning/earningApi";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import type { IEarning } from "@/types/earning.type";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { EarningFilters } from "@/components/earning/EarningFilters";
import { EarningTable } from "@/components/earning/EarningTable";
import { EarningPagination } from "@/components/earning/EarningPagination";

const STATUS_OPTIONS = [
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
  { label: "Void", value: "void" },
];

export default function EarningsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // ── Create Receipt dialog state ─────────────────────────────────────────
  const [receiptTarget, setReceiptTarget] = useState<IEarning | null>(null);

  const { data: earningsData, isLoading, refetch } = useGetEarningsQuery({ limit: 1000 });
  const { data: statsData } = useGetEarningStatsQuery();
  const { data: yearsData } = useGetEarningYearsQuery();
  const { data: clientsData } = useGetClientsQuery({ limit: 100 });

  const earnings = useMemo(() => earningsData?.data || [], [earningsData]);
  const stats = statsData?.data;
  const clients = useMemo(() => clientsData?.clients || [], [clientsData]);
  const years = useMemo(() => {
    if (yearsData?.data?.length) return yearsData.data;
    return [new Date().getFullYear()];
  }, [yearsData]);

  const filteredEarnings = useMemo(() => {
    return earnings.filter((e) => {
      if (clientId && e.clientId?._id !== clientId) return false;
      if (month && e.month !== parseInt(month)) return false;
      if (year && e.year !== parseInt(year)) return false;
      if (status && e.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${e.orderTitle || ""} ${e.quotationNumber || ""} ${e.clientId?.name || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [earnings, clientId, month, year, status, search]);

  const totalPages = Math.max(1, Math.ceil(filteredEarnings.length / limit));
  const pagedEarnings = useMemo(
    () => filteredEarnings.slice((page - 1) * limit, page * limit),
    [filteredEarnings, page, limit],
  );

  const handleFilterChange = (key: string, value: string) => {
    if (key === "search") setSearch(value);
    if (key === "status") setStatus(value);
    if (key === "clientId") setClientId(value);
    if (key === "month") setMonth(value);
    if (key === "year") setYear(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("");
    setClientId("");
    setMonth("");
    setYear("");
    setPage(1);
  };

  const earningStats = useMemo(
    () => [
      {
        description: "Total Earnings",
        value: stats?.totalCount ?? 0,
        trend: "up" as const,
        trendLabel: "All",
        footerTitle: "All earning records",
        isMoney: false,
      },
      {
        description: "Total Value",
        value: formatMoney(stats?.totalAmount ?? 0, "৳"),
        trend: "up" as const,
        trendLabel: "Value",
        footerTitle: "Total invoiced amount",
        isMoney: true,
      },
      {
        description: "Total Collected",
        value: formatMoney(stats?.totalPaidAmount ?? 0, "৳"),
        trend: "up" as const,
        trendLabel: "Paid",
        footerTitle: "Successfully collected",
        isMoney: true,
      },
      {
        description: "Partially Paid",
        value: stats?.partialCount ?? 0,
        trend: "down" as const,
        trendLabel: "Pending",
        footerTitle: "Still awaiting full payment",
        isMoney: false,
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
            Earnings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            Revenue collected from receipt payments
            {isLoading && (
              <Loader className="h-3 w-3 animate-spin text-primary" />
            )}
          </p>
        </div>
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────── */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        {earningStats.map((stat) => {
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
          <EarningFilters
            search={search}
            status={status}
            clientId={clientId}
            month={month}
            year={year}
            statusOptions={STATUS_OPTIONS}
            clients={clients}
            years={years}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />
        </div>
      </Card>

      {/* ── Table Card ───────────────────────────────────────────── */}
      <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <EarningTable
            earnings={pagedEarnings}
            isLoading={isLoading}
            onReceipt={(e) => setReceiptTarget(e)}
          />
        </div>

        <Separator />

        {/* Footer: Count + Pagination */}
        <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
          <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            Showing{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {pagedEarnings.length}
            </span>{' '}
            of{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {filteredEarnings.length}
            </span>{' '}
            earnings
          </p>
          <EarningPagination
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

      <AddPaymentDialog
        quotationGroupId={receiptTarget?.quotationGroupId ?? null}
        quotationNumber={receiptTarget?.quotationNumber}
        onClose={() => setReceiptTarget(null)}
        onRecorded={refetch}
      />
    </motion.div>
  );
}
