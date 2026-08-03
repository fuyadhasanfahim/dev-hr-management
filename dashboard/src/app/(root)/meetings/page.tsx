'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGetMeetingsQuery } from '@/redux/features/meeting/meetingApi';
import { useGetClientsQuery } from '@/redux/features/client/clientApi';
import { Button } from '@/components/ui/button';
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
import { Loader, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { MeetingFilters } from '@/components/meeting/MeetingFilters';
import { MeetingTable, ScheduleMeetingDialog } from '@/components/meeting/MeetingTable';
import { MeetingPagination } from '@/components/meeting/MeetingPagination';

export default function MeetingsPage() {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [statusFilter, setStatusFilter] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [search, setSearch] = useState('');

    const { data, isLoading, isFetching, refetch } = useGetMeetingsQuery({
        page,
        limit,
        status: statusFilter || undefined,
        clientId: clientFilter || undefined,
    });

    const { data: allMeetingsData } = useGetMeetingsQuery({ limit: 1000 });
    const allMeetings = useMemo(() => allMeetingsData?.data || [], [allMeetingsData]);

    const stats = useMemo(() => {
        return {
            total: allMeetings.length,
            active: allMeetings.filter((m) => m.status === 'scheduled').length,
            done: allMeetings.filter((m) => m.status === 'completed').length,
            missed: allMeetings.filter((m) => m.status === 'cancelled').length,
        };
    }, [allMeetings]);

    const { data: clientsData } = useGetClientsQuery({ limit: 200 });
    const clients = clientsData?.clients || [];

    const meetings = useMemo(() => data?.data || [], [data]);
    const meta = data?.meta || { page: 1, total: 0, totalPages: 1 };

    const filteredMeetings = useMemo(() => {
        if (!search) return meetings;
        const q = search.toLowerCase();
        return meetings.filter(
            (m) =>
                m.meetingTitle.toLowerCase().includes(q) ||
                (typeof m.clientId === 'object' && m.clientId.name.toLowerCase().includes(q)),
        );
    }, [meetings, search]);

    const handleClearFilters = () => {
        setSearch('');
        setStatusFilter('');
        setClientFilter('');
        setPage(1);
    };

    const meetingStats = useMemo(
        () => [
            {
                description: 'Total Scheduled',
                value: stats.total,
                trend: 'up' as const,
                trendLabel: 'All',
                footerTitle: 'All meetings recorded',
            },
            {
                description: 'Upcoming Meetings',
                value: stats.active,
                trend: 'up' as const,
                trendLabel: 'Active',
                footerTitle: 'Scheduled and upcoming',
            },
            {
                description: 'Completed Meetings',
                value: stats.done,
                trend: 'up' as const,
                trendLabel: 'Done',
                footerTitle: 'Successfully held',
            },
            {
                description: 'Cancelled Meetings',
                value: stats.missed,
                trend: 'down' as const,
                trendLabel: 'Missed',
                footerTitle: 'Cancelled meetings',
            },
        ],
        [stats],
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
                        Meetings Overview
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                        Track, manage, and schedule client meetings
                        {(isLoading || isFetching) && (
                            <Loader className="h-3 w-3 animate-spin text-primary" />
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
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
                    <ScheduleMeetingDialog clients={clients} />
                </div>
            </div>

            {/* ── Stats Strip ──────────────────────────────────────────── */}
            <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
                {meetingStats.map((stat) => {
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
                    <MeetingFilters
                        search={search}
                        status={statusFilter}
                        clientId={clientFilter}
                        clients={clients}
                        onSearchChange={setSearch}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        onClientChange={(v) => {
                            setClientFilter(v);
                            setPage(1);
                        }}
                        onClearFilters={handleClearFilters}
                    />
                </div>
            </Card>

            {/* ── Table Card ───────────────────────────────────────────── */}
            <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <MeetingTable meetings={filteredMeetings} isLoading={isLoading} />
                </div>

                <Separator />

                {/* Footer: Count + Pagination */}
                <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
                    <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                        Showing{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {filteredMeetings.length}
                        </span>{' '}
                        of{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {meta.total}
                        </span>{' '}
                        meetings
                    </p>
                    <MeetingPagination
                        currentPage={page}
                        totalPages={meta.totalPages}
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
