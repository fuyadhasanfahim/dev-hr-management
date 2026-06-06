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
      bgColor: "bg-blue-50 dark:bg-blue-500/10",
      borderColor: "border-blue-100 dark:border-blue-900/40",
    },
    {
      title: "Active",
      value: active,
      icon: TrendingUp,
      color: "text-teal-600 dark:text-teal-400",
      bgColor: "bg-teal-50 dark:bg-teal-500/10",
      borderColor: "border-teal-100 dark:border-teal-900/40",
    },
    {
      title: "High Priority",
      value: highPriority,
      icon: AlertCircle,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-500/10",
      borderColor: "border-red-100 dark:border-red-900/40",
    },
    {
      title: "Converted",
      value: converted,
      icon: UserCheck,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-500/10",
      borderColor: "border-amber-100 dark:border-amber-900/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`flex items-center gap-3 p-3.5 rounded-xl border ${stat.borderColor} ${stat.bgColor} transition-colors`}
        >
          <div className={`shrink-0 ${stat.color}`}>
            <stat.icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {stat.title}
            </p>
            {isLoading ? (
              <Skeleton className="h-6 w-10 mt-0.5" />
            ) : (
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {stat.value}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
