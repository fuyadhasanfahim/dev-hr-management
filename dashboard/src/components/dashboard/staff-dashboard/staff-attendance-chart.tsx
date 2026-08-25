"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
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
import { Calendar } from "lucide-react";
import { IMonthlyAttendanceStats } from "@/types/attendance.type";

interface StaffAttendanceChartProps {
  stats?: IMonthlyAttendanceStats;
  isLoading?: boolean;
}

const chartConfig = {
  present: {
    label: "On-Time",
    color: "#10b981",
  },
  late: {
    label: "Late Arrivals",
    color: "#f59e0b",
  },
} satisfies ChartConfig;

export function StaffAttendanceChart({ stats, isLoading }: StaffAttendanceChartProps) {
  const onTimeCount = Math.max(0, (stats?.present || 0) - (stats?.late || 0));
  const lateCount = stats?.late || 0;

  const chartData = React.useMemo(() => {
    return [
      { status: "present", count: onTimeCount, fill: "var(--color-present)" },
      { status: "late", count: lateCount, fill: "var(--color-late)" },
    ].filter((item) => item.count > 0);
  }, [onTimeCount, lateCount]);

  const totalDays = stats?.present || 0;

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="items-center pb-2">
        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
          <Calendar className="size-5 text-primary" />
          Monthly Turnout ({stats?.month || "This Month"})
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          On-Time vs Late Check-in breakdown
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 pb-0">
        {totalDays === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
            No attendance records logged yet this month
          </div>
        ) : (
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
                        <span className="font-semibold text-foreground font-mono">
                          {value} days
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
                outerRadius={80}
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
                            {totalDays}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 20}
                            className="fill-muted-foreground text-xs"
                          >
                            Days Present
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
        )}
      </CardContent>

      <CardFooter className="pt-3 pb-4 text-xs flex justify-between items-center px-4 border-t border-border/40 mt-auto">
        <span className="text-muted-foreground font-medium">Total Days: {totalDays}</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          On-Time Rate: {totalDays > 0 ? ((onTimeCount / totalDays) * 100).toFixed(0) : 100}%
        </span>
      </CardFooter>
    </Card>
  );
}
