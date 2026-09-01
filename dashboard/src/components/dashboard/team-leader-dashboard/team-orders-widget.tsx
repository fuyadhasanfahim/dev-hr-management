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
import { Package, Clock, ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamOrdersWidget() {
  const { data: ordersData, isLoading } = useGetOrdersQuery(
    { page: 1, limit: 6 },
    { pollingInterval: 30000 }
  );

  const orders = ordersData?.data || [];

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Package className="size-5 text-primary" />
            Assigned Team Orders
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Active client projects under delivery
          </CardDescription>
        </div>
        <Link
          href="/orders"
          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          All Orders <ArrowRight className="size-3" />
        </Link>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : orders.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">
            No active orders found
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.slice(0, 5).map((order) => {
              const clientObj = typeof order.clientId === "object" ? order.clientId : null;
              const clientName = clientObj?.name || "Client";
              const deadlineDate = order.estimatedDeliveryDate
                ? new Date(order.estimatedDeliveryDate)
                : null;
              const isUrgent =
                deadlineDate &&
                order.status !== "completed" &&
                order.status !== "delivered" &&
                deadlineDate.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

              return (
                <div
                  key={order._id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-2 truncate">
                      <Link
                        href={"/orders/" + order._id}
                        className="text-xs font-bold text-foreground hover:text-primary truncate"
                      >
                        {order.quotationSnapshot?.templateName ||
                          order.quotationSnapshot?.details?.title ||
                          order.orderNumber ||
                          "Order"}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{clientName}</span>
                      {deadlineDate && (
                        <>
                          <span>•</span>
                          <span
                            className={
                              isUrgent
                                ? "text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-0.5"
                                : "text-muted-foreground flex items-center gap-0.5"
                            }
                          >
                            <Clock className="size-3" />
                            {format(deadlineDate, "MMM dd")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="text-[10px] capitalize shrink-0"
                  >
                    {order.status?.replace(/_/g, " ") || "Active"}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
