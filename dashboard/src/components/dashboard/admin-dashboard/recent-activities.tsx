"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Calendar, Users, Clock, Activity, ArrowRight } from "lucide-react";
import type { RecentActivity } from "@/types/dashboard.type";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface RecentActivitiesProps {
  activities: RecentActivity[];
}

const activityIcons: Record<string, any> = {
  attendance: UserCheck,
  shift: Calendar,
  staff: Users,
  leave: Clock,
};

const activityColors: Record<string, string> = {
  attendance: "text-blue-500 bg-blue-500/10",
  shift: "text-emerald-500 bg-emerald-500/10",
  staff: "text-primary bg-primary/10",
  leave: "text-pink-500 bg-pink-500/10",
};

export function RecentActivities({ activities }: RecentActivitiesProps) {
  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            Live Audit & Team Activity
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Latest operational events across staff and system
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No recent activities recorded today
            </div>
          ) : (
            activities.slice(0, 6).map((activity) => {
              const Icon = activityIcons[activity.type] || Activity;
              const colorClass = activityColors[activity.type] || "text-primary bg-primary/10";
              const userName = activity.user?.name || "Team Member";
              const initials = userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={activity._id}
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-[11px] font-bold bg-muted text-muted-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-bold text-foreground truncate">
                          {userName}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                          {activity.type}
                        </Badge>
                      </div>
                      <span
                        className="text-[10px] text-muted-foreground shrink-0 font-medium"
                        suppressHydrationWarning
                      >
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
