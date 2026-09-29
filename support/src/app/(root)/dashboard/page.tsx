'use client';

import { Ticket, MessageSquare, CheckCircle, Clock, Inbox, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/dashboard/stat-card';
import {
    useGetDashboardStatsQuery,
    type DashboardStats,
    type ActivityItem,
} from '@/store/api/chatApi';

const ACTIVITY_META: Record<ActivityItem['type'], { icon: React.ElementType; color: string; label: string }> = {
    chat_new: { icon: MessageSquare, color: 'text-violet-500 bg-violet-500/10', label: 'chat' },
    chat_resolved: { icon: CheckCircle, color: 'text-emerald-500 bg-emerald-500/10', label: 'resolved' },
    ticket_new: { icon: Ticket, color: 'text-blue-500 bg-blue-500/10', label: 'ticket' },
};

function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return new Date(iso).toLocaleDateString();
}

function fmtCount(n: number | undefined): string {
    return typeof n === 'number' ? String(n) : '—';
}

function fmtAvgResponse(mins: number | null | undefined): string {
    // null/undefined → genuinely unavailable; show an em dash (no fabricated value).
    if (mins == null) return '—';
    if (mins < 1) return `${Math.round(mins * 60)}s`;
    return `${Math.round(mins)}m`;
}

function StatCardSkeleton() {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="size-8 rounded-xl" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-16" />
            </CardContent>
        </Card>
    );
}

export default function DashboardPage() {
    const { data, isLoading } = useGetDashboardStatsQuery(undefined, {
        pollingInterval: 30_000,
    });

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Welcome to the WebBriks Support Console.
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
                ) : (
                    <>
                        <StatCard title="Open Tickets" value={fmtCount(data?.openTickets)} icon={Ticket} variant="primary" />
                        <StatCard title="Live Chats" value={fmtCount(data?.liveChats)} icon={MessageSquare} variant="purple" />
                        <StatCard title="Resolved Today" value={fmtCount(data?.resolvedToday)} icon={CheckCircle} variant="success" />
                        <StatCard
                            title="Avg. Response Time"
                            value={fmtAvgResponse(data?.avgResponseTimeMinutes)}
                            icon={Clock}
                            variant="warning"
                        />
                    </>
                )}
            </div>

            {/* Recent Activity */}
            <Card className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                            <Activity className="size-5 text-primary" />
                            Recent Activity
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Latest chats, tickets and resolutions across the console
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="pb-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="size-8 rounded-full shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-3 w-3/4" />
                                        <Skeleton className="h-3 w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : data?.recentActivity && data.recentActivity.length > 0 ? (
                        <div className="space-y-2">
                            {data.recentActivity.map((item, i) => {
                                const meta = ACTIVITY_META[item.type] ?? {
                                    icon: Inbox,
                                    color: 'text-primary bg-primary/10',
                                    label: item.type,
                                };
                                const Icon = meta.icon;
                                return (
                                    <div
                                        key={`${item.type}-${item.at}-${i}`}
                                        className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/40 transition-colors"
                                    >
                                        <Avatar className="size-8 shrink-0">
                                            <AvatarFallback className={meta.color}>
                                                <Icon className="size-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                                                    {meta.label}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-foreground truncate">{item.label}</p>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                                            {relativeTime(item.at)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                <Inbox className="size-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-foreground">No recent activity</p>
                            <p className="text-xs text-muted-foreground mt-1">No recent activity yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
