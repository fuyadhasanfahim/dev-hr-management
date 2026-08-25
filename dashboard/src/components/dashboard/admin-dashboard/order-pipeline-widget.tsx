"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGetOrdersQuery } from "@/redux/features/order/orderApi";
import { Package, ArrowRight } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export function OrderPipelineWidget() {
  const { data: ordersData, isLoading } = useGetOrdersQuery(
    { page: 1, limit: 10 },
    { pollingInterval: 30000 }
  );

  const orders = ordersData?.data || [];

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      const s = o.status || "pending";
      if (counts[s] !== undefined) {
        counts[s]++;
      } else {
        counts[s] = 1;
      }
    });
    return counts;
  }, [orders]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
            Completed
          </Badge>
        );
      case "delivered":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]">
            Delivered
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px]">
            In Progress
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[10px] capitalize">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader>
          <Skeleton className="h-6 w-36 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Package className="size-5 text-primary" />
            Order Operations
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Live order status & delivery tracker
          </CardDescription>
        </div>
        <Link
          href="/orders"
          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          View All <ArrowRight className="size-3" />
        </Link>
      </CardHeader>

      <CardContent className="flex-1 pb-4 space-y-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <div className="text-[10px] text-muted-foreground font-medium">Pending</div>
            <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
              {statusCounts.pending || 0}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-purple-500/5 border border-purple-500/20">
            <div className="text-[10px] text-muted-foreground font-medium">Progress</div>
            <div className="text-sm font-bold text-primary">
              {statusCounts.in_progress || 0}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <div className="text-[10px] text-muted-foreground font-medium">Delivered</div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {statusCounts.delivered || 0}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="text-[10px] text-muted-foreground font-medium">Completed</div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {statusCounts.completed || 0}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {orders.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No recent orders found
            </div>
          ) : (
            orders.slice(0, 4).map((order) => {
              const clientObj = typeof order.clientId === "object" ? order.clientId : null;
              const clientName = clientObj?.name || "Client";
              const deadlineDate = order.deadline ? new Date(order.deadline) : null;
              const isUrgent =
                deadlineDate &&
                order.status !== "completed" &&
                order.status !== "delivered" &&
                deadlineDate.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

              const orderPrice = order.totalPrice ?? order.totalAmount ?? 0;

              return (
                <div
                  key={order._id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/60 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-2 truncate">
                      <Link
                        href={"/orders/" + order._id}
                        className="text-xs font-bold text-foreground hover:text-primary truncate"
                      >
                        {order.orderName || order.title || order.orderNumber || "Order"}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{clientName}</span>
                      {orderPrice > 0 && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-foreground">
                            ${orderPrice.toLocaleString()}
                          </span>
                        </>
                      )}
                      {deadlineDate && (
                        <>
                          <span>•</span>
                          <span
                            className={
                              isUrgent ? "text-rose-500 font-semibold" : "text-muted-foreground"
                            }
                          >
                            Due {format(deadlineDate, "MMM dd")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">{getStatusBadge(order.status)}</div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
