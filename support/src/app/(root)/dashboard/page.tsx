'use client';

import {
    Ticket,
    MessageSquare,
    CheckCircle,
    Clock,
    TrendingUp,
    TrendingDown,
    Minus,
    Inbox,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
    useGetDashboardStatsQuery,
    type DashboardStats,
    type ActivityItem,
} from '@/store/api/chatApi';

const ACTIVITY_ICON: Record<ActivityItem['type'], React.ElementType> = {
    chat_new: MessageSquare,
    chat_resolved: CheckCircle,
    ticket_new: Ticket,
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

interface StatCardMeta {
    label: string;
    icon: React.ElementType;
    color: string;
    // Pull the display value for this card from the stats payload.
    getValue: (d: DashboardStats | undefined) => string;
}

function fmtCount(n: number | undefined): string {
    return typeof n === 'number' ? String(n) : '—';
}

function fmtAvgResponse(mins: number | null | undefined): string {
    // null/undefined → genuinely unavailable; show an em dash (no fabricated trend).
    if (mins == null) return '—';
    if (mins < 1) return `${Math.round(mins * 60)}s`;
    return `${Math.round(mins)}m`;
}

const STAT_CARDS: StatCardMeta[] = [
    {
        label: 'Open Tickets',
        icon: Ticket,
        color: 'bg-blue-500/15 text-blue-500',
        getValue: (d) => fmtCount(d?.openTickets),
    },
    {
        label: 'Live Chats',
        icon: MessageSquare,
        color: 'bg-violet-500/15 text-violet-500',
        getValue: (d) => fmtCount(d?.liveChats),
    },
    {
        label: 'Resolved Today',
        icon: CheckCircle,
        color: 'bg-emerald-500/15 text-emerald-500',
        getValue: (d) => fmtCount(d?.resolvedToday),
    },
    {
        label: 'Avg. Response Time',
        icon: Clock,
        color: 'bg-amber-500/15 text-amber-500',
        getValue: (d) => fmtAvgResponse(d?.avgResponseTimeMinutes),
    },
];

function TrendBadge({ trend }: { trend: number | null }) {
    if (trend === null) return null;
    const positive = trend > 0;
    const neutral = trend === 0;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-[11px] font-medium',
                neutral
                    ? 'text-muted-foreground'
                    : positive
                        ? 'text-emerald-500'
                        : 'text-destructive',
            )}
        >
            {neutral ? (
                <Minus className="size-3" />
            ) : positive ? (
                <TrendingUp className="size-3" />
            ) : (
                <TrendingDown className="size-3" />
            )}
            {neutral ? 'No change' : `${Math.abs(trend)}% vs yesterday`}
        </span>
    );
}

function StatCardSkeleton() {
    return (
        <Card className="shadow-sm">
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="size-10 rounded-xl" />
                </div>
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
                {isLoading
                    ? STAT_CARDS.map((_, i) => <StatCardSkeleton key={i} />)
                    : STAT_CARDS.map((card) => {
                        const Icon = card.icon;
                        return (
                            <Card key={card.label} className="shadow-sm">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">{card.label}</p>
                                            <p className="text-3xl font-bold text-foreground">{card.getValue(data)}</p>
                                            {/* TODO: real trends need a day-over-day snapshot; keep null until then. */}
                                            <TrendBadge trend={null} />
                                        </div>
                                        <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0', card.color)}>
                                            <Icon className="size-5" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
            </div>

            {/* Recent Activity */}
            <Card className="shadow-sm">
                <CardContent className="p-5">
                    <p className="text-sm font-medium mb-4">Recent Activity</p>
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
                        <div className="space-y-1">
                            {data.recentActivity.map((item, i) => {
                                const ActIcon = ACTIVITY_ICON[item.type] ?? Inbox;
                                return (
                                    <div
                                        key={`${item.type}-${item.at}-${i}`}
                                        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                            <ActIcon className="size-4 text-muted-foreground" />
                                        </div>
                                        <p className="flex-1 text-sm text-foreground truncate">{item.label}</p>
                                        <span className="text-xs text-muted-foreground shrink-0">
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
                            <p className="text-xs text-muted-foreground mt-1">
                                No recent activity yet.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
