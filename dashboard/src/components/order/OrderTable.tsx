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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, Edit2, Trash2, History, Receipt, Package } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getFilteredStatusOptions } from "@/constants/orderStatusWorkflow";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/constants";
import { usePermissions } from "@/hooks/use-permissions";
import type { IOrder, OrderStatus } from "@/types/order.type";

const STATUS_DOT_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  revision: "bg-orange-500",
  completed: "bg-green-500",
  delivered: "bg-emerald-500",
  cancelled: "bg-red-500",
};

const safeFormat = (
  dateStr: string | undefined | null,
  formatStr: string = "MMM dd, yyyy",
) => {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  return format(date, formatStr);
};

interface OrderTableProps {
  orders: IOrder[];
  isLoading: boolean;
  isSelectionMode: boolean;
  selectedOrderIds: Set<string>;
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string) => void;
  canSeeFinancials: boolean;
  canManage: (order: IOrder) => boolean;
  onView: (order: IOrder) => void;
  onReceipt: (order: IOrder) => void;
  onEdit: (order: IOrder) => void;
  onDelete: (order: IOrder) => void;
  onTimeline: (order: IOrder) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
}

export function OrderTable({
  orders,
  isLoading,
  isSelectionMode,
  selectedOrderIds,
  allSelected,
  onToggleAll,
  onToggleOne,
  canSeeFinancials,
  canManage,
  onView,
  onReceipt,
  onEdit,
  onDelete,
  onTimeline,
  onStatusChange,
}: OrderTableProps) {
  const { can } = usePermissions();
  const canChangeStatus = can("order.changeStatus");
  const canUpdate = can("order.update");
  const canDelete = can("order.delete");
  const canReceipt = can("receipt.create");
  const colCount = (isSelectionMode ? 1 : 0) + 10;

  return (
    <TooltipProvider delayDuration={300}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
            {isSelectionMode && (
              <TableHead className="w-10 pl-6">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onToggleAll(!!checked)}
                  aria-label="Select all orders"
                />
              </TableHead>
            )}
            <TableHead className={cn("text-xs font-semibold uppercase tracking-wider text-muted-foreground", !isSelectionMode && "pl-6")}>
              Order ID
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Client
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project / Service
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Type
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
              Items
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
              Total
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
              Payment
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
              Status
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Created
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
                {isSelectionMode && (
                  <TableCell className="pl-6">
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                )}
                <TableCell className={!isSelectionMode ? "pl-6" : undefined}>
                  <Skeleton className="h-3.5 w-[70px]" />
                </TableCell>
                <TableCell><Skeleton className="h-3.5 w-[100px]" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-[140px]" /></TableCell>
                <TableCell><Skeleton className="h-5 w-[70px] rounded-md" /></TableCell>
                <TableCell><Skeleton className="h-5 w-6 mx-auto rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-[70px] ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-6 w-[90px] mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-6 w-[100px] mx-auto rounded-md" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-[80px]" /></TableCell>
                <TableCell className="pr-6">
                  <div className="flex justify-end gap-1">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="h-40 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-brand-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No orders found matching your criteria.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => {
              const client = typeof order.clientId === "object" ? order.clientId : null;
              const phases = order.paymentPhases;

              let stage = "Upfront";
              let stageStyle =
                "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400";
              let pct = 0;

              if (phases) {
                const due =
                  (phases.upfront?.amountDue || 0) +
                  (phases.delivery?.amountDue || 0) +
                  (phases.final?.amountDue || 0);
                const paid =
                  (phases.upfront?.amountPaid || 0) +
                  (phases.delivery?.amountPaid || 0) +
                  (phases.final?.amountPaid || 0);
                pct =
                  typeof phases.totalPercentage === "number"
                    ? phases.totalPercentage
                    : due > 0
                      ? Math.min(100, Math.floor((paid / due) * 100))
                      : 0;

                if (phases.upfront?.status === "paid") {
                  stage = "Delivery";
                  stageStyle =
                    "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400";
                }
                if (phases.delivery?.status === "paid") {
                  stage = "Final";
                  stageStyle =
                    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400";
                }
                if (phases.final?.status === "paid") {
                  stage = "Paid";
                  stageStyle =
                    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400";
                }
              }

              return (
                <TableRow
                  key={order._id}
                  className="cursor-pointer"
                  onClick={() => onView(order)}
                >
                  {isSelectionMode && (
                    <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedOrderIds.has(order._id)}
                        onCheckedChange={() => onToggleOne(order._id)}
                        aria-label={`Select ${order.orderName || "Order"}`}
                      />
                    </TableCell>
                  )}

                  {/* Order ID */}
                  <TableCell className={!isSelectionMode ? "pl-6" : undefined}>
                    <span className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      #{order._id.slice(-6)}
                    </span>
                  </TableCell>

                  {/* Client */}
                  <TableCell>
                    <span className="text-sm font-medium text-foreground truncate max-w-[140px] block">
                      {client?.name || "N/A"}
                    </span>
                  </TableCell>

                  {/* Project / Service */}
                  <TableCell>
                    <span className="text-sm text-foreground/80 line-clamp-1 max-w-[200px] block">
                      {order.quotationSnapshot?.templateName ||
                        order.orderName ||
                        "Untitled Project"}
                    </span>
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="capitalize text-[10px] h-5 px-1.5 font-bold tracking-wide"
                    >
                      {order.orderType || "Service"}
                    </Badge>
                  </TableCell>

                  {/* Items */}
                  <TableCell>
                    <div className="flex justify-center">
                      <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                        {order.quotationSnapshot?.scopeOfWork?.length || 0}
                      </div>
                    </div>
                  </TableCell>

                  {/* Total */}
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "font-semibold text-sm",
                        !canSeeFinancials && "blur-[4px] select-none pointer-events-none",
                      )}
                    >
                      {order.quotationSnapshot?.currency === "USD"
                        ? "$"
                        : order.quotationSnapshot?.currency || "$"}
                      {(
                        order.quotationSnapshot?.grandTotal ||
                        order.totalAmount ||
                        order.totalPrice ||
                        0
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </TableCell>

                  {/* Payment */}
                  <TableCell>
                    {!phases ? (
                      <div className="text-center text-[10px] text-muted-foreground font-medium italic">
                        No Data
                      </div>
                    ) : (
                      <div className="space-y-1 w-full max-w-[110px] mx-auto">
                        <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
                          <span className={cn("px-1 rounded-[4px] border tracking-tight truncate uppercase", stageStyle)}>
                            {stage}
                          </span>
                          <span className={cn("font-mono tracking-tight", pct === 100 ? "text-emerald-600" : "text-foreground/80")}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-700 ease-out rounded-full",
                              pct === 100
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                                : "bg-gradient-to-r from-primary/90 to-primary",
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center">
                      <Select
                        value={order.status}
                        onValueChange={(value) => onStatusChange(order._id, value as OrderStatus)}
                        disabled={!canChangeStatus}
                      >
                        <SelectTrigger
                          size="sm"
                          className={cn(
                            "w-[135px] h-7 border-transparent text-[11px] font-semibold uppercase tracking-wide justify-center gap-1.5 shadow-none disabled:opacity-100",
                            ORDER_STATUS_COLORS[order.status],
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="center">
                          <SelectItem value={order.status}>
                            <span className="flex items-center gap-2">
                              <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT_COLORS[order.status])} />
                              {ORDER_STATUS_LABELS[order.status] ?? order.status}
                            </span>
                          </SelectItem>
                          {getFilteredStatusOptions(order).map((s) => (
                            <SelectItem key={s} value={s}>
                              <span className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT_COLORS[s])} />
                                {ORDER_STATUS_LABELS[s]}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>

                  {/* Created Date */}
                  <TableCell>
                    <span className="text-muted-foreground text-[12px] whitespace-nowrap">
                      {safeFormat(order.createdAt || order.orderDate)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onView(order)}
                            className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">View Details</TooltipContent>
                      </Tooltip>

                      {order.quotationGroupId && canReceipt && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onReceipt(order)}
                              className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Record a payment</TooltipContent>
                        </Tooltip>
                      )}

                      {canManage(order) && canUpdate && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(order)}
                              className="h-7 w-7 text-muted-foreground hover:text-brand-accent hover:bg-brand-accent/10"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Edit Order</TooltipContent>
                        </Tooltip>
                      )}
                      {canManage(order) && canDelete && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDelete(order)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Delete Order</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onTimeline(order)}
                            className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">View Timeline</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
