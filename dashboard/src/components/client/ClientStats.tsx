import { Users, UserCheck, UserX, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface ClientStatsProps {
    total: number;
    active: number;
    inactive: number;
    newClients?: number;
    isLoading: boolean;
}

export function ClientStats({ total, active, inactive, newClients = 0, isLoading }: ClientStatsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Clients */}
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 shadow-sm">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Clients</p>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16 mt-1" />
                        ) : (
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{total}</h3>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Active Clients */}
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 shadow-sm">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Clients</p>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16 mt-1" />
                        ) : (
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{active}</h3>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Inactive Clients */}
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 shadow-sm">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-orange-50 text-orange-500 dark:bg-orange-950/40 dark:text-orange-400">
                        <UserX className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Inactive Clients</p>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16 mt-1" />
                        ) : (
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{inactive}</h3>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* New Clients */}
            <Card className="rounded-xl border-slate-200 dark:border-slate-800 shadow-sm">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">New This Month</p>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16 mt-1" />
                        ) : (
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{newClients}</h3>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
