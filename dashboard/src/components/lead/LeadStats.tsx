import { TrendingUp, TrendingDown } from "lucide-react";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface LeadStatsProps {
  total: number;
  highPriority: number;
  converted: number;
  active: number;
  isLoading: boolean;
}

export function LeadStats({
  total,
  highPriority,
  converted,
  active,
  isLoading,
}: LeadStatsProps) {
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  const stats = [
    {
      description: "Total Leads",
      value: total,
      trend: "up" as const,
      trendLabel: "+12.5%",
      footerTitle: "All prospects in your pipeline",
      footerSubtitle: "Across every status and source",
    },
    {
      description: "Active",
      value: active,
      trend: "up" as const,
      trendLabel: `${total > 0 ? Math.round((active / total) * 100) : 0}%`,
      footerTitle: "Currently being worked",
      footerSubtitle: "Not yet converted or closed",
    },
    {
      description: "High Priority",
      value: highPriority,
      trend: highPriority > 0 ? ("up" as const) : ("down" as const),
      trendLabel: total > 0 ? `${Math.round((highPriority / total) * 100)}%` : "0%",
      footerTitle: "Needs immediate attention",
      footerSubtitle: "Flagged as high priority",
    },
    {
      description: "Converted",
      value: converted,
      trend: "up" as const,
      trendLabel: `${conversionRate}%`,
      footerTitle: "Turned into clients",
      footerSubtitle: "Overall conversion rate",
    },
  ];

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
        return (
          <Card key={stat.description} className="@container/card">
            <CardHeader>
              <CardDescription>{stat.description}</CardDescription>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {stat.value}
                </CardTitle>
              )}
              <CardAction>
                <Badge variant="outline" className="text-primary border-primary/30">
                  <TrendIcon className="text-primary" />
                  {stat.trendLabel}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {stat.footerTitle}
                <TrendIcon className="size-4 text-primary" />
              </div>
              <div className="text-muted-foreground">{stat.footerSubtitle}</div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
