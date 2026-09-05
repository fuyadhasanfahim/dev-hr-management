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
import { Eye, Receipt, Package } from "lucide-react";
import InvoicePdfButton from "@/components/shared/InvoicePdfButton";
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
  canSeeFinancials: boolean;
  onView: (order: IOrder) => void;
  onReceipt: (order: IOrder) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
}

export function OrderTable({
  orders,
  isLoading,
  canSeeFinancials,
  onView,
  onReceipt,
  onStatusChange,
}: OrderTableProps) {
  const { can } = usePermissions();
  const canChangeStatus = can("order.changeStatus");
  const canReceipt = can("receipt.create");
  const colCount = 9;

  return (
    <TooltipProvider delayDuration={300}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
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
                <TableCell className="pl-6">
                  <Skeleton className="h-3.5 w-[70px]" />
                </TableCell>
                <TableCell><Skeleton className="h-3.5 w-[100px]" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-[140px]" /></TableCell>
                <TableCell><Skeleton className="h-5 w-[70px] rounded-md" /></TableCell>
                <TableCell><Skeleton className="h-5 w-6 mx-auto rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-[70px] ml-auto" /></TableCell>
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
              const snap = order.quotationSnapshot;

              return (
                <TableRow
                  key={order._id}
                  className="cursor-pointer"
                  onClick={() => onView(order)}
                >
                  {/* Order ID */}
                  <TableCell className="pl-6">
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
                      {snap?.templateName ||
                        snap?.details?.title ||
                        order.orderNumber}
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
                        {snap?.services?.length ||
                          snap?.scopeOfWork?.length ||
                          0}
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
                      {snap?.currency === "USD" ? "$" : snap?.currency || "৳"}
                      {(snap?.grandTotal ?? order.totalPrice ?? 0).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}
                    </span>
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
                      {safeFormat(order.createdAt)}
                    </span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
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

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InvoicePdfButton
                            source="order"
                            id={order._id}
                            fileNameBase={(
                              order.quotationSnapshot?.quotationNumber ||
                              order.orderNumber ||
                              "invoice"
                            ).replace(/^QTN/i, "INV")}
                            iconOnly
                            className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Download Invoice</TooltipContent>
                      </Tooltip>

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
