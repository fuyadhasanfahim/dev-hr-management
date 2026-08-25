"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useGetFinanceAnalyticsQuery } from "@/redux/features/analytics/analyticsApi";
import { TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const chartConfig = {
  earnings: {
    label: "Earnings (Revenue)",
    color: "#4E12D4",
  },
  expenses: {
    label: "Expenses",
    color: "#ef4444",
  },
  profit: {
    label: "Net Profit",
    color: "#10b981",
  },
} satisfies ChartConfig;

export function FinancialPerformanceChart() {
  const currentYear = new Date().getFullYear();
  const { data: analytics, isLoading } = useGetFinanceAnalyticsQuery({
    year: currentYear,
    months: 12,
  });

  const chartData = React.useMemo(() => {
    if (!analytics?.monthlyTrends || analytics.monthlyTrends.length === 0) {
      // Fallback empty months for smooth rendering
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return months.map((m) => ({
        month: m,
        earnings: 0,
        expenses: 0,
        profit: 0,
      }));
    }

    return analytics.monthlyTrends.map((t) => ({
      month: t.monthName ? t.monthName.slice(0, 3) : `M${t.month}`,
      earnings: t.earnings || 0,
      expenses: t.expenses || 0,
      profit: Math.max(0, t.profit || 0),
    }));
  }, [analytics]);

  const summary = analytics?.summary;
  const totalEarnings = summary?.totalEarnings || 0;
  const totalExpenses = summary?.totalExpenses || 0;
  const totalProfit = summary?.totalProfit || 0;
  const isProfitPositive = totalProfit >= 0;

  const formatBDT = (amount: number) => {
    return `৳${amount.toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
  };

  if (isLoading) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="flex-1 min-h-[300px] flex items-center justify-center">
          <Skeleton className="w-full h-[250px]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 gap-2">
        <div>
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <DollarSign className="size-5 text-primary" />
            Financial Performance ({currentYear})
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Monthly Earnings vs. Expenses & Net Profit
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`gap-1 font-medium px-2.5 py-1 ${
              isProfitPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
            }`}
          >
            {isProfitPositive ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            Net: {formatBDT(totalProfit)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {/* Quick summary mini-cards */}
        <div className="grid grid-cols-3 gap-2 mb-4 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-center">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">Revenue</div>
            <div className="text-xs sm:text-sm font-bold text-primary truncate">
              {formatBDT(totalEarnings)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">Expenses</div>
            <div className="text-xs sm:text-sm font-bold text-destructive truncate">
              {formatBDT(totalExpenses)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">Margin</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate">
              {totalEarnings > 0 ? `${((totalProfit / totalEarnings) * 100).toFixed(1)}%` : "0%"}
            </div>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="fillEarnings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-earnings)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-earnings)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value}
              className="text-[11px]"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
              className="text-[11px]"
            />
            <ChartTooltip
              cursor={{ stroke: "rgba(0,0,0,0.1)", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span className="capitalize text-muted-foreground">{name}:</span>
                      <span className="font-semibold text-foreground font-mono">
                        {formatBDT(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="earnings"
              name="Earnings"
              stroke="var(--color-earnings)"
              fill="url(#fillEarnings)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="var(--color-expenses)"
              fill="url(#fillExpenses)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="profit"
              name="Net Profit"
              stroke="var(--color-profit)"
              fill="url(#fillProfit)"
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
