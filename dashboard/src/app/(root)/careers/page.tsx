'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Loader,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    useGetAllApplicationsQuery,
    useDeleteApplicationMutation,
    useGetApplicationsStatsQuery,
    useUpdateApplicationStatusMutation,
    useGetAllPositionsQuery,
} from '@/redux/features/career/careerApi';
import { ApplicationDetailsModal } from '@/components/careers/ApplicationDetailsModal';
import { CareerFilters } from '@/components/careers/CareerFilters';
import { CareerTable } from '@/components/careers/CareerTable';
import { CareerPagination } from '@/components/careers/CareerPagination';
import type { IJobApplication, ApplicationStatus } from '@/types/career.type';
import { APPLICATION_STATUS_LABELS } from '@/types/career.type';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';

export default function CareersPage() {
    // Filter states
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [experienceFilter, setExperienceFilter] = useState('');
    const [positionFilter, setPositionFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const debouncedSearch = useDebounce(search, 500);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter, experienceFilter, positionFilter]);

    // Modals state
    const [selectedApplication, setSelectedApplication] =
        useState<IJobApplication | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // Build query params
    const queryParams = useMemo(() => {
        const params: Record<string, unknown> = {
            page: currentPage,
            limit: pageSize,
        };
        if (debouncedSearch) params.search = debouncedSearch;
        if (statusFilter) params.status = statusFilter as ApplicationStatus;
        if (experienceFilter)
            params.hasExperience = experienceFilter === 'experienced';
        if (positionFilter) params.jobPosition = positionFilter;
        return params;
    }, [
        currentPage,
        pageSize,
        debouncedSearch,
        statusFilter,
        experienceFilter,
        positionFilter,
    ]);

    // API queries
    const {
        data: applicationsData,
        isLoading: applicationsLoading,
        isFetching,
    } = useGetAllApplicationsQuery(queryParams);
    const { data: statsData } = useGetApplicationsStatsQuery();
    const { data: positionsData } = useGetAllPositionsQuery();

    // Mutations
    const [deleteApplication] = useDeleteApplicationMutation();
    const [updateStatus] = useUpdateApplicationStatusMutation();

    const applications = applicationsData?.data || [];
    const meta = applicationsData?.meta;
    const stats = statsData?.data;
    const positions = positionsData?.data || [];

    const totalApplications = stats
        ? Object.values(stats.byStatus).reduce(
              (a: number, b: number) => a + b,
              0,
          )
        : 0;

    const handleFilterChange = (key: string, value: string) => {
        if (key === 'search') setSearch(value);
        if (key === 'status') setStatusFilter(value);
        if (key === 'experience') setExperienceFilter(value);
        if (key === 'position') setPositionFilter(value);
    };

    const handleClearFilters = () => {
        setSearch('');
        setStatusFilter('');
        setExperienceFilter('');
        setPositionFilter('');
        setCurrentPage(1);
    };

    const handleStatusChange = async (
        id: string,
        status: ApplicationStatus,
    ) => {
        try {
            await updateStatus({ id, status }).unwrap();
            toast.success(
                `Status updated to ${APPLICATION_STATUS_LABELS[status]}`,
            );
        } catch {
            toast.error('Failed to update status');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteApplication(deleteTarget).unwrap();
            toast.success('Application deleted successfully');
        } catch {
            toast.error('Failed to delete application');
        } finally {
            setDeleteTarget(null);
        }
    };

    const careerStats = useMemo(
        () => [
            {
                description: 'Total',
                value: totalApplications,
                trend: 'up' as const,
                trendLabel: 'All',
                footerTitle: 'All applications received',
            },
            {
                description: 'Pending',
                value: stats?.byStatus.pending || 0,
                trend: 'down' as const,
                trendLabel: 'Pending',
                footerTitle: 'Awaiting review',
            },
            {
                description: 'Reviewed',
                value: stats?.byStatus.reviewed || 0,
                trend: 'up' as const,
                trendLabel: 'Reviewed',
                footerTitle: 'Reviewed applications',
            },
            {
                description: 'Shortlisted',
                value: stats?.byStatus.shortlisted || 0,
                trend: 'up' as const,
                trendLabel: 'Shortlisted',
                footerTitle: 'Moved to shortlist',
            },
            {
                description: 'Hired',
                value: stats?.byStatus.hired || 0,
                trend: 'up' as const,
                trendLabel: 'Hired',
                footerTitle: 'Successfully hired',
            },
        ],
        [stats, totalApplications],
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen pb-10"
        >
            {/* ── Page Header ──────────────────────────────────────────── */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Careers
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                    Manage and review job applications
                    {(applicationsLoading || isFetching) && (
                        <Loader className="h-3 w-3 animate-spin text-primary" />
                    )}
                </p>
            </div>

            {/* ── Stats Strip ──────────────────────────────────────────── */}
            <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:grid-cols-5">
                {careerStats.map((stat) => {
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
                    <CareerFilters
                        search={search}
                        status={statusFilter}
                        experience={experienceFilter}
                        position={positionFilter}
                        positions={positions}
                        onFilterChange={handleFilterChange}
                        onClearFilters={handleClearFilters}
                    />
                </div>
            </Card>

            {/* ── Table Card ───────────────────────────────────────────── */}
            <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <CareerTable
                        applications={applications}
                        isLoading={applicationsLoading}
                        onView={setSelectedApplication}
                        onDelete={setDeleteTarget}
                        onStatusChange={handleStatusChange}
                    />
                </div>

                <Separator />

                {/* Footer: Count + Pagination */}
                <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
                    <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                        Showing{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {applications.length}
                        </span>{' '}
                        of{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {meta?.total ?? 0}
                        </span>{' '}
                        applications
                    </p>
                    <CareerPagination
                        currentPage={currentPage}
                        totalPages={meta?.totalPages ?? 1}
                        limit={pageSize}
                        onPageChange={setCurrentPage}
                        onLimitChange={(l) => {
                            setPageSize(l);
                            setCurrentPage(1);
                        }}
                        isLoading={isFetching}
                    />
                </CardContent>
            </Card>

            {/* Application Details Modal */}
            {selectedApplication && (
                <ApplicationDetailsModal
                    application={selectedApplication}
                    onClose={() => setSelectedApplication(null)}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the application.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    );
}
