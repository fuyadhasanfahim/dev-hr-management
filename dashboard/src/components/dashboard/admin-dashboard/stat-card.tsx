"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "purple";
  href?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = "default",
  href,
}: StatCardProps) {
  const variantStyles = {
    default: "border-border/60 hover:border-border",
    primary: "border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent",
    success: "border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent",
    warning: "border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent",
    danger: "border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-transparent to-transparent",
    purple: "border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent",
  };

  const iconStyles = {
    default: "text-muted-foreground bg-muted/60",
    primary: "text-primary bg-primary/10",
    success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    warning: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    danger: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
    purple: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
  };

  const cardContent = (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-default",
        variantStyles[variant],
        href && "cursor-pointer hover:border-primary/40 hover:scale-[1.01]"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-xl", iconStyles[variant])}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground font-medium">
            {description}
          </p>
        )}
        {trend && (
          <div className="pt-1">
            <span
              className={cn(
                "text-[11px] font-semibold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md",
                trend.isPositive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
            >
              <span>{trend.isPositive ? "↑" : "↓"}</span>
              <span>{Math.abs(trend.value)}%</span>
            </span>
            <span className="text-[11px] text-muted-foreground ml-1.5 font-medium">
              {trend.label || "from last month"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}
