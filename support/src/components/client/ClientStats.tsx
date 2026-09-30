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

interface ClientStatsProps {
  total: number;
  active: number;
  inactive: number;
  newClients: number;
  isLoading: boolean;
}

export function ClientStats({
  total,
  active,
  inactive,
  newClients,
  isLoading,
}: ClientStatsProps) {
  const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
  const inactiveRate = total > 0 ? Math.round((inactive / total) * 100) : 0;

  const stats = [
    {
      description: "Total Clients",
      value: total,
      trend: "up" as const,
      trendLabel: "All",
      footerTitle: "All client relationships",
      footerSubtitle: "Across every status",
    },
    {
      description: "Active",
      value: active,
      trend: "up" as const,
      trendLabel: `${activeRate}%`,
      footerTitle: "Currently active clients",
      footerSubtitle: "Engaged and in service",
    },
    {
      description: "Inactive",
      value: inactive,
      trend: inactive > 0 ? ("down" as const) : ("up" as const),
      trendLabel: `${inactiveRate}%`,
      footerTitle: "Currently inactive clients",
      footerSubtitle: "Paused or dormant accounts",
    },
    {
      description: "New This Month",
      value: newClients,
      trend: "up" as const,
      trendLabel: "30d",
      footerTitle: "Recently onboarded",
      footerSubtitle: "Added in the last 30 days",
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
