"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CheckCircle2, ListTodo, Layers } from "lucide-react";
import { TaskItem } from "@/redux/features/task/taskApi";

interface TeamTaskStatsChartProps {
  tasks: TaskItem[];
}

const chartConfig = {
  count: {
    label: "Tasks",
    color: "#4E12D4",
  },
} satisfies ChartConfig;

export function TeamTaskStatsChart({ tasks }: TeamTaskStatsChartProps) {
  const chartData = React.useMemo(() => {
    const counts: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      under_review: 0,
      revision: 0,
      completed: 0,
    };

    tasks.forEach((t) => {
      const s = t.status || "pending";
      if (counts[s] !== undefined) {
        counts[s]++;
      } else {
        counts.in_progress++;
      }
    });

    return [
      { status: "Pending", key: "pending", count: counts.pending, fill: "#f59e0b" },
      { status: "In Progress", key: "in_progress", count: counts.in_progress, fill: "#3b82f6" },
      { status: "In Review", key: "under_review", count: counts.under_review, fill: "#8b5cf6" },
      { status: "Revision", key: "revision", count: counts.revision, fill: "#ef4444" },
      { status: "Completed", key: "completed", count: counts.completed, fill: "#10b981" },
    ];
  }, [tasks]);

  const totalTasks = tasks.length;
  const completedCount = chartData.find((d) => d.key === "completed")?.count || 0;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Task Progress Pipeline
          </CardTitle>
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
            <CheckCircle2 className="size-3.5" />
            {completionRate}% Complete
          </div>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Status breakdown across your assigned team tasks
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {totalTasks === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
            No active tasks assigned yet
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[230px] w-full">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 15, right: 30, top: 10, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/40" />
              <YAxis
                dataKey="status"
                type="category"
                tickLine={false}
                axisLine={false}
                width={85}
                className="text-[11px] font-medium"
              />
              <XAxis type="number" hide />
              <ChartTooltip
                cursor={{ fill: "var(--accent)", opacity: 0.2 }}
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => (
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="text-muted-foreground">{item.payload.status}:</span>
                        <span className="font-semibold text-foreground">
                          {value} tasks
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[0, 8, 8, 0]}
                barSize={20}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
