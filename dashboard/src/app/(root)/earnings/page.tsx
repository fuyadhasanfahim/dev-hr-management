"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  X,
} from "lucide-react";
import { TableContent } from "@/components/shared/table-content";
import {
  useGetEarningsQuery,
  useGetEarningStatsQuery,
  useGetEarningYearsQuery,
} from "@/redux/features/earning/earningApi";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import type { IEarning, EarningStatus } from "@/types/earning.type";
import { MONTHS } from "@/types/earning.type";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_CONFIG: Record<EarningStatus, { label: string; cls: string }> = {
  partial: {
    label: "Partial",
    cls: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
  },
  paid: {
    label: "Paid",
    cls: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400",
  },
  void: {
    label: "Void",
    cls: "text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
  },
};

export default function EarningsPage() {
  const [clientId, setClientId] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");

  const { data: earningsData, isLoading } = useGetEarningsQuery({ limit: 1000 });
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
      return true;
    });
  }, [earnings, clientId, month, year]);

  const statusFilterOptions = [
    { label: "Partial", value: "partial" },
    { label: "Paid", value: "paid" },
    { label: "Void", value: "void" },
  ];

  const columns = useMemo<ColumnDef<IEarning, any>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        accessorFn: (row) => row.orderTitle,
        cell: ({ row }) => {
          const e = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {e.orderTitle}
              </span>
              <Badge variant="secondary" className="w-fit text-[9px] font-semibold px-1.5 py-0 font-mono">
                {e.quotationNumber}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "client",
        header: "Client",
        accessorFn: (row) => row.clientId?.name || "",
        cell: ({ row }) => (
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {row.original.clientId?.name || "N/A"}
          </span>
        ),
      },
      {
        id: "total",
        header: () => <div className="text-right">Total</div>,
        accessorFn: (row) => row.totalAmount,
        cell: ({ row }) => (
          <div className="text-right font-bold text-slate-500 dark:text-slate-400">
            {formatMoney(row.original.totalAmount, row.original.currency)}
          </div>
        ),
      },
      {
        id: "paid",
        header: () => <div className="text-right">Paid</div>,
        accessorFn: (row) => row.paidAmount,
        cell: ({ row }) => {
          const e = row.original;
          const pct = e.totalAmount > 0 ? Math.min(100, Math.round((e.paidAmount / e.totalAmount) * 100)) : 0;
          return (
            <div className="w-full max-w-[130px] ml-auto space-y-1">
              <div className="text-right font-black text-slate-900 dark:text-white">
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
          );
        },
      },
      {
        id: "status",
        header: () => <div className="text-center">Status</div>,
        accessorFn: (row) => row.status,
        cell: ({ row }) => {
          const cfg = STATUS_CONFIG[row.original.status] ?? STATUS_CONFIG.partial;
          return (
            <div className="flex justify-center">
              <Badge variant="outline" className={cn("text-[11px] font-semibold px-2.5 py-0.5", cfg.cls)}>
                {cfg.label}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "period",
        header: "Period",
        accessorFn: (row) => row.year * 100 + row.month,
        cell: ({ row }) => {
          const e = row.original;
          const monthLabel = MONTHS.find((m) => m.value === e.month)?.label || e.month;
          return (
            <span className="text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">
              {monthLabel} {e.year}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8.5 w-8.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              title="View Receipt"
            >
              <Link href={`/receipts/${row.original.receiptId?._id}`}>
                <Eye className="h-4.5 w-4.5" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#4E12D4]/10 text-[#4E12D4] ring-1 ring-[#4E12D4]/20">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
              Earnings
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Revenue collected from receipt payments.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Earnings",
            value: stats?.totalCount ?? 0,
            icon: <Wallet className="h-5 w-5 text-[#4E12D4]" />,
            color: "text-[#4E12D4] bg-[#4E12D4]/10",
          },
          {
            label: "Total Value",
            value: formatMoney(stats?.totalAmount ?? 0, "৳"),
            icon: <TrendingUp className="h-5 w-5 text-teal-600" />,
            color: "text-teal-600 bg-teal-50 dark:bg-teal-950/20",
          },
          {
            label: "Total Collected",
            value: formatMoney(stats?.totalPaidAmount ?? 0, "৳"),
            icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20",
          },
          {
            label: "Partially Paid",
            value: stats?.partialCount ?? 0,
            icon: <Clock className="h-5 w-5 text-amber-600" />,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="rounded-3xl border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-5 transition-all duration-300 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
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

      {/* Table */}
      <TableContent
        data={filteredEarnings}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Search by order title or quotation number..."
        statusFilterKey="status"
        statusOptions={statusFilterOptions}
        extraFilters={
          <>
            <div className="hidden md:flex items-center gap-1.5 text-xs font-bold text-muted-foreground shrink-0">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="w-full md:w-[130px] shrink-0">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="bg-background w-full">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[110px] shrink-0">
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="bg-background w-full">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[160px] shrink-0">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="bg-background w-full">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(clientId || month || year) && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setClientId("");
                  setMonth("");
                  setYear("");
                }}
                className="bg-background shrink-0"
                title="Clear filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
