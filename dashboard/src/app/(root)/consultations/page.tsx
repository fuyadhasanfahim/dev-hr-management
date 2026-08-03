'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    useGetConsultationsQuery,
    useGetConsultationStatsQuery,
} from '@/redux/features/consultation/consultationApi';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Loader, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { ConsultationFilters } from '@/components/consultation/ConsultationFilters';
import { ConsultationTable } from '@/components/consultation/ConsultationTable';
import { ConsultationPagination } from '@/components/consultation/ConsultationPagination';

export default function ConsultationsPage() {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');

    const { data, isLoading, isFetching, refetch } = useGetConsultationsQuery({
        page,
        limit,
        status: statusFilter || undefined,
        search: search || undefined,
    });

    const { data: statsData } = useGetConsultationStatsQuery();
    const stats = statsData?.data || { pending: 0, scheduled: 0, completed: 0, cancelled: 0, total: 0 };

    const consultations = data?.data?.consultations || [];
    const pagination = data?.data?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

    const handleFilterChange = (key: string, value: string) => {
        if (key === 'search') setSearch(value);
        if (key === 'status') setStatusFilter(value);
        setPage(1);
    };

    const handleClearFilters = () => {
        setSearch('');
        setStatusFilter('');
        setPage(1);
    };

    const consultationStats = useMemo(
        () => [
            {
                description: 'Pending Requests',
                value: stats.pending,
                trend: 'down' as const,
                trendLabel: 'New',
                footerTitle: 'Awaiting a response',
            },
            {
                description: 'Scheduled Meetings',
                value: stats.scheduled,
                trend: 'up' as const,
                trendLabel: 'Scheduled',
                footerTitle: 'Upcoming consultations',
            },
            {
                description: 'Completed',
                value: stats.completed,
                trend: 'up' as const,
                trendLabel: 'Done',
                footerTitle: 'Finished consultations',
            },
            {
                description: 'Cancelled',
                value: stats.cancelled,
                trend: 'down' as const,
                trendLabel: 'Cancelled',
                footerTitle: 'Cancelled requests',
            },
        ],
        [stats.pending, stats.scheduled, stats.completed, stats.cancelled],
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen pb-10"
        >
            {/* ── Page Header ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Consultations
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                        Manage consultation requests from AI chat and schedule meetings
                        {(isLoading || isFetching) && (
                            <Loader className="h-3 w-3 animate-spin text-primary" />
                        )}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => refetch()}
                    disabled={isFetching}
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* ── Stats Strip ──────────────────────────────────────────── */}
            <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
                {consultationStats.map((stat) => {
                    const TrendIcon = stat.trend === 'up' ? TrendingUp : TrendingDown;
                    return (
                        <Card key={stat.description} className="@container/card">
                            <CardHeader>
                                <CardDescription>{stat.description}</CardDescription>
                                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                    {stat.value}
                                </CardTitle>
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
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>

            {/* ── Filters Card ─────────────────────────────────────────── */}
            <Card className="mt-5 py-0 shadow-sm">
                <div className="px-5 py-4">
                    <ConsultationFilters
                        search={search}
                        status={statusFilter}
                        onFilterChange={handleFilterChange}
                        onClearFilters={handleClearFilters}
                    />
                </div>
            </Card>

            {/* ── Table Card ───────────────────────────────────────────── */}
            <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <ConsultationTable consultations={consultations} isLoading={isLoading} />
                </div>

                <Separator />

                {/* Footer: Count + Pagination */}
                <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
                    <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                        Showing{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {consultations.length}
                        </span>{' '}
                        of{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {pagination.total}
                        </span>{' '}
                        consultations
                    </p>
                    <ConsultationPagination
                        currentPage={page}
                        totalPages={pagination.totalPages}
                        limit={limit}
                        onPageChange={setPage}
                        onLimitChange={(l) => {
                            setLimit(l);
                            setPage(1);
                        }}
                        isLoading={isFetching}
                    />
                </CardContent>
            </Card>
        </motion.div>
    );
}
