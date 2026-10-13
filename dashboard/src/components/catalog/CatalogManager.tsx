'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NumberedPagination } from '@/components/ui/shared/NumberedPagination';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import {
    useDeleteCatalogItemMutation,
    useGetCatalogItemsQuery,
    useToggleCatalogItemMutation,
} from '@/redux/features/catalog/catalogApi';
import type { CatalogFeature, CatalogPackage, CatalogPlatform, CatalogService, FormEntity } from '@/types/catalog.type';
import { BrandLogo } from './BrandLogo';
import { EntityFormDialog, SINGULAR, TITLES, type Form } from './EntityFormDialog';

/** Table (list) view of the catalog: server-side paging + debounced search. The canvas is the visual editor. */
export default function CatalogManager() {
    const { can } = usePermissions();
    const canManage = can('catalog.manage');

    const [tab, setTab] = useState<FormEntity>('services');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [svcFilter, setSvcFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    // The table itself: paged + searched on the server.
    const { currentData: pageData, isFetching: loading } = useGetCatalogItemsQuery({
        entity: tab,
        params: {
            page,
            limit,
            search: debouncedSearch.trim() || undefined,
            serviceId: (tab === 'packages' || tab === 'features') && svcFilter !== 'all' ? svcFilter : undefined,
        },
    });
    const rows = (pageData?.items ?? []) as unknown as Array<{ _id: string; name: string; serviceId?: string }>;
    const total = pageData?.pagination.total ?? 0;
    const totalPages = pageData?.pagination.pages ?? 1;

    // Small lookup sources for names + the service filter (never paged).
    const services = (useGetCatalogItemsQuery({ entity: 'services', params: { all: true } }).data?.items ?? []) as CatalogService[];
    const platforms = (useGetCatalogItemsQuery({ entity: 'platforms', params: { all: true } }).data?.items ?? []) as CatalogPlatform[];

    const [toggleItem] = useToggleCatalogItemMutation();
    const [deleteItem] = useDeleteCatalogItemMutation();

    const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);

    const svcName = (id?: string | null) => services.find((s) => s._id === id)?.name ?? '—';
    const platName = (id?: string | null) => (id ? platforms.find((p) => p._id === id)?.name ?? '—' : '—');
    const open = (id: string | null, source?: Form) => setEditing({ id, form: source ?? {} });

    const remove = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
            await deleteItem({ entity: tab, id }).unwrap();
            if (rows.length === 1 && page > 1) setPage(page - 1); // last row of this page
            toast.success('Deleted');
        } catch (e) {
            toast.error((e as { data?: { message?: string } })?.data?.message || 'Failed to delete');
        }
    };

    const showSvcFilter = tab === 'packages' || tab === 'features';

    return (
        <div className="space-y-4">
            {canManage && (
                <div className="flex justify-end">
                    <Button onClick={() => open(null)}>
                        <IconPlus className="size-4" /> Add {SINGULAR[tab]}
                    </Button>
                </div>
            )}

            <Tabs value={tab} onValueChange={(v) => { setTab(v as FormEntity); setSearch(''); setSvcFilter('all'); setPage(1); }}>
                <TabsList>
                    {(Object.keys(TITLES) as FormEntity[]).map((t) => (
                        <TabsTrigger key={t} value={t}>
                            {TITLES[t]}{t === tab && <span className="ml-1.5 text-xs text-muted-foreground">{total}</span>}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <div className="flex flex-wrap gap-2">
                <div className="relative w-full max-w-xs">
                    <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder={`Search ${TITLES[tab].toLowerCase()}…`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                {showSvcFilter && (
                    <Select value={svcFilter} onValueChange={(v) => { setSvcFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All services</SelectItem>
                            {services.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <div className="rounded-xl border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            {tab === 'services' && (<><TableHead>Category</TableHead><TableHead>Platforms</TableHead><TableHead>Packages</TableHead><TableHead>Features</TableHead></>)}
                            {tab === 'platforms' && (<><TableHead>Logo</TableHead><TableHead>Used by</TableHead></>)}
                            {tab === 'packages' && (<><TableHead>Service</TableHead><TableHead>Platform</TableHead><TableHead>Price</TableHead><TableHead>Features</TableHead></>)}
                            {tab === 'features' && (<><TableHead>Service</TableHead><TableHead>Platform</TableHead><TableHead>Group</TableHead><TableHead>Kind</TableHead></>)}
                            <TableHead>Active</TableHead>
                            {canManage && <TableHead className="w-24 text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">{loading ? 'Loading…' : 'Nothing found.'}</TableCell></TableRow>
                        )}
                        {rows.map((r) => {
                            const id = r._id;
                            let cells: React.ReactNode = null;
                            if (tab === 'services') {
                                const s = r as unknown as CatalogService;
                                cells = (<>
                                    <TableCell><Badge variant="secondary">{s.quotationCategory}</Badge></TableCell>
                                    <TableCell className="text-xs">{s.platformIds.map((p) => platName(p)).join(', ') || '—'}</TableCell>
                                    <TableCell>{s.packageCount ?? 0}</TableCell>
                                    <TableCell>{s.featureCount ?? 0}</TableCell>
                                </>);
                            } else if (tab === 'platforms') {
                                const p = r as unknown as CatalogPlatform;
                                cells = (<>
                                    <TableCell>{p.logo ? <span className="flex gap-1"><BrandLogo name={p.logo} color={p.color} className="size-5" />{p.logoSecondary && <BrandLogo name={p.logoSecondary} className="size-5" />}</span> : '—'}</TableCell>
                                    <TableCell>{p.serviceCount ?? 0} service(s)</TableCell>
                                </>);
                            } else if (tab === 'packages') {
                                const p = r as unknown as CatalogPackage;
                                cells = (<>
                                    <TableCell>{svcName(p.serviceId)}</TableCell>
                                    <TableCell>{platName(p.platformId)}</TableCell>
                                    <TableCell className="whitespace-nowrap">{p.price == null ? 'Custom quote' : `৳${p.price.toLocaleString()}${p.priceMax ? `–${p.priceMax.toLocaleString()}` : ''}`}{p.billingCycle !== 'one-time' && <span className="text-xs text-muted-foreground"> / {p.billingCycle}</span>}</TableCell>
                                    <TableCell>{p.featureIds.length}{p.addonIds.length > 0 && ` + ${p.addonIds.length} add-ons`}</TableCell>
                                </>);
                            } else {
                                const f = r as unknown as CatalogFeature;
                                cells = (<>
                                    <TableCell>{svcName(f.serviceId)}</TableCell>
                                    <TableCell>{platName(f.platformId)}</TableCell>
                                    <TableCell className="text-xs">{f.group || '—'}</TableCell>
                                    <TableCell><Badge variant={f.kind === 'addon' ? 'default' : 'outline'}>{f.kind === 'addon' ? `Add-on ৳${f.price}` : 'Included'}</Badge></TableCell>
                                </>);
                            }
                            const active = (r as unknown as { isActive: boolean }).isActive;
                            return (
                                <TableRow key={id}>
                                    <TableCell className="max-w-[420px] font-medium"><span className="line-clamp-2">{r.name}</span></TableCell>
                                    {cells}
                                    <TableCell>
                                        <Switch checked={active} disabled={!canManage} onCheckedChange={() => toggleItem({ entity: tab, id }).unwrap().catch(() => toast.error('Failed to update'))} />
                                    </TableCell>
                                    {canManage && (
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => open(id, r as unknown as Form)}><IconPencil className="size-4" /></Button>
                                            <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(id, r.name)}><IconTrash className="size-4 text-destructive" /></Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="border-t px-5 py-3">
                    <NumberedPagination
                        page={page}
                        totalPages={totalPages}
                        limit={limit}
                        total={total}
                        noun={TITLES[tab].toLowerCase()}
                        onPageChange={setPage}
                        onLimitChange={(l) => { setLimit(l); setPage(1); }}
                        isLoading={loading}
                    />
                </div>
            </div>

            {editing && (
                <EntityFormDialog key={editing.id ?? 'new'} entity={tab} id={editing.id} initial={editing.form} onClose={() => setEditing(null)} />
            )}
        </div>
    );
}
