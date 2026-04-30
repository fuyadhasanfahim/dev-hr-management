"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useGetOrdersQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  useGetOrderStatsQuery,
  useUpdateOrderStatusMutation,
  useExtendDeadlineMutation,
  useAddRevisionMutation,
  useLazyGetOrdersQuery,
  useGetOrderYearsQuery,
} from "@/redux/features/order/orderApi";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import { IconReceipt } from "@tabler/icons-react";
import type {
  IOrder,
  OrderStatus,
  OrderPriority,
  OrderFilters,
  UpdateStatusInput,
} from "@/types/order.type";
import {
  ORDER_STATUS_LABELS,
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogTrigger,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  RotateCcw,
  AlertTriangle,
  FileText,
  History,
  Search,
  Filter,
  X,
  CheckSquare,
  User,
  Calendar,
  CreditCard,
  Briefcase,
  Hash,
  ArrowRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { OrderForm, type OrderFormData } from "@/components/order/OrderForm";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { EmailDialog } from "./EmailDialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useGetMeQuery } from "@/redux/features/staff/staffApi";
import { Role } from "@/constants/role";

// Status workflow: defines which statuses can transition to which
// Key = current status, Value = array of allowed next statuses
const statusWorkflow: Record<OrderStatus, OrderStatus[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["quality_check", "revision", "cancelled"],
  quality_check: ["completed", "revision", "in_progress"],
  revision: ["in_progress", "cancelled"],
  completed: ["delivered", "revision"],
  delivered: [], 
  cancelled: [],
  // ── New Pipeline Transitions ──────────────────────────────────────
  pending_upfront: ["cancelled"], // Moves to 'active' via webhook
  active: ["pending_delivery", "cancelled"], // Staff triggers delivery
  pending_delivery: ["cancelled"], // Moves to 'delivered' via webhook
  pending_final: ["completed"], // Moves to 'completed' via webhook
};

// Helper function to check if a status transition is allowed
const canTransitionTo = (
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
): boolean => {
  if (currentStatus === targetStatus) return false; // Can't transition to same status
  return statusWorkflow[currentStatus]?.includes(targetStatus) || false;
};

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
  const { data: session } = useSession();
  const { data: meData } = useGetMeQuery({});
  const isTelemarketer = useMemo(() => {
    return (
      (session?.user?.role === Role.STAFF ||
        session?.user?.role === Role.TEAM_LEADER) &&
      meData?.staff?.designation?.toLowerCase() === "telemarketer"
    );
  }, [session, meData]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<OrderFilters>({
    search: "",
    status: undefined,
    priority: undefined,
    clientId: undefined,
    limit: 10,
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

  // Email dialog state
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailPendingOrder, setEmailPendingOrder] = useState<IOrder | null>(
    null,
  );
  const [emailPendingStatus, setEmailPendingStatus] =
    useState<OrderStatus | null>(null);
  const [isEmailSending, setIsEmailSending] = useState(false);

  const confirmEmailAndStatusChange = async (
    message: string,
    downloadLink?: string,
    selectedEmails?: string[],
  ) => {
    if (!emailPendingOrder || !emailPendingStatus) return;
    setIsEmailSending(true);
    try {
      await updateOrderStatus({
        id: emailPendingOrder._id,
        data: {
          status: emailPendingStatus,
          customEmailMessage: message,
          downloadLink,
          sendEmail: true,
          selectedEmails,
        } as UpdateStatusInput,
      }).unwrap();
      toast.success(
        `Status updated to ${ORDER_STATUS_LABELS[emailPendingStatus]} and email sent!`,
      );
      setIsEmailDialogOpen(false);
      setEmailPendingOrder(null);
      setEmailPendingStatus(null);
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      toast.error(err?.data?.message || "Failed to update status & send email");
    } finally {
      setIsEmailSending(false);
    }
  };

  // Date filter state
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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
  const {
    data: orderData,
    isLoading,
    isFetching,
    refetch,
  } = useGetOrdersQuery({
    ...filters,
    page,
    month: selectedMonth ? parseInt(selectedMonth) : undefined,
    year: selectedYear ? parseInt(selectedYear) : undefined,
  });
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
  const [triggerGetAll, { isLoading: isLoadingAll }] = useLazyGetOrdersQuery();

  const orders = useMemo(() => orderData?.data || [], [orderData]);
  const meta = orderData?.meta;
  const stats = statsData?.data;
  const clients = useMemo(() => clientsData?.clients || [], [clientsData]);

  // Self-heal: in environments where the payment webhook worker isn't running,
  // orders may not be backfilled even after upfront payment is confirmed.
  // If we see 0 orders, run a single reconcile pass and refetch.
  const reconcileAttemptedRef = useRef(false);
  useEffect(() => {
    if (reconcileAttemptedRef.current) return;
    if (isLoading || isFetching) return;
    if (!meta) return;
    if (meta.total > 0) return;

    reconcileAttemptedRef.current = true;
    (async () => {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/quotation-payments/reconcile-orders`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );
      } catch {
        // best-effort
      } finally {
        refetch();
      }
    })();
  }, [isLoading, isFetching, meta, refetch]);

  // Check if all current page orders are selected
  const allOrdersSelected = useMemo(() => {
    return (
      orders.length > 0 &&
      orders.every((order) => selectedOrderIds.has(order._id))
    );
  }, [orders, selectedOrderIds]);

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

  // Toggle all orders on current page
  const toggleAllOrders = (checked: boolean) => {
    setSelectedOrderIds((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        orders.forEach((order) => newSet.add(order._id));
      } else {
        // If unchecking "Select All Page", we should probably clear specific page IDs
        // But if "All Total" was selected, user expects to clear just this page?
        // Standard behavior: Uncheck header = Uncheck all visible.
        orders.forEach((order) => newSet.delete(order._id));
      }
      return newSet;
    });
  };

  const handleSelectAllMatches = async () => {
    if (!meta) return;
    try {
      const result = await triggerGetAll({
        ...filters,
        limit: meta.total,
        month: selectedMonth ? parseInt(selectedMonth) : undefined,
        year: selectedYear ? parseInt(selectedYear) : undefined,
      }).unwrap();

      if (result.data) {
        const allIds = result.data.map((o) => o._id);
        setSelectedOrderIds(new Set(allIds));
        toast.success(`All ${allIds.length} orders selected`);
      }
    } catch (error) {
      console.error("Failed to select all", error);
      toast.error("Failed to select all orders");
    }
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
    setPage(1);
  };

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

    // Feature: send emails on specific status changes
    if (["cancelled", "completed", "delivered"].includes(newStatus)) {
      const orderObj = orderData?.data.find((o) => o._id === orderId);
      if (orderObj) {
        setEmailPendingStatus(newStatus);
        setEmailPendingOrder(orderObj);
        setIsEmailDialogOpen(true);
        return;
      }
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
    setSelectedOrder(order);
    setIsViewDialogOpen(true);
  };

  const openTimelineDialog = (order: IOrder) => {
    setSelectedOrder(order);
    setIsTimelineDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Orders Card */}
        <div className="group relative overflow-hidden rounded-2xl border bg-linear-to-br from-slate-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-slate-500/5 hover:border-slate-500/30">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-slate-500/10 blur-2xl transition-all duration-300 group-hover:bg-slate-500/20" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-slate-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-slate-500/20">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-slate-600 dark:text-slate-300">
              {stats?.total || 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Total Orders</p>
          </div>
        </div>

        {/* Pending Card */}
        <div className="group relative overflow-hidden rounded-2xl border bg-linear-to-br from-yellow-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/5 hover:border-yellow-500/30">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-yellow-500/10 blur-2xl transition-all duration-300 group-hover:bg-yellow-500/20" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-yellow-500/20">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-yellow-600 dark:text-yellow-400">
              {stats?.pending || 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </div>
        </div>

        {/* In Progress Card */}
        <div className="group relative overflow-hidden rounded-2xl border bg-linear-to-br from-blue-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-500/30">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-blue-500/10 blur-2xl transition-all duration-300 group-hover:bg-blue-500/20" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/20">
                <Loader className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {stats?.inProgress || 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">In Progress</p>
          </div>
        </div>

        {/* Quality Check Card */}
        <div className="group relative overflow-hidden rounded-2xl border bg-linear-to-br from-purple-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/5 hover:border-purple-500/30">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-purple-500/10 blur-2xl transition-all duration-300 group-hover:bg-purple-500/20" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-purple-500/20">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {stats?.qualityCheck || 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Quality Check</p>
          </div>
        </div>
      </div>

      {/* Stats Cards - Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Revision Card */}
        <div className="group relative overflow-hidden rounded-2xl border bg-linear-to-br from-orange-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-500/30">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-orange-500/10 blur-2xl transition-all duration-300 group-hover:bg-orange-500/20" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-orange-500/20">
                <RotateCcw className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
              {stats?.revision || 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Revision</p>
          </div>
        </div>

        {/* Completed Card */}
        <div className="group relative overflow-hidden rounded-2xl border bg-linear-to-br from-green-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/5 hover:border-green-500/30">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-green-500/10 blur-2xl transition-all duration-300 group-hover:bg-green-500/20" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-green-500/20">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
              {stats?.completed || 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </div>
        </div>

        {/* Delivered Card */}
        <div className="group relative overflow-hidden rounded-2xl border bg-linear-to-br from-emerald-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-500/30">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-emerald-500/10 blur-2xl transition-all duration-300 group-hover:bg-emerald-500/20" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-emerald-500/20">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats?.delivered || 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Delivered</p>
          </div>
        </div>

        {/* Overdue Card */}
        <div className="group relative overflow-hidden rounded-2xl border bg-linear-to-br from-red-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/5 hover:border-red-500/30">
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-red-500/10 blur-2xl transition-all duration-300 group-hover:bg-red-500/20" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-red-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-red-600 dark:text-red-400">
              {stats?.overdue || 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Overdue</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Order Management</CardTitle>
            <CardDescription>
              Manage graphic design orders and track their status
            </CardDescription>
          </div>
          <div className="flex gap-3">
            {/* Select Mode Toggle Button (Hidden for telemarketers) */}
            {!isTelemarketer &&
              (!isSelectionMode ? (
                <Button
                  variant="outline"
                  onClick={() => setIsSelectionMode(true)}
                >
                  <CheckSquare className=" h-4 w-4" />
                  Select
                </Button>
              ) : (
                <Button variant="outline" onClick={clearSelection}>
                  <X className=" h-4 w-4" />
                  Cancel
                </Button>
              ))}
            <Button variant="outline" asChild>
              <Link href="/orders/invoice">
                <FileText className=" h-4 w-4" />
                Generate Invoice
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/quotations">
                <IconReceipt className=" h-4 w-4" />
                Quotation Pipeline
              </Link>
            </Button>
            {/* Manual Add Order is disabled - redirect to Quotations */}
            <Button asChild>
              <Link href="/quotations/new">
                <Plus />
                New Quotation
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
            </div>
            <TooltipProvider>
              <div className="flex flex-wrap gap-4 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={filters.search || ""}
                    onChange={(e) =>
                      handleFilterChange("search", e.target.value)
                    }
                    className="pl-9 bg-background"
                  />
                </div>

                {/* Month Filter */}
                <Select
                  value={selectedMonth}
                  onValueChange={(value) => {
                    setSelectedMonth(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="bg-background w-[140px]">
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Year Filter */}
                <Select
                  value={selectedYear}
                  onValueChange={(value) => {
                    setSelectedYear(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="bg-background w-[120px]">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select
                  value={filters.status || ""}
                  onValueChange={(value) =>
                    handleFilterChange("status", value as OrderStatus)
                  }
                >
                  <SelectTrigger className="bg-background w-[140px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_STATUS_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>

                {/* Priority Filter */}
                <Select
                  value={filters.priority || ""}
                  onValueChange={(value) =>
                    handleFilterChange("priority", value as OrderPriority)
                  }
                >
                  <SelectTrigger className="bg-background w-[140px]">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORDER_PRIORITY_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>

                {/* Client Filter */}
                <Select
                  value={filters.clientId || ""}
                  onValueChange={(value) =>
                    handleFilterChange("clientId", value)
                  }
                >
                  <SelectTrigger className="bg-background w-[140px]">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client._id} value={client._id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear Filters Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setFilters({
                          search: "",
                          status: undefined,
                          priority: undefined,
                          clientId: undefined,
                          limit: 10,
                        });
                        setSelectedMonth("");
                        setSelectedYear("");
                        setPage(1);
                      }}
                      className="bg-background"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear Filters</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          {/* Selection Action Bar */}
          {isSelectionMode && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/20">
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
                    <X className="h-3 w-3 mr-1" />
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
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete ({selectedOrderIds.size})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Select All Matching Banner */}
          {isSelectionMode &&
            allOrdersSelected &&
            meta &&
            meta.total > selectedOrderIds.size && (
              <div className="flex items-center justify-center p-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg text-sm text-blue-600 dark:text-blue-400">
                <span>
                  All {orders.length} orders on this page are selected.
                </span>
                <Button
                  variant="link"
                  className="ml-2 h-auto p-0 font-semibold"
                  onClick={handleSelectAllMatches}
                  disabled={isLoadingAll}
                >
                  {isLoadingAll ? (
                    <>
                      <Loader className=" h-3 w-3 animate-spin" />
                      Selecting all {meta.total} orders...
                    </>
                  ) : (
                    `Select all ${meta.total} orders`
                  )}
                </Button>
              </div>
            )}

          {/* Table */}
          <div className="border">
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="border-r">Name</TableHead>
                    <TableHead className="border-r">Client</TableHead>
                    <TableHead className="border-r">Time Left</TableHead>
                    <TableHead className="border-r">Qty</TableHead>
                    <TableHead className="border-r">Total</TableHead>
                    <TableHead className="border-r">Status</TableHead>
                    <TableHead className="border-r">Priority</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="border-r">
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="border-r">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="border-r">
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell className="border-r">
                        <Skeleton className="h-4 w-10" />
                      </TableCell>
                      <TableCell className="border-r">
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell className="border-r">
                        <Skeleton className="h-6 w-20" />
                      </TableCell>
                      <TableCell className="border-r">
                        <Skeleton className="h-6 w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {isSelectionMode && (
                      <TableHead className="w-[50px] px-4">
                        <Checkbox
                          checked={allOrdersSelected}
                          onCheckedChange={(checked) =>
                            toggleAllOrders(!!checked)
                          }
                          aria-label="Select all orders"
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-[100px] font-semibold">
                      Order ID
                    </TableHead>
                    <TableHead className="font-semibold">Client</TableHead>
                    <TableHead className="font-semibold">
                      Project / Service
                    </TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="text-center font-semibold">
                      Items
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Total
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold">
                      Created Date
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isSelectionMode ? 10 : 9}
                        className="h-[400px] text-center"
                      >
                        <div className="flex flex-col items-center justify-center gap-4 animate-in fade-in zoom-in duration-300">
                          <div className="rounded-2xl bg-muted/50 p-6 ring-1 ring-border">
                            <Package className="h-12 w-12 text-muted-foreground/50" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-xl font-semibold tracking-tight">
                              No orders found
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-[300px] mx-auto">
                              We couldn&apos;t find any orders matching your
                              current filters. Try adjusting them or create a
                              new order.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(true)}
                            className="mt-2"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create New Order
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order: IOrder) => (
                      <TableRow
                        key={order._id}
                        className={cn(
                          "group transition-colors",
                          isSelectionMode &&
                            selectedOrderIds.has(order._id) &&
                            "bg-primary/5 hover:bg-primary/10",
                        )}
                      >
                        {isSelectionMode && (
                          <TableCell className="px-4">
                            <Checkbox
                              checked={selectedOrderIds.has(order._id)}
                              onCheckedChange={() =>
                                toggleOrderSelection(order._id)
                              }
                              aria-label={`Select ${order.title || order.orderName}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          #{order._id.slice(-6)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">
                              {typeof order.clientId === "object"
                                ? order.clientId.name
                                : "N/A"}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-tight">
                              {typeof order.clientId === "object"
                                ? order.clientId.clientId
                                : "ID N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {order.title ||
                              order.orderName ||
                              "Untitled Project"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="capitalize text-[10px] h-5 px-1.5 font-bold tracking-wide"
                          >
                            {order.orderType || "Service"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                            {order.items?.length || 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-sm">
                            $
                            {(
                              order.totalAmount ||
                              order.totalPrice ||
                              0
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Select
                              value={order.status}
                              onValueChange={(value) =>
                                handleStatusChange(
                                  order._id,
                                  value as OrderStatus,
                                )
                              }
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-7 w-[120px] text-[10px] font-bold uppercase tracking-wider border-none ring-0 focus:ring-0",
                                  ORDER_STATUS_COLORS[order.status],
                                )}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ORDER_STATUS_LABELS).map(
                                  ([value, label]) => (
                                    <SelectItem
                                      key={value}
                                      value={value}
                                      disabled={
                                        !canTransitionTo(
                                          order.status,
                                          value as OrderStatus,
                                        )
                                      }
                                      className="text-xs uppercase tracking-wider"
                                    >
                                      {label}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[12px] whitespace-nowrap">
                          {safeFormat(
                            order.createdAt || order.orderDate,
                            "MMM dd, yyyy",
                          )}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <div className="flex items-center justify-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openViewDialog(order)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Details</p>
                                </TooltipContent>
                              </Tooltip>

                              {(!isTelemarketer ||
                                (isTelemarketer &&
                                  (typeof order.clientId === "object"
                                    ? order.clientId.createdBy?._id
                                    : order.clientId) ===
                                    session?.user?.id)) && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => openEditDialog(order)}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Edit Order</p>
                                    </TooltipContent>
                                  </Tooltip>

                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                        onClick={() => {
                                          setSelectedOrder(order);
                                          setIsDeleteDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Delete Order</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openTimelineDialog(order)}
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Timeline</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {meta && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-sm text-muted-foreground">
                  Page {meta.page} of {Math.max(1, meta.totalPages)} (
                  {meta.total} total)
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                    value={`${filters.limit || 10}`}
                    onValueChange={(value) => {
                      handleFilterChange("limit", Number(value));
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={filters.limit || 10} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[10, 20, 30, 40, 50].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                >
                  <ChevronLeft className="h-4 w-4 " />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(meta.totalPages, p + 1))
                  }
                  disabled={page >= meta.totalPages || isFetching}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
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
              {isExtending && <Loader className="h-4 w-4  animate-spin" />}
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
              {isAddingRevision && <Loader className="h-4 w-4  animate-spin" />}
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
              {isUpdatingStatus && <Loader className="h-4 w-4  animate-spin" />}
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
              {isDeleting && <Loader className="h-4 w-4  animate-spin" />}
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
              {isBulkDeleting && <Loader className="h-4 w-4  animate-spin" />}
              Delete {selectedOrderIds.size} Order
              {selectedOrderIds.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Notification Dialog */}
      <EmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        order={emailPendingOrder}
        status={emailPendingStatus as OrderStatus}
        onSend={confirmEmailAndStatusChange}
        isLoading={isEmailSending}
      />
    </div>
  );
}
