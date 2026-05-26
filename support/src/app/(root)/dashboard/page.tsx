'use client';

import { useState, useEffect } from 'react';
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

interface StatCard {
    label: string;
    value: string;
    trend: number | null;
    icon: React.ElementType;
    color: string;
}

const STAT_CARDS: StatCard[] = [
    {
        label: 'Open Tickets',
        value: '—',
        trend: null,
        icon: Ticket,
        color: 'bg-blue-500/15 text-blue-500',
    },
    {
        label: 'Live Chats',
        value: '—',
        trend: null,
        icon: MessageSquare,
        color: 'bg-violet-500/15 text-violet-500',
    },
    {
        label: 'Resolved Today',
        value: '—',
        trend: null,
        icon: CheckCircle,
        color: 'bg-emerald-500/15 text-emerald-500',
    },
    {
        label: 'Avg. Response Time',
        value: '—',
        trend: null,
        icon: Clock,
        color: 'bg-amber-500/15 text-amber-500',
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 1200);
        return () => clearTimeout(t);
    }, []);

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
                {loading
                    ? STAT_CARDS.map((_, i) => <StatCardSkeleton key={i} />)
                    : STAT_CARDS.map((card) => {
                        const Icon = card.icon;
                        return (
                            <Card key={card.label} className="shadow-sm">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">{card.label}</p>
                                            <p className="text-3xl font-bold text-foreground">{card.value}</p>
                                            <TrendBadge trend={card.trend} />
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
                    {loading ? (
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
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                <Inbox className="size-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-foreground">No recent activity</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Activity will appear here once connected to the API.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
