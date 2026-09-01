'use client';

import { useState, useMemo, Suspense, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { subDays, isAfter } from 'date-fns';
import {
    useGetClientsQuery,
    useCreateClientMutation,
    useUpdateClientMutation,
} from '@/redux/features/client/clientApi';
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
import { Plus, Loader, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { ClientForm, type ClientFormData } from '@/components/client/ClientForm';
import { usePermissions } from '@/hooks/use-permissions';
import { ClientStats } from '@/components/client/ClientStats';
import { ClientFilters } from '@/components/client/ClientFilters';
import { ClientTable } from '@/components/client/ClientTable';
import { ClientPagination } from '@/components/client/ClientPagination';
import { Client } from '@/types/client.type';

export default function ClientsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-[400px] items-center justify-center">
                    <Loader className="h-8 w-8 animate-spin text-brand-primary" />
                </div>
            }
        >
            <ClientsPageContent />
        </Suspense>
    );
}

function ClientsPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Local filter states initialized from searchParams
    const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1);
    const [limit, setLimit] = useState(() => Number(searchParams.get('limit')) || 20);
    const [search, setSearch] = useState(() => searchParams.get('search') || '');
    const [status, setStatus] = useState(() => searchParams.get('status') || '');

    // Synchronize URL changes (e.g. back/forward browser navigation) with local states
    useEffect(() => {
        setPage(Number(searchParams.get('page')) || 1);
        setLimit(Number(searchParams.get('limit')) || 20);
        setSearch(searchParams.get('search') || '');
        setStatus(searchParams.get('status') || '');
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

    const { can } = usePermissions();
    const canCreateClient = can('client.create');

    // Dialog states
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [editDefaultValues, setEditDefaultValues] = useState<ClientFormData | undefined>(undefined);

    // Queries
    const {
        data: clientsData,
        isLoading,
        isFetching,
    } = useGetClientsQuery({
        page,
        limit,
        search: search || undefined,
        status: status || undefined,
    });

    const [createClient, { isLoading: isCreating }] = useCreateClientMutation();
    const [updateClient, { isLoading: isUpdating }] = useUpdateClientMutation();

    const [addServerErrors, setAddServerErrors] = useState<Record<string, string[]> | undefined>();
    const [updateServerErrors, setUpdateServerErrors] = useState<Record<string, string[]> | undefined>();

    const clients = useMemo(() => clientsData?.clients || [], [clientsData]);
    const pagination = clientsData?.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        pages: 1,
    };

    const [thirtyDaysAgo] = useState(() => subDays(new Date(), 30));

    const stats = useMemo(() => {
        return {
            total: pagination.total,
            active: clients.filter((c: Client) => c.status === 'active').length,
            inactive: clients.filter((c: Client) => c.status === 'inactive').length,
            newClients: clients.filter((c: Client) =>
                c.createdAt ? isAfter(new Date(c.createdAt), thirtyDaysAgo) : false,
            ).length,
        };
    }, [clients, pagination.total, thirtyDaysAgo]);

    const handleFilterChange = (key: string, value: string) => {
        updateFilters({ [key]: value, page: 1 });
    };

    const handleClearFilters = () => {
        setPage(1);
        setSearch('');
        setStatus('');
        window.history.replaceState({ ...window.history.state, as: pathname, url: pathname }, '', pathname);
    };

    const handleAddClient = async (data: ClientFormData) => {
        try {
            setAddServerErrors(undefined);
            await createClient(data).unwrap();
            toast.success('Client created successfully');
            setIsAddDialogOpen(false);
        } catch (error: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const err = error as any;
            setAddServerErrors(err?.data?.errors || err?.errors);
            toast.error(err?.data?.message || 'Failed to create client');
        }
    };

    const handleUpdateClient = async (data: ClientFormData) => {
        if (!selectedClient) return;
        try {
            setUpdateServerErrors(undefined);
            await updateClient({ id: selectedClient._id, ...data }).unwrap();
            toast.success('Client updated successfully');
            setIsEditDialogOpen(false);
        } catch (error: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const err = error as any;
            setUpdateServerErrors(err?.data?.errors || err?.errors);
            toast.error(err?.data?.message || 'Failed to update client');
        }
    };

    const openEditDialog = (client: Client) => {
        setSelectedClient(client);
        setUpdateServerErrors(undefined);
        setEditDefaultValues({
            name: client.name,
            emails: client.emails,
            phone: client.phone || '',
            address: client.address || '',
            officeAddress: client.officeAddress || '',
            description: client.description || '',
            currency: client.currency || '',
            status: client.status,
            teamMembers: client.teamMembers || [],
            assignedServices: client.assignedServices || [],
            assignedTelemarketer:
                typeof client.assignedTelemarketer === 'object'
                    ? client.assignedTelemarketer._id
                    : client.assignedTelemarketer || '',
        });
        setIsEditDialogOpen(true);
    };

    const handleViewClient = (client: Client) => {
        const params = new URLSearchParams();
        if (page !== 1) params.set('page', String(page));
        if (limit !== 20) params.set('limit', String(limit));
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        const currentUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        router.push(`/clients/${client._id}?callbackUrl=${encodeURIComponent(currentUrl)}`);
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
                        Clients
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                        Manage your client relationships and teams
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
                        onClick={() => toast.info('Export feature coming soon')}
                    >
                        <FileDown className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Export</span>
                    </Button>
                    {canCreateClient && (
                        <Button
                            size="sm"
                            onClick={() => {
                                setAddServerErrors(undefined);
                                setIsAddDialogOpen(true);
                            }}
                            className="h-8"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Client
                        </Button>
                    )}
                </div>
            </div>

            {/* ── Stats Strip ──────────────────────────────────────────── */}
            <ClientStats
                total={stats.total}
                active={stats.active}
                inactive={stats.inactive}
                newClients={stats.newClients}
                isLoading={isLoading}
            />

            {/* ── Filters Card ─────────────────────────────────────────── */}
            <Card className="mt-5 py-0 shadow-sm">
                <div className="px-5 py-4">
                    <ClientFilters
                        search={search}
                        status={status}
                        onFilterChange={handleFilterChange}
                        onClearFilters={handleClearFilters}
                    />
                </div>
            </Card>

            {/* ── Table Card ───────────────────────────────────────────── */}
            <Card className="mt-4 py-0 gap-0 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <ClientTable
                        clients={clients}
                        isLoading={isLoading}
                        onEdit={openEditDialog}
                        onView={handleViewClient}
                    />
                </div>

                <Separator />

                {/* Footer: Count + Pagination */}
                <CardContent className="flex items-center justify-between gap-4 px-5 py-3">
                    <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                        Showing{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {clients.length}
                        </span>{' '}
                        of{' '}
                        <span className="mx-1 font-medium text-foreground/80">
                            {pagination.total}
                        </span>{' '}
                        clients
                    </p>
                    <ClientPagination
                        currentPage={page}
                        totalPages={pagination.pages}
                        limit={limit}
                        onPageChange={(p) => updateFilters({ page: p })}
                        onLimitChange={(l) => updateFilters({ limit: l, page: 1 })}
                        isLoading={isLoading}
                    />
                </CardContent>
            </Card>

            {/* ── Add Client Dialog ────────────────────────────────────── */}
            <Dialog
                open={isAddDialogOpen && canCreateClient}
                onOpenChange={setIsAddDialogOpen}
            >
                <DialogContent className="max-w-4xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
                    <div className="px-6 py-4 border-b border-border shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold">
                                Add New Client
                            </DialogTitle>
                            <DialogDescription>
                                Create a new client profile with contact and team details.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <ClientForm
                        onSubmit={handleAddClient}
                        isSubmitting={isCreating}
                        submitLabel="Create Client"
                        onCancel={() => setIsAddDialogOpen(false)}
                        serverErrors={addServerErrors}
                    />
                </DialogContent>
            </Dialog>

            {/* ── Edit Client Dialog ───────────────────────────────────── */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-4xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
                    <div className="px-6 py-4 border-b border-border shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold">
                                Edit Client
                            </DialogTitle>
                            <DialogDescription>
                                Update client profile and team information.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    {editDefaultValues && (
                        <ClientForm
                            key={selectedClient?._id}
                            defaultValues={editDefaultValues}
                            onSubmit={handleUpdateClient}
                            isSubmitting={isUpdating}
                            submitLabel="Save Changes"
                            onCancel={() => setIsEditDialogOpen(false)}
                            serverErrors={updateServerErrors}
                            isEditMode
                        />
                    )}
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
