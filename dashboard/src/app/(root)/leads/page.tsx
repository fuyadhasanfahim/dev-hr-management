'use client';

import { useState, useMemo, Suspense, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    useGetLeadsQuery,
    useCreateLeadMutation,
    useUpdateLeadMutation,
} from '@/redux/features/lead/leadApi';
import { useGetLeadSettingsQuery } from '@/redux/features/lead/leadSettingApi';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Plus, Loader, FileDown, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { LeadForm, type LeadFormValues } from '@/components/lead/LeadForm';
import { usePermissions } from '@/hooks/use-permissions';
import { LeadSettingsDialog } from '@/components/lead/LeadSettingsDialog';
import { LeadStats } from '@/components/lead/LeadStats';
import { LeadFilters } from '@/components/lead/LeadFilters';
import { LeadTable } from '@/components/lead/LeadTable';
import { LeadPagination } from '@/components/lead/LeadPagination';
import { Lead } from '@/types/lead.type';

export default function LeadsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-[400px] items-center justify-center">
                    <Loader className="h-8 w-8 animate-spin text-brand-primary" />
                </div>
            }
        >
            <LeadsPageContent />
        </Suspense>
    );
}

function LeadsPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { can } = usePermissions();
    const canCreateLead = can('lead.create');

    // Local filter states initialized from searchParams
    const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1);
    const [limit, setLimit] = useState(() => Number(searchParams.get('limit')) || 20);
    const [search, setSearch] = useState(() => searchParams.get('search') || '');
    const [status, setStatus] = useState(() => searchParams.get('status') || '');
    const [priority, setPriority] = useState(() => searchParams.get('priority') || '');
    const [source, setSource] = useState(() => searchParams.get('source') || '');
    const [nextActionType, setNextActionType] = useState(() => searchParams.get('nextActionType') || '');
    const [nextActionDateFrom, setNextActionDateFrom] = useState(() => searchParams.get('nextActionDateFrom') || '');
    const [nextActionDateTo, setNextActionDateTo] = useState(() => searchParams.get('nextActionDateTo') || '');

    // Synchronize URL changes (e.g. back/forward browser navigation) with local states
    useEffect(() => {
        setPage(Number(searchParams.get('page')) || 1);
        setLimit(Number(searchParams.get('limit')) || 20);
        setSearch(searchParams.get('search') || '');
        setStatus(searchParams.get('status') || '');
        setPriority(searchParams.get('priority') || '');
        setSource(searchParams.get('source') || '');
        setNextActionType(searchParams.get('nextActionType') || '');
        setNextActionDateFrom(searchParams.get('nextActionDateFrom') || '');
        setNextActionDateTo(searchParams.get('nextActionDateTo') || '');
    }, [searchParams]);

    // Helper to update local filter states and synchronize browser URL silently
    const updateFilters = (
        updates: Record<string, string | number | undefined>,
    ) => {
        Object.entries(updates).forEach(([key, value]) => {
            const strVal = value === undefined ? '' : String(value);
            if (key === 'page') setPage(Number(value) || 1);
            if (key === 'limit') setLimit(Number(value) || 20);
            if (key === 'search') setSearch(strVal);
            if (key === 'status') setStatus(strVal);
            if (key === 'priority') setPriority(strVal);
            if (key === 'source') setSource(strVal);
            if (key === 'nextActionType') setNextActionType(strVal);
            if (key === 'nextActionDateFrom') setNextActionDateFrom(strVal);
            if (key === 'nextActionDateTo') setNextActionDateTo(strVal);
        });

        const params = new URLSearchParams(window.location.search);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === undefined || value === '') {
                params.delete(key);
            } else {
                params.set(key, String(value));
            }
        });
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    };

    // Dialog states
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    // Queries
    const { data: settingsData } = useGetLeadSettingsQuery(undefined);
    const statuses = useMemo(
        () => settingsData?.data?.filter((s: any) => s.type === 'STATUS') || [],
        [settingsData],
    );
    const sources = useMemo(
        () => settingsData?.data?.filter((s: any) => s.type === 'SOURCE') || [],
        [settingsData],
    );
    const actionTypes = useMemo(
        () => settingsData?.data?.filter((s: any) => s.type === 'ACTION_TYPE') || [],
        [settingsData],
    );

    const {
        data: leadsData,
        isLoading,
        isFetching,
    } = useGetLeadsQuery({
        page,
        limit,
        search: search || undefined,
        status: status || undefined,
        priority: priority || undefined,
        source: source || undefined,
        nextActionType: nextActionType || undefined,
        nextActionDateFrom: nextActionDateFrom || undefined,
        nextActionDateTo: nextActionDateTo || undefined,
    });

    const [createLead, { isLoading: isCreating }] = useCreateLeadMutation();
    const [updateLead, { isLoading: isUpdating }] = useUpdateLeadMutation();

    const [serverErrors, setServerErrors] = useState<
        Record<string, string[]> | undefined
    >();

    const leads = useMemo(() => leadsData?.data?.leads || [], [leadsData]);
    const pagination = leadsData?.data || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
    };

    const stats = useMemo(() => {
        return {
            total: pagination.total,
            highPriority: leads.filter((l: Lead) => l.priority === 'High').length,
            converted: leads.filter((l: Lead) => l.isConverted).length,
            active: leads.filter((l: Lead) => !l.isConverted).length,
        };
    }, [leads, pagination.total]);

    const handleFilterChange = (key: string, value: string | number) => {
        updateFilters({ [key]: value, page: 1 });
    };

    const handleClearFilters = () => {
        setPage(1);
        setSearch('');
        setStatus('');
        setPriority('');
        setSource('');
        setNextActionType('');
        setNextActionDateFrom('');
        setNextActionDateTo('');
        window.history.replaceState({ ...window.history.state, as: pathname, url: pathname }, '', pathname);
    };

    const handleAddLead = async (data: LeadFormValues) => {
        try {
            setServerErrors(undefined);
            await createLead(data).unwrap();
            toast.success('Lead created successfully');
            setIsAddDialogOpen(false);
        } catch (error: any) {
            setServerErrors(error?.data?.errors || error?.errors);
            toast.error(error?.data?.message || 'Failed to create lead');
        }
    };

    const handleUpdateLead = async (data: LeadFormValues) => {
        if (!selectedLead) return;
        try {
            setServerErrors(undefined);
            await updateLead({ id: selectedLead._id, data }).unwrap();
            toast.success('Lead updated successfully');
            setIsEditDialogOpen(false);
        } catch (error: any) {
            setServerErrors(error?.data?.errors || error?.errors);
            toast.error(error?.data?.message || 'Failed to update lead');
        }
    };

    const openEditDialog = (lead: Lead) => {
        setSelectedLead(lead);
        setServerErrors(undefined);
        setIsEditDialogOpen(true);
    };

    const handleViewLead = (lead: Lead) => {
        const params = new URLSearchParams();
        if (page !== 1) params.set('page', String(page));
        if (limit !== 20) params.set('limit', String(limit));
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        if (priority) params.set('priority', priority);
        if (source) params.set('source', source);
        if (nextActionType) params.set('nextActionType', nextActionType);
        if (nextActionDateFrom) params.set('nextActionDateFrom', nextActionDateFrom);
        if (nextActionDateTo) params.set('nextActionDateTo', nextActionDateTo);
        const currentUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        router.push(
            `/leads/${lead._id}?callbackUrl=${encodeURIComponent(currentUrl)}`,
        );
    };

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
                        Leads
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                        Manage your prospects and pipeline
                        {isFetching && (
                            <Loader className="h-3 w-3 animate-spin text-primary" />
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Settings className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Settings</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => toast.info('Export feature coming soon')}
                    >
                        <FileDown className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Export</span>
                    </Button>
                    {canCreateLead && (
                        <Button
                            size="sm"
                            onClick={() => {
                                setServerErrors(undefined);
                                setIsAddDialogOpen(true);
                            }}
                            className="h-8"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Lead
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Stats Strip ──────────────────────────────────────────── */}
            <LeadStats
                total={stats.total}
                highPriority={stats.highPriority}
                converted={stats.converted}
                active={stats.active}
                isLoading={isLoading}
            />

            {/* ── Filters Card ─────────────────────────────────────────── */}
            <Card className="mt-5 py-0 shadow-sm">
                <div className="px-5 py-4">
                    <LeadFilters
                        search={search}
                        status={status}
                        priority={priority}
                        source={source}
                        nextActionType={nextActionType}
                        nextActionDateFrom={nextActionDateFrom}
                        nextActionDateTo={nextActionDateTo}
                        onFilterChange={handleFilterChange}
                        onClearFilters={handleClearFilters}
                        statuses={statuses}
                        sources={sources}
                        actionTypes={actionTypes}
                    />
                </div>
            </Card>

            {/* ── Table Card ───────────────────────────────────────────── */}
            <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <LeadTable
                        leads={leads}
                        isLoading={isLoading}
                        onEdit={openEditDialog}
                        onView={handleViewLead}
                    />
                </div>

                <Separator />

                {/* Footer: Count + Pagination */}
                <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
                    <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                        Showing{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {leads.length}
                        </span>{' '}
                        of{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {pagination.total}
                        </span>{' '}
                        leads
                    </p>
                    <LeadPagination
                        currentPage={page}
                        totalPages={pagination.totalPages}
                        limit={limit}
                        onPageChange={(p) => updateFilters({ page: p })}
                        onLimitChange={(l) => updateFilters({ limit: l, page: 1 })}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>

            {/* ── Add Lead Dialog ──────────────────────────────────────── */}
            <Dialog
                open={isAddDialogOpen && canCreateLead}
                onOpenChange={setIsAddDialogOpen}
            >
                <DialogContent className="max-w-3xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
                    <div className="px-6 py-4 border-b border-border shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold">
                                Add New Lead
                            </DialogTitle>
                            <DialogDescription>
                                Create a new prospect to begin tracking their journey.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <LeadForm
                        onSubmit={handleAddLead}
                        isSubmitting={isCreating}
                        submitLabel="Create Lead"
                        onCancel={() => setIsAddDialogOpen(false)}
                        serverErrors={serverErrors}
                        statuses={statuses}
                        sources={sources}
                    />
                </DialogContent>
            </Dialog>

            {/* ── Edit Lead Dialog ─────────────────────────────────────── */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
                    <div className="px-6 py-4 border-b border-border shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold">
                                Edit Lead
                            </DialogTitle>
                            <DialogDescription>
                                Update the prospect's information and pipeline status.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    {selectedLead && (
                        <LeadForm
                            key={selectedLead._id}
                            defaultValues={{
                                name: selectedLead.name,
                                phone: selectedLead.phone,
                                email: selectedLead.email,
                                website: selectedLead.website,
                                status: selectedLead.status?._id,
                                priority: selectedLead.priority,
                                source: selectedLead.source?._id,
                                currentNotes: selectedLead.currentNotes,
                            }}
                            onSubmit={handleUpdateLead}
                            isSubmitting={isUpdating}
                            submitLabel="Save Changes"
                            onCancel={() => setIsEditDialogOpen(false)}
                            serverErrors={serverErrors}
                            isEditMode
                            statuses={statuses}
                            sources={sources}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <LeadSettingsDialog
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
            />
        </motion.div>
    );
}
