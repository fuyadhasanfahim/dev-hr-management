import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, AlertCircle, TrendingUp } from "lucide-react";
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
  const stats = [
    {
      title: "Total Leads",
      value: total,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-500/10",
    },
    {
      title: "Active Leads",
      value: active,
      icon: TrendingUp,
      color: "text-teal-600 dark:text-teal-400",
      bgColor: "bg-teal-100 dark:bg-teal-500/10",
    },
    {
      title: "High Priority",
      value: highPriority,
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-500/10",
    },
    {
      title: "Converted to Client",
      value: converted,
      icon: UserCheck,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/40 overflow-hidden relative">
          <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-20 dark:opacity-30 ${stat.bgColor}`} />
          <CardContent className="p-5 flex items-center gap-4 relative z-10">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.bgColor} ${stat.color}`}
            >
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.title}</p>
              {isLoading ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : (
                <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {stat.value}
                </h4>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
