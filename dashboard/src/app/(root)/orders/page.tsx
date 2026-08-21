"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useGetOrdersQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  useGetOrderStatsQuery,
  useUpdateOrderStatusMutation,
  useExtendDeadlineMutation,
  useAddRevisionMutation,
  useGetOrderYearsQuery,
} from "@/redux/features/order/orderApi";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import { IconReceipt } from "@tabler/icons-react";
import type {
  IOrder,
  OrderStatus,
  OrderFilters,
} from "@/types/order.type";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Loader,
  Plus,
  Trash2,
  Edit2,
  Clock,
  FileText,
  X,
  CheckSquare,
  User,
  Calendar,
  CreditCard,
  Briefcase,
  Hash,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { toast } from "sonner";
import { OrderForm, type OrderFormData } from "@/components/order/OrderForm";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { OrderFilters as OrderFiltersBar } from "@/components/order/OrderFilters";
import { OrderTable } from "@/components/order/OrderTable";
import { OrderPagination } from "@/components/order/OrderPagination";
import { AddPaymentDialog } from "@/components/receipt/AddPaymentDialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useGetMeQuery } from "@/redux/features/staff/staffApi";
import { Role } from "@/constants/role";

const safeFormat = (
  dateStr: string | undefined | null,
  formatStr: string = "PPP",
) => {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  return format(date, formatStr);
};

interface ApiErrorResponse {
  data?: {
    message?: string;
    errors?: Record<string, string[]>;
  };
}

export default function OrdersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: meData } = useGetMeQuery({});
  const isTelemarketer = useMemo(() => {
    return (
      (session?.user?.role === Role.STAFF ||
        session?.user?.role === Role.TEAM_LEADER) &&
      Boolean(meData?.staff?.designation?.toLowerCase().includes("telemarketer"))
    );
  }, [session, meData]);
  const canSeeFinancials = useMemo(() => {
    const r = session?.user?.role;
    return r === Role.SUPER_ADMIN || r === Role.ADMIN || r === Role.HR_MANAGER;
  }, [session]);
  const [filters, setFilters] = useState<OrderFilters>({
    priority: undefined,
    clientId: undefined,
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false);
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false);
  const [isTimelineDialogOpen, setIsTimelineDialogOpen] = useState(false);
  const [isStatusChangeDialogOpen, setIsStatusChangeDialogOpen] =
    useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    orderId: string;
    status: OrderStatus;
  } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );

  // ── Create Receipt dialog state ─────────────────────────────────────────
  const [receiptTarget, setReceiptTarget] = useState<IOrder | null>(null);

  const [serverErrors, setServerErrors] = useState<
    Record<string, string[]> | undefined
  >(undefined);
  const [editDefaultValues, setEditDefaultValues] = useState<
    OrderFormData | undefined
  >(undefined);

  // Extend deadline state
  const [newDeadline, setNewDeadline] = useState<Date | undefined>(undefined);
  const [extendReason, setExtendReason] = useState("");

  // Revision state
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [statusChangeNote, setStatusChangeNote] = useState("");

  // Date filter state
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Client-side pagination state (data is fetched up-front and filtered/paginated here)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Queries
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

  // Queries
  // Fetch everything up-front (like receipts/quotations) and filter/paginate
  // client-side via TableContent — the backend doesn't apply month/year/priority
  // filters server-side anyway, so this also fixes those being silent no-ops.
  const { data: orderData, isLoading, refetch: refetchOrders } = useGetOrdersQuery({ limit: 1000 });
  const { data: statsData } = useGetOrderStatsQuery();
  const { data: clientsData } = useGetClientsQuery({ limit: 100 });

  // Mutations
  const [createOrder, { isLoading: isCreating }] = useCreateOrderMutation();
  const [updateOrder, { isLoading: isUpdating }] = useUpdateOrderMutation();
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteOrderMutation();
  const [updateOrderStatus, { isLoading: isUpdatingStatus }] =
    useUpdateOrderStatusMutation();
  const [extendDeadline, { isLoading: isExtending }] =
    useExtendDeadlineMutation();
  const [addRevision, { isLoading: isAddingRevision }] =
    useAddRevisionMutation();

  const orders = useMemo(() => orderData?.data || [], [orderData]);
  const stats = statsData?.data;
  const clients = useMemo(() => clientsData?.clients || [], [clientsData]);

  // Status / Priority / Client / Search / Month / Year filters, applied client-side
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filters.priority && order.priority !== filters.priority) return false;
      if (filters.status && order.status !== filters.status) return false;
      if (filters.clientId) {
        const cid =
          typeof order.clientId === "object" ? order.clientId._id : order.clientId;
        if (cid !== filters.clientId) return false;
      }
      if (selectedMonth || selectedYear) {
        const d = new Date(order.createdAt || order.orderDate);
        if (selectedMonth && d.getMonth() + 1 !== parseInt(selectedMonth)) return false;
        if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const clientName = typeof order.clientId === "object" ? order.clientId.name : "";
        const project = order.quotationSnapshot?.templateName || order.orderName || "";
        if (
          !order._id.toLowerCase().includes(q) &&
          !clientName.toLowerCase().includes(q) &&
          !project.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, filters, selectedMonth, selectedYear]);

  // Reset to page 1 whenever the filtered set changes
  useEffect(() => {
    setPage(1);
  }, [filters, selectedMonth, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / limit));
  const pagedOrders = useMemo(
    () => filteredOrders.slice((page - 1) * limit, page * limit),
    [filteredOrders, page, limit],
  );

  // Check if every currently-filtered order is selected
  const allOrdersSelected = useMemo(() => {
    return (
      filteredOrders.length > 0 &&
      filteredOrders.every((order) => selectedOrderIds.has(order._id))
    );
  }, [filteredOrders, selectedOrderIds]);

  // Toggle single order selection
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // Toggle all currently-filtered orders
  const toggleAllOrders = (checked: boolean) => {
    setSelectedOrderIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        filteredOrders.forEach((order) => newSet.add(order._id));
      } else {
        filteredOrders.forEach((order) => newSet.delete(order._id));
      }
      return newSet;
    });
  };

  // Clear selection and exit selection mode
  const clearSelection = () => {
    setSelectedOrderIds(new Set());
    setIsSelectionMode(false);
  };

  const handleFilterChange = (
    key: keyof OrderFilters,
    value: string | number | undefined,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  // Bridges the OrderFilters component (search/status/priority/client/month/year)
  // to the two underlying pieces of state: `filters` and the month/year strings.
  const handleOrderFilterChange = (key: string, value: string) => {
    if (key === "month") {
      setSelectedMonth(value);
      return;
    }
    if (key === "year") {
      setSelectedYear(value);
      return;
    }
    handleFilterChange(key as keyof OrderFilters, value);
  };

  const handleClearOrderFilters = () => {
    setFilters({ priority: undefined, clientId: undefined, status: undefined, search: undefined });
    setSelectedMonth("");
    setSelectedYear("");
  };

  const canManageOrder = (order: IOrder) =>
    !isTelemarketer ||
    (isTelemarketer &&
      (typeof order.clientId === "object"
        ? order.clientId.createdBy?._id
        : order.clientId) === session?.user?.id);

  const handleCreateOrder = async (data: OrderFormData) => {
    setServerErrors(undefined);
    try {
      await createOrder(data).unwrap();
      toast.success("Order created successfully");
      setIsAddDialogOpen(false);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      if (err?.data?.errors) {
        setServerErrors(err.data.errors);
      } else {
        toast.error(err?.data?.message || "Failed to create order");
      }
    }
  };

  const handleUpdateOrder = async (data: OrderFormData) => {
    if (!selectedOrder) return;
    setServerErrors(undefined);
    try {
      await updateOrder({
        id: selectedOrder._id,
        data,
      }).unwrap();
      toast.success("Order updated successfully");
      setIsEditDialogOpen(false);
      setSelectedOrder(null);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      if (err?.data?.errors) {
        setServerErrors(err.data.errors);
      } else {
        toast.error(err?.data?.message || "Failed to update order");
      }
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    try {
      await deleteOrder(selectedOrder._id).unwrap();
      toast.success("Order deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedOrder(null);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      toast.error(err?.data?.message || "Failed to delete order");
    }
  };

  const handleBulkDeleteOrders = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsBulkDeleting(true);
    const orderIdsArray = Array.from(selectedOrderIds);

    try {
      const results = await Promise.allSettled(
        orderIdsArray.map((id) => deleteOrder(id).unwrap()),
      );

      const successCount = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const errorCount = results.filter((r) => r.status === "rejected").length;

      if (successCount > 0) {
        toast.success(`${successCount} order(s) deleted successfully`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} order(s)`);
      }
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("An unexpected error occurred during bulk deletion");
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteDialogOpen(false);
      clearSelection();
    }
  };

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus,
  ) => {
    // Guard against empty/undefined values
    if (!newStatus) {
      console.log("handleStatusChange - empty status, skipping");
      return;
    }

    // If changing to revision, ask for optional instruction
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

  const handleExtendDeadline = async () => {
    if (!selectedOrder || !newDeadline) return;
    try {
      await extendDeadline({
        id: selectedOrder._id,
        data: {
          newDeadline: newDeadline.toISOString(),
          reason: extendReason,
        },
      }).unwrap();
      toast.success("Deadline extended successfully");
      setIsExtendDialogOpen(false);
      setNewDeadline(undefined);
      setExtendReason("");
      setSelectedOrder(null);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      toast.error(err?.data?.message || "Failed to extend deadline");
    }
  };

  const handleAddRevision = async () => {
    if (!selectedOrder || !revisionInstruction.trim()) return;
    try {
      await addRevision({
        id: selectedOrder._id,
        data: { instruction: revisionInstruction },
      }).unwrap();
      toast.success("Revision added successfully");
      setIsRevisionDialogOpen(false);
      setRevisionInstruction("");
      setSelectedOrder(null);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      toast.error(err?.data?.message || "Failed to add revision");
    }
  };

  const openEditDialog = (order: IOrder) => {
    setSelectedOrder(order);
    setServerErrors(undefined);
    setEditDefaultValues({
      orderName: order.orderName,
      clientId:
        typeof order.clientId === "object"
          ? order.clientId._id
          : order.clientId,
      orderDate: order.orderDate.split("T")[0],
      deadline: order.deadline,
      imageQuantity: order.imageQuantity,
      perImagePrice: order.perImagePrice,
      totalPrice: order.totalPrice,
      services: order.services?.map((s) => s._id) || [],
      returnFileFormat: order.returnFileFormat._id,
      instruction: order.instruction || "",
      priority: order.priority,
      notes: order.notes || "",
      contactPersonId: order.contactPersonId || "",
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (order: IOrder) => {
    router.push(`/orders/${order._id}`);
  };

  const openTimelineDialog = (order: IOrder) => {
    setSelectedOrder(order);
    setIsTimelineDialogOpen(true);
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
      {
        description: "Total Orders",
        value: stats?.total || 0,
        trend: "up" as const,
        trendLabel: "All",
        footerTitle: "All orders placed",
      },
      {
        description: "Pending",
        value: stats?.pending || 0,
        trend: "down" as const,
        trendLabel: "Waiting",
        footerTitle: "Awaiting action",
      },
      {
        description: "In Progress",
        value: stats?.inProgress || 0,
        trend: "up" as const,
        trendLabel: "Active",
        footerTitle: "Currently in production",
      },
      {
        description: "Quality Check",
        value: stats?.qualityCheck || 0,
        trend: "up" as const,
        trendLabel: "QC",
        footerTitle: "Under review",
      },
      {
        description: "Revision",
        value: stats?.revision || 0,
        trend: (stats?.revision ?? 0) > 0 ? ("down" as const) : ("up" as const),
        trendLabel: "Rework",
        footerTitle: "Sent back for changes",
      },
      {
        description: "Completed",
        value: stats?.completed || 0,
        trend: "up" as const,
        trendLabel: "Done",
        footerTitle: "Finished orders",
      },
      {
        description: "Delivered",
        value: stats?.delivered || 0,
        trend: "up" as const,
        trendLabel: "Sent",
        footerTitle: "Delivered to client",
      },
      {
        description: "Overdue",
        value: stats?.overdue || 0,
        trend: (stats?.overdue ?? 0) > 0 ? ("down" as const) : ("up" as const),
        trendLabel: "Alert",
        footerTitle: "Past deadline",
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
            Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            Manage graphic design orders and track their status
            {isLoading && (
              <Loader className="h-3 w-3 animate-spin text-primary" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Select Mode Toggle Button (Hidden for telemarketers) */}
          {!isTelemarketer &&
            (!isSelectionMode ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setIsSelectionMode(true)}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={clearSelection}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            ))}
          <Button variant="outline" size="sm" className="h-8" asChild>
            <Link href="/orders/invoice">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Generate Invoice</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8" asChild>
            <Link href="/quotations">
              <IconReceipt className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quotation Pipeline</span>
            </Link>
          </Button>
          {/* Manual Add Order is disabled - redirect to Quotations */}
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

      {/* ── Selection Action Bar ─────────────────────────────────── */}
      {isSelectionMode && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/20 mt-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedOrderIds.size} order
              {selectedOrderIds.size !== 1 ? "s" : ""} selected
            </span>
            {selectedOrderIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedOrderIds(new Set())}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3" />
                Clear Selection
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isTelemarketer && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                disabled={selectedOrderIds.size === 0}
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedOrderIds.size})
              </Button>
            )}
          </div>
        </div>
      )}

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
            isSelectionMode={isSelectionMode}
            selectedOrderIds={selectedOrderIds}
            allSelected={allOrdersSelected}
            onToggleAll={toggleAllOrders}
            onToggleOne={toggleOrderSelection}
            canSeeFinancials={canSeeFinancials}
            canManage={canManageOrder}
            onView={openViewDialog}
            onReceipt={(order) => setReceiptTarget(order)}
            onEdit={openEditDialog}
            onDelete={(order) => {
              setSelectedOrder(order);
              setIsDeleteDialogOpen(true);
            }}
            onTimeline={openTimelineDialog}
            onStatusChange={handleStatusChange}
          />
        </div>

        <Separator />

        {/* Footer: Count + Pagination */}
        <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
          <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            Showing{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {pagedOrders.length}
            </span>{' '}
            of{' '}
            <span className="mx-1 font-medium text-foreground/80">
              {filteredOrders.length}
            </span>{' '}
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

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setServerErrors(undefined);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>Update the order details</DialogDescription>
          </DialogHeader>
          {editDefaultValues && (
            <OrderForm
              key={selectedOrder?._id}
              defaultValues={editDefaultValues}
              onSubmit={handleUpdateOrder}
              isSubmitting={isUpdating}
              submitLabel="Update Order"
              onCancel={() => setIsEditDialogOpen(false)}
              serverErrors={serverErrors}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Pixel-Perfect SaaS View Order Modal */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl! p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-background">
          {selectedOrder && (
            <div className="flex flex-col max-h-[90vh]">
              {/* Premium Header - Stripe/Linear Inspired */}
              <div className="px-8 pt-8 pb-6 border-b bg-muted/20">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <DialogTitle className="text-2xl font-bold tracking-tight leading-tight text-foreground">
                      {selectedOrder.title || selectedOrder.orderName}
                    </DialogTitle>
                    <div className="flex items-center gap-2 text-muted-foreground/80">
                      <Hash className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-mono font-semibold tracking-wider uppercase">
                        Order-{selectedOrder._id.slice(-8).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <Badge
                      className={cn(
                        "px-4 py-1 text-[11px] font-bold uppercase tracking-[0.05em] rounded-full border shadow-sm transition-colors",
                        selectedOrder.status === "pending"
                          ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
                          : selectedOrder.status === "in_progress"
                            ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100"
                            : selectedOrder.status === "completed"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-muted text-muted-foreground border-transparent",
                      )}
                    >
                      {ORDER_STATUS_LABELS[selectedOrder.status]}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      Updated {format(new Date(selectedOrder.updatedAt), "MMM dd, p")}
                    </div>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 px-8 py-6">
                <div className="space-y-10 pb-6">
                  {/* Info Grid - Premium Cards Layout */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    <Card className="relative bg-card border border-transparent hover:border-teal-500/40 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] rounded-xl overflow-hidden group h-full">
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex flex-col gap-4 h-full justify-between">
                          <div className="w-9 h-9 flex items-center justify-center bg-teal-500/10 rounded-lg text-teal-600 group-hover:bg-teal-500/20 transition-colors">
                            <User className="w-4.5 h-4.5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Client</p>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">
                                {typeof selectedOrder.clientId === "object" ? selectedOrder.clientId.name : "Not provided"}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-semibold truncate opacity-50 uppercase tracking-tighter">
                                ID: {typeof selectedOrder.clientId === "object" ? selectedOrder.clientId._id.slice(-6) : "---"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="relative bg-card border border-transparent hover:border-indigo-500/40 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] rounded-xl overflow-hidden group h-full">
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex flex-col gap-4 h-full justify-between">
                          <div className="w-9 h-9 flex items-center justify-center bg-indigo-500/10 rounded-lg text-indigo-600 group-hover:bg-indigo-500/20 transition-colors">
                            <Briefcase className="w-4.5 h-4.5" />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Type</p>
                            <Badge variant="secondary" className={cn(
                              "text-[10px] font-bold rounded-md px-2 py-0.5 border-none",
                              selectedOrder.orderType === 'project' ? "bg-teal-100 text-teal-700" : "bg-purple-100 text-purple-700"
                            )}>
                              {selectedOrder.orderType || "Service"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="relative bg-card border border-transparent hover:border-blue-500/40 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] rounded-xl overflow-hidden group h-full">
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex flex-col gap-4 h-full justify-between">
                          <div className="w-9 h-9 flex items-center justify-center bg-blue-500/10 rounded-lg text-blue-600 group-hover:bg-blue-500/20 transition-colors">
                            <Calendar className="w-4.5 h-4.5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Created</p>
                            <p className="text-sm font-bold text-foreground">
                              {safeFormat(selectedOrder.createdAt, "MMM dd, yyyy")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="relative bg-card border border-transparent hover:border-teal-500/60 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] rounded-xl overflow-hidden group h-full">
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex flex-col gap-4 h-full justify-between">
                          <div className="w-9 h-9 flex items-center justify-center bg-emerald-500/10 rounded-lg text-emerald-600 group-hover:bg-emerald-500/20 transition-colors">
                            <CreditCard className="w-4.5 h-4.5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Total Amount</p>
                            <p className="text-xl font-black text-teal-600 tracking-tight">
                              ${(selectedOrder.totalAmount || selectedOrder.totalPrice || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Description Section */}
                  {(selectedOrder.description || selectedOrder.instruction) && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-[3px] bg-teal-500 rounded-full" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/70">Project Summary</h4>
                      </div>
                      <div className="bg-muted/40 p-6 rounded-2xl border border-muted/20">
                        <p className="text-sm leading-relaxed text-foreground/80 font-medium">
                          {selectedOrder.description || selectedOrder.instruction}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Scope of Work */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-[3px] bg-teal-500 rounded-full" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/70">Scope of Work</h4>
                      </div>
                      <div className="bg-muted/50 px-2 py-0.5 rounded text-[10px] font-bold text-muted-foreground uppercase tracking-wider border">
                        {selectedOrder.items?.length || selectedOrder.services?.length || 0} Items
                      </div>
                    </div>
                    
                    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow className="hover:bg-transparent border-b">
                            <TableHead className="w-[60%] h-11 text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider pl-6">Service / Item</TableHead>
                            <TableHead className="h-11 text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider text-center">Unit</TableHead>
                            <TableHead className="h-11 text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider text-right pr-6">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOrder.items && selectedOrder.items.length > 0 ? (
                            selectedOrder.items.map((item, idx) => (
                              <TableRow key={idx} className="group hover:bg-muted/20 transition-colors border-b last:border-0 even:bg-muted/5">
                                <TableCell className="py-5 pl-6">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-bold text-sm group-hover:text-teal-600 transition-colors">{item.name}</span>
                                    <span className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-tight">{item.pricingModel || 'Standard'}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-5 text-center">
                                  <div className="inline-flex items-center justify-center bg-muted px-2.5 py-0.5 rounded text-[11px] font-bold font-mono">
                                    {item.quantity || item.hours || 1}
                                  </div>
                                </TableCell>
                                <TableCell className="py-5 text-right pr-6">
                                  <span className="font-black text-sm tracking-tighter text-foreground">${item.totalPrice?.toLocaleString()}</span>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : selectedOrder.services?.length > 0 ? (
                            selectedOrder.services.map((service) => (
                              <TableRow key={service._id} className="group hover:bg-muted/20 transition-colors border-b last:border-0 even:bg-muted/5">
                                <TableCell className="py-5 pl-6 font-bold text-sm group-hover:text-teal-600 transition-colors">{service.name}</TableCell>
                                <TableCell className="py-5 text-center">
                                  <div className="inline-flex items-center justify-center bg-muted px-2.5 py-0.5 rounded text-[11px] font-bold font-mono">1</div>
                                </TableCell>
                                <TableCell className="py-5 text-right pr-6 italic text-[10px] text-muted-foreground/50 uppercase font-black tracking-widest">Included</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="h-32 text-center text-muted-foreground/60 text-sm italic font-medium">
                                No specific scope items defined for this order
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Revision Log */}
                  {selectedOrder.revisionInstructions?.length > 0 && (
                    <div className="space-y-5 pt-2">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-[3px] bg-orange-500 rounded-full" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/70">Revision Log</h4>
                      </div>
                      <div className="space-y-4">
                        {selectedOrder.revisionInstructions.map((rev, idx) => (
                          <div key={idx} className="relative pl-7 pb-2 last:pb-0 group">
                            <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-orange-500 ring-4 ring-orange-500/10 z-10" />
                            {idx !== selectedOrder.revisionInstructions.length - 1 && (
                              <div className="absolute left-[3.5px] top-4 w-px h-[calc(100%-4px)] bg-muted/60 group-hover:bg-orange-500/30 transition-colors" />
                            )}
                            <div className="space-y-1.5">
                              <div className="bg-orange-500/5 p-4 rounded-xl border border-orange-500/10">
                                <p className="text-sm text-foreground/90 leading-relaxed font-semibold">{rev.instruction}</p>
                                <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-orange-500/60 uppercase tracking-widest">
                                  <Calendar className="w-3 h-3" />
                                  {safeFormat(rev.createdAt, "MMM dd, yyyy @ h:mm a")}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Actions Footer */}
              <div className="px-8 py-6 border-t bg-muted/20 flex items-center justify-between gap-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsViewDialogOpen(false)}
                  className="rounded-xl px-6 font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </Button>
                <div className="flex gap-4">
                  <Button 
                    variant="outline" 
                    className="rounded-xl px-6 h-11 font-bold border-teal-500/20 hover:bg-teal-500/5 hover:text-teal-600 transition-all active:scale-95 flex items-center gap-2"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      openEditDialog(selectedOrder);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Order
                  </Button>
                  <Link href={`/orders/invoice/${selectedOrder._id}`} target="_blank">
                    <Button className="rounded-xl px-8 h-11 font-black bg-teal-600 hover:bg-teal-700 shadow-xl shadow-teal-500/20 transition-all active:scale-95 flex items-center gap-2 group">
                      <FileText className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      Invoice
                      <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-50" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extend Deadline Dialog */}
      <Dialog
        open={isExtendDialogOpen}
        onOpenChange={(open) => {
          setIsExtendDialogOpen(open);
          if (!open) {
            setNewDeadline(undefined);
            setExtendReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Deadline</DialogTitle>
            <DialogDescription>
              Set a new deadline for this order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <DateTimePicker
              label="New Deadline"
              value={newDeadline}
              onChange={setNewDeadline}
              placeholder="Select new deadline"
            />
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                placeholder="Why is the deadline being extended?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsExtendDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExtendDeadline}
              disabled={!newDeadline || isExtending}
            >
              {isExtending && <Loader className="h-4 w-4 animate-spin" />}
              Extend Deadline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Revision Dialog */}
      <Dialog
        open={isRevisionDialogOpen}
        onOpenChange={(open) => {
          setIsRevisionDialogOpen(open);
          if (!open) setRevisionInstruction("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Revision</DialogTitle>
            <DialogDescription>
              Add revision instructions for this order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Revision Instructions *</Label>
              <Textarea
                value={revisionInstruction}
                onChange={(e) => setRevisionInstruction(e.target.value)}
                placeholder="Describe what needs to be revised..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRevisionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddRevision}
              disabled={!revisionInstruction.trim() || isAddingRevision}
            >
              {isAddingRevision && <Loader className="h-4 w-4 animate-spin" />}
              Add Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timeline Dialog */}
      <Dialog
        open={isTimelineDialogOpen}
        onOpenChange={setIsTimelineDialogOpen}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Timeline</DialogTitle>
            <DialogDescription>{selectedOrder?.orderName}</DialogDescription>
          </DialogHeader>
          {selectedOrder && selectedOrder.timeline && (
            <OrderTimeline timeline={selectedOrder.timeline} />
          )}
        </DialogContent>
      </Dialog>

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

      {/* Delete Confirmation */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order{" "}
              <strong>{selectedOrder?.orderName}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader className="h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{selectedOrderIds.size}</strong> selected order
              {selectedOrderIds.size !== 1 ? "s" : ""}? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBulkDeleteOrders();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBulkDeleting}
            >
              {isBulkDeleting && <Loader className="h-4 w-4 animate-spin" />}
              Delete {selectedOrderIds.size} Order
              {selectedOrderIds.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddPaymentDialog
        quotationGroupId={receiptTarget?.quotationGroupId ?? null}
        quotationNumber={receiptTarget?.quotationSnapshot?.quotationNumber}
        onClose={() => setReceiptTarget(null)}
        onRecorded={refetchOrders}
      />
    </motion.div>
  );
}
