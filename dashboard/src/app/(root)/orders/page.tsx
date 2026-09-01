"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useGetOrdersQuery,
  useGetOrderStatsQuery,
  useUpdateOrderStatusMutation,
  useGetOrderYearsQuery,
} from "@/redux/features/order/orderApi";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import { IconReceipt } from "@tabler/icons-react";
import type { IOrder, OrderStatus, OrderFilters } from "@/types/order.type";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { motion } from "framer-motion";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader, Plus, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { OrderFilters as OrderFiltersBar } from "@/components/order/OrderFilters";
import { OrderTable } from "@/components/order/OrderTable";
import { OrderPagination } from "@/components/order/OrderPagination";
import { AddPaymentDialog } from "@/components/receipt/AddPaymentDialog";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth-client";
import { Role } from "@/constants/role";

interface ApiErrorResponse {
  data?: { message?: string; errors?: Record<string, string[]> };
}

export default function OrdersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canSeeFinancials = useMemo(() => {
    const r = session?.user?.role;
    return r === Role.SUPER_ADMIN || r === Role.ADMIN || r === Role.HR_MANAGER;
  }, [session]);

  const [filters, setFilters] = useState<OrderFilters>({
    priority: undefined,
    clientId: undefined,
  });
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Record-payment dialog target (order → its quotation group → receipt)
  const [receiptTarget, setReceiptTarget] = useState<IOrder | null>(null);

  // "Set to Revision" note dialog
  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] =
    useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    orderId: string;
    status: OrderStatus;
  } | null>(null);
  const [statusChangeNote, setStatusChangeNote] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: yearsData } = useGetOrderYearsQuery();
  const sortedYears = useMemo(() => {
    if (!yearsData?.data) {
      const currentYear = new Date().getFullYear();
      return Array.from({ length: currentYear - 2020 + 2 }, (_, i) => 2020 + i);
    }
    return [...yearsData.data].sort((a, b) => b - a);
  }, [yearsData]);

  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const {
    data: orderData,
    isLoading,
    refetch: refetchOrders,
  } = useGetOrdersQuery({ limit: 1000 });
  const { data: statsData } = useGetOrderStatsQuery();
  const { data: clientsData } = useGetClientsQuery({ limit: 100 });

  const [updateOrderStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOrderStatusMutation();

  const orders = useMemo(() => orderData?.data || [], [orderData]);
  const stats = statsData?.data;
  const clients = useMemo(() => clientsData?.clients || [], [clientsData]);

  // ── Client-side filtering / pagination ───────────────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filters.priority && order.priority !== filters.priority) return false;
      if (filters.status && order.status !== filters.status) return false;
      if (filters.clientId) {
        const cid =
          typeof order.clientId === "object"
            ? order.clientId._id
            : order.clientId;
        if (cid !== filters.clientId) return false;
      }
      if (selectedMonth || selectedYear) {
        const d = new Date(order.createdAt);
        if (selectedMonth && d.getMonth() + 1 !== parseInt(selectedMonth))
          return false;
        if (selectedYear && d.getFullYear() !== parseInt(selectedYear))
          return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const clientName =
          typeof order.clientId === "object" ? order.clientId.name : "";
        const project =
          order.quotationSnapshot?.templateName ||
          order.quotationSnapshot?.details?.title ||
          order.orderNumber ||
          "";
        if (
          !order._id.toLowerCase().includes(q) &&
          !order.orderNumber?.toLowerCase().includes(q) &&
          !clientName.toLowerCase().includes(q) &&
          !project.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, filters, selectedMonth, selectedYear]);

  useEffect(() => {
    setPage(1);
  }, [filters, selectedMonth, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / limit));
  const pagedOrders = useMemo(
    () => filteredOrders.slice((page - 1) * limit, page * limit),
    [filteredOrders, page, limit],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleFilterChange = (
    key: keyof OrderFilters,
    value: string | number | undefined,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handleOrderFilterChange = (key: string, value: string) => {
    if (key === "month") return setSelectedMonth(value);
    if (key === "year") return setSelectedYear(value);
    handleFilterChange(key as keyof OrderFilters, value);
  };

  const handleClearOrderFilters = () => {
    setFilters({
      priority: undefined,
      clientId: undefined,
      status: undefined,
      search: undefined,
    });
    setSelectedMonth("");
    setSelectedYear("");
  };

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus,
  ) => {
    if (!newStatus) return;
    // "revision" asks for an optional note first
    if (newStatus === "revision") {
      setPendingStatusChange({ orderId, status: newStatus });
      setStatusChangeNote("");
      setIsStatusChangeDialogOpen(true);
      return;
    }
    try {
      await updateOrderStatus({
        id: orderId,
        data: { status: newStatus },
      }).unwrap();
      toast.success(`Status updated to ${ORDER_STATUS_LABELS[newStatus]}`);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      toast.error(err?.data?.message || "Failed to update status");
    }
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;
    try {
      await updateOrderStatus({
        id: pendingStatusChange.orderId,
        data: {
          status: pendingStatusChange.status,
          note: statusChangeNote || undefined,
        },
      }).unwrap();
      toast.success(
        `Status updated to ${ORDER_STATUS_LABELS[pendingStatusChange.status]}`,
      );
      setIsStatusChangeDialogOpen(false);
      setPendingStatusChange(null);
      setStatusChangeNote("");
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      toast.error(err?.data?.message || "Failed to update status");
    }
  };

  const openViewDialog = (order: IOrder) => {
    router.push(`/orders/${order._id}`);
  };

  const statusFilterOptions = useMemo(
    () =>
      Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
        label,
        value,
      })),
    [],
  );

  const orderStats = useMemo(
    () => [
      { description: "Total Orders", value: stats?.total || 0, trend: "up" as const, trendLabel: "All", footerTitle: "All orders placed" },
      { description: "Pending", value: stats?.pending || 0, trend: "down" as const, trendLabel: "Waiting", footerTitle: "Awaiting action" },
      { description: "In Progress", value: stats?.inProgress || 0, trend: "up" as const, trendLabel: "Active", footerTitle: "Currently in production" },
      { description: "Quality Check", value: stats?.qualityCheck || 0, trend: "up" as const, trendLabel: "QC", footerTitle: "Under review" },
      { description: "Revision", value: stats?.revision || 0, trend: (stats?.revision ?? 0) > 0 ? ("down" as const) : ("up" as const), trendLabel: "Rework", footerTitle: "Sent back for changes" },
      { description: "Completed", value: stats?.completed || 0, trend: "up" as const, trendLabel: "Done", footerTitle: "Finished orders" },
      { description: "Delivered", value: stats?.delivered || 0, trend: "up" as const, trendLabel: "Sent", footerTitle: "Delivered to client" },
      { description: "Overdue", value: stats?.overdue || 0, trend: (stats?.overdue ?? 0) > 0 ? ("down" as const) : ("up" as const), trendLabel: "Alert", footerTitle: "Past deadline" },
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
            Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            Orders created from accepted quotations — track status and delivery
            {isLoading && (
              <Loader className="h-3 w-3 animate-spin text-primary" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" className="h-8" asChild>
            <Link href="/quotations">
              <IconReceipt className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quotation Pipeline</span>
            </Link>
          </Button>
          {/* Orders can only be created by converting a quotation */}
          <Button size="sm" className="h-8" asChild>
            <Link href="/quotations/new">
              <Plus className="h-3.5 w-3.5" />
              New Quotation
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────── */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:grid-cols-4">
        {orderStats.map((stat) => {
          const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
          return (
            <Card key={stat.description} className="@container/card">
              <CardHeader>
                <CardDescription>{stat.description}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {stat.value}
                </CardTitle>
                <CardAction>
                  <Badge
                    variant="outline"
                    className="text-primary border-primary/30"
                  >
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
          <OrderFiltersBar
            search={filters.search || ""}
            status={filters.status || ""}
            priority={filters.priority || ""}
            clientId={filters.clientId || ""}
            month={selectedMonth}
            year={selectedYear}
            statusOptions={statusFilterOptions}
            clients={clients}
            months={months}
            years={sortedYears}
            onFilterChange={handleOrderFilterChange}
            onClearFilters={handleClearOrderFilters}
          />
        </div>
      </Card>

      {/* ── Table Card ───────────────────────────────────────────── */}
      <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <OrderTable
            orders={pagedOrders}
            isLoading={isLoading}
            canSeeFinancials={canSeeFinancials}
            onView={openViewDialog}
            onReceipt={(order) => setReceiptTarget(order)}
            onStatusChange={handleStatusChange}
          />
        </div>

        <Separator />

        <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
          <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            Showing{" "}
            <span className="mx-1 font-medium text-foreground/80">
              {pagedOrders.length}
            </span>{" "}
            of{" "}
            <span className="mx-1 font-medium text-foreground/80">
              {filteredOrders.length}
            </span>{" "}
            orders
          </p>
          <OrderPagination
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

      {/* Status Change Dialog (for revision) */}
      <Dialog
        open={isStatusChangeDialogOpen}
        onOpenChange={(open) => {
          setIsStatusChangeDialogOpen(open);
          if (!open) {
            setPendingStatusChange(null);
            setStatusChangeNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change to Revision</DialogTitle>
            <DialogDescription>
              Add optional revision instructions for the client
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Revision Instructions (optional)</Label>
              <Textarea
                value={statusChangeNote}
                onChange={(e) => setStatusChangeNote(e.target.value)}
                placeholder="What needs to be revised..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsStatusChangeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={confirmStatusChange} disabled={isUpdatingStatus}>
              {isUpdatingStatus && <Loader className="h-4 w-4 animate-spin" />}
              Set to Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddPaymentDialog
        quotationGroupId={receiptTarget?.quotationGroupId ?? null}
        quotationNumber={receiptTarget?.quotationSnapshot?.quotationNumber}
        onClose={() => setReceiptTarget(null)}
        onRecorded={refetchOrders}
      />
    </motion.div>
  );
}
