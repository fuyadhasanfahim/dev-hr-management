"use client";

import * as React from "react";
import { Label, Pie, PieChart, Cell } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { AttendanceOverview } from "@/types/dashboard.type";
import { UserCheck, Clock, AlertTriangle, PlaneTakeoff, Users } from "lucide-react";

interface AttendanceOverviewChartProps {
  data: AttendanceOverview;
}

const chartConfig = {
  present: {
    label: "Present",
    color: "#10b981",
    icon: UserCheck,
  },
  late: {
    label: "Late",
    color: "#f59e0b",
    icon: Clock,
  },
  absent: {
    label: "Absent",
    color: "#ef4444",
    icon: AlertTriangle,
  },
  onLeave: {
    label: "On Leave",
    color: "#3b82f6",
    icon: PlaneTakeoff,
  },
} satisfies ChartConfig;

export function AttendanceOverviewChart({
  data,
}: AttendanceOverviewChartProps) {
  const chartData = React.useMemo(() => {
    return [
      {
        status: "present",
        count: data.present,
        fill: "var(--color-present)",
      },
      {
        status: "late",
        count: data.late,
        fill: "var(--color-late)",
      },
      {
        status: "absent",
        count: data.absent,
        fill: "var(--color-absent)",
      },
      {
        status: "onLeave",
        count: data.onLeave,
        fill: "var(--color-onLeave)",
      },
    ].filter((item) => item.count > 0);
  }, [data]);

  const totalVisitors = React.useMemo(() => {
    return (data.present || 0) + (data.late || 0) + (data.absent || 0) + (data.onLeave || 0) || data.total || 0;
  }, [data]);

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="items-center pb-2">
        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
          <UserCheck className="size-5 text-emerald-500" />
          Today&apos;s Attendance
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Live staff presence and status distribution
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[220px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span className="capitalize text-muted-foreground">{name}:</span>
                      <span className="font-semibold text-foreground">
                        {value} staff
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              innerRadius={58}
              outerRadius={82}
              strokeWidth={3}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-2xl sm:text-3xl font-extrabold"
                        >
                          {totalVisitors.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-xs"
                        >
                          Total Active
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent />} />
          </PieChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className="flex-col gap-2 pt-4 pb-4 text-xs">
        <div className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg bg-muted/40 border border-border/50">
          <span className="text-muted-foreground font-medium">Turnout Rate:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {data.presentPercentage.toFixed(1)}%
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
