"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
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
import { Building2, Users } from "lucide-react";

interface DepartmentWorkloadChartProps {
  departments: { department: string; count: number }[];
  totalStaff: number;
}

const chartConfig = {
  count: {
    label: "Staff Members",
    color: "#4E12D4",
  },
} satisfies ChartConfig;

export function DepartmentWorkloadChart({
  departments,
  totalStaff,
}: DepartmentWorkloadChartProps) {
  const chartData = React.useMemo(() => {
    if (!departments || departments.length === 0) return [];
    return departments.map((d) => ({
      department: d.department || "General",
      count: d.count,
      percentage: totalStaff > 0 ? Math.round((d.count / totalStaff) * 100) : 0,
    }));
  }, [departments, totalStaff]);

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            Department Distribution
          </CardTitle>
          <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Users className="size-3.5" />
            {totalStaff} Total
          </div>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Staff strength allocation across organizational units
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
            No department data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[230px] w-full">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 10, right: 30, top: 10, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/40" />
              <YAxis
                dataKey="department"
                type="category"
                tickLine={false}
                axisLine={false}
                width={95}
                className="text-[11px] font-medium"
              />
              <XAxis type="number" hide />
              <ChartTooltip
                cursor={{ fill: "var(--accent)", opacity: 0.2 }}
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => (
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="text-muted-foreground">{item.payload.department}:</span>
                        <span className="font-semibold text-foreground">
                          {value} staff ({item.payload.percentage}%)
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
