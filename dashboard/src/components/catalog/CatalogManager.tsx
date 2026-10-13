'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { EarningPagination as Pagination } from '@/components/earning/EarningPagination';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { CATALOG_ICONS } from '@/lib/catalog-icons';
import {
    useCreateCatalogItemMutation,
    useDeleteCatalogItemMutation,
    useGetCatalogItemsQuery,
    useToggleCatalogItemMutation,
    useUpdateCatalogItemMutation,
} from '@/redux/features/catalog/catalogApi';
import type {
    CatalogEntity,
    CatalogFeature,
    CatalogPackage,
    CatalogPlatform,
    CatalogService,
} from '@/types/catalog.type';
import { BrandLogo } from './BrandLogo';

// ───────────────────────────── field config ─────────────────────────────

type Form = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Opt = { value: string; label: string; group?: string };
type Ctx = { services: CatalogService[]; platforms: CatalogPlatform[]; features: CatalogFeature[]; form: Form };

interface Field {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'switch' | 'lines' | 'ids';
    options?: (c: Ctx) => Opt[];
    hint?: string;
    required?: boolean;
    full?: boolean;
    show?: (f: Form) => boolean;
}

const CATEGORIES: Opt[] = [
    { value: 'web-development', label: 'Web development' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'photo-editing', label: 'Photo' },
    { value: 'video-editing', label: 'Video' },
];
const BILLING: Opt[] = ['one-time', 'monthly', 'yearly', 'per-image', 'per-video', 'per-second', 'per-10s'].map((v) => ({ value: v, label: v }));

const serviceOpts = (c: Ctx): Opt[] => c.services.map((s) => ({ value: s._id, label: s.name }));
/** Platforms enabled on the service chosen in the form (the single source of truth for what a service may use). */
const platformOpts = (c: Ctx): Opt[] => {
    const svc = c.services.find((s) => s._id === c.form.serviceId);
    return [{ value: '', label: 'None (platform-agnostic)' }, ...c.platforms.filter((p) => svc?.platformIds.includes(p._id)).map((p) => ({ value: p._id, label: p.name }))];
};
const featureOpts = (kind: 'included' | 'addon') => (c: Ctx): Opt[] =>
    c.features
        .filter((f) => f.serviceId === c.form.serviceId && f.kind === kind && (!f.platformId || f.platformId === (c.form.platformId || null)))
        .map((f) => ({ value: f._id, label: kind === 'addon' ? `${f.name} — ${f.price}` : f.name, group: f.group || 'General' }));

const FIELDS: Record<CatalogEntity, Field[]> = {
    services: [
        { key: 'name', label: 'Service name', type: 'text', required: true },
        { key: 'icon', label: 'Icon', type: 'select', options: () => Object.keys(CATALOG_ICONS).map((k) => ({ value: k, label: k })) },
        { key: 'quotationCategory', label: 'Quotation category', type: 'select', required: true, options: () => CATEGORIES, hint: 'Which quotation/PDF category this maps to.' },
        { key: 'pricingMode', label: 'Pricing mode', type: 'select', options: () => [{ value: 'package', label: 'Package' }, { value: 'unit', label: 'Per unit (rate × quantity)' }] },
        { key: 'description', label: 'Short description', type: 'textarea', full: true },
        { key: 'platformIds', label: 'Platforms offered for this service', type: 'ids', full: true, options: (c) => c.platforms.map((p) => ({ value: p._id, label: p.name })) },
        { key: 'sortOrder', label: 'Sort order', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'switch' },
    ],
    platforms: [
        { key: 'name', label: 'Platform name', type: 'text', required: true },
        { key: 'color', label: 'Brand color', type: 'text', hint: 'e.g. #FF2D20 or currentColor' },
        { key: 'logo', label: 'Logo key', type: 'text', hint: 'laravel · nextdotjs · nodedotjs · shopify (file in /assets/tech) — blank for a generic icon' },
        { key: 'logoSecondary', label: 'Second logo key', type: 'text' },
        { key: 'description', label: 'Short description', type: 'textarea', full: true },
        { key: 'sortOrder', label: 'Sort order', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'switch' },
    ],
    features: [
        { key: 'serviceId', label: 'Service', type: 'select', required: true, options: serviceOpts },
        { key: 'platformId', label: 'Platform', type: 'select', options: platformOpts },
        { key: 'name', label: 'Feature', type: 'text', required: true, full: true },
        { key: 'group', label: 'Group / heading', type: 'text', hint: 'e.g. E-Commerce & Management' },
        { key: 'kind', label: 'Kind', type: 'select', options: () => [{ value: 'included', label: 'Included feature' }, { value: 'addon', label: 'Optional add-on' }] },
        { key: 'price', label: 'Add-on price', type: 'number', show: (f) => f.kind === 'addon' },
        { key: 'description', label: 'Description', type: 'textarea', full: true },
        { key: 'sortOrder', label: 'Sort order', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'switch' },
    ],
    packages: [
        { key: 'serviceId', label: 'Service', type: 'select', required: true, options: serviceOpts },
        { key: 'platformId', label: 'Platform', type: 'select', options: platformOpts },
        { key: 'name', label: 'Package name', type: 'text', required: true },
        { key: 'badge', label: 'Badge', type: 'text', hint: 'e.g. Most Popular' },
        { key: 'price', label: 'Price (blank = custom quote)', type: 'number' },
        { key: 'priceMax', label: 'Max price (for ranged unit prices)', type: 'number' },
        { key: 'billingCycle', label: 'Billing cycle', type: 'select', options: () => BILLING },
        { key: 'unitLabel', label: 'Unit label', type: 'text', hint: 'product / reel / video' },
        { key: 'duration', label: 'Package duration', type: 'text', hint: 'e.g. 3 – 4 Weeks' },
        { key: 'supportPeriod', label: 'Support period', type: 'text', hint: 'e.g. 12 Months' },
        { key: 'description', label: 'Tagline', type: 'textarea', full: true },
        { key: 'bestFor', label: 'Best for', type: 'textarea', full: true },
        { key: 'bullets', label: 'Card bullets (one per line)', type: 'lines', full: true },
        { key: 'featureIds', label: 'Included features', type: 'ids', full: true, options: featureOpts('included'), hint: 'Features of this service/platform. Pick a service first.' },
        { key: 'addonIds', label: 'Optional add-ons', type: 'ids', full: true, options: featureOpts('addon') },
        { key: 'notes', label: 'Notes / policies (one per line)', type: 'lines', full: true },
        { key: 'supportInclusions', label: 'Free support includes (one per line)', type: 'lines', full: true },
        { key: 'additionalCharges', label: 'Additional charges apply to (one per line)', type: 'lines', full: true },
        { key: 'sortOrder', label: 'Sort order', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'switch' },
    ],
};

const DEFAULTS: Record<CatalogEntity, Form> = {
    services: { name: '', icon: 'website', quotationCategory: 'web-development', pricingMode: 'package', description: '', platformIds: [], sortOrder: 0, isActive: true },
    platforms: { name: '', color: 'currentColor', logo: '', logoSecondary: '', description: '', sortOrder: 0, isActive: true },
    features: { serviceId: '', platformId: '', name: '', group: '', kind: 'included', price: 0, description: '', sortOrder: 0, isActive: true },
    packages: {
        serviceId: '', platformId: '', name: '', badge: '', price: '', priceMax: '', billingCycle: 'one-time', unitLabel: '', duration: '', supportPeriod: '', description: '', bestFor: '',
        bullets: [], featureIds: [], addonIds: [], notes: [], supportInclusions: [], additionalCharges: [], sortOrder: 0, isActive: true,
    },
};

const TITLES: Record<CatalogEntity, string> = { services: 'Services', platforms: 'Platforms', packages: 'Packages', features: 'Features' };
const SINGULAR: Record<CatalogEntity, string> = { services: 'service', platforms: 'platform', packages: 'package', features: 'feature' };

// ───────────────────────────── ids checklist ─────────────────────────────

function IdChecklist({ options, value, onChange }: { options: Opt[]; value: string[]; onChange: (v: string[]) => void }) {
    const [q, setQ] = useState('');
    const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
    const groups = [...new Set(shown.map((o) => o.group ?? ''))];
    const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((v) => v !== id));
    return (
        <div className="rounded-md border">
            <div className="flex items-center gap-2 border-b px-3 py-2">
                <IconSearch className="size-4 text-muted-foreground" />
                <input className="flex-1 bg-transparent text-sm outline-none" placeholder={`Search ${options.length} options…`} value={q} onChange={(e) => setQ(e.target.value)} />
                <span className="text-xs text-muted-foreground">{value.length} selected</span>
                {shown.length > 0 && (
                    <button type="button" className="text-xs text-primary" onClick={() => onChange(value.length === options.length ? [] : options.map((o) => o.value))}>
                        {value.length === options.length ? 'Clear' : 'All'}
                    </button>
                )}
            </div>
            <div className="max-h-56 overflow-y-auto p-2">
                {options.length === 0 && <p className="p-2 text-xs text-muted-foreground">Nothing to choose from yet.</p>}
                {groups.map((g) => (
                    <div key={g || 'none'} className="mb-2">
                        {g && <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>}
                        {shown.filter((o) => (o.group ?? '') === g).map((o) => (
                            <label key={o.value} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50">
                                <Checkbox className="mt-0.5" checked={value.includes(o.value)} onCheckedChange={(c) => toggle(o.value, !!c)} />
                                <span>{o.label}</span>
                            </label>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ───────────────────────────── manager ─────────────────────────────

export default function CatalogManager() {
    const { can } = usePermissions();
    const canManage = can('catalog.manage');

    const [tab, setTab] = useState<CatalogEntity>('services');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500);
    const [svcFilter, setSvcFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    // The table itself: paged + searched on the server.
    const { data: pageData, isFetching: loading } = useGetCatalogItemsQuery({
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

    // Small lookup sources for names + dropdowns (never paged).
    const services = (useGetCatalogItemsQuery({ entity: 'services', params: { all: true } }).data?.items ?? []) as CatalogService[];
    const platforms = (useGetCatalogItemsQuery({ entity: 'platforms', params: { all: true } }).data?.items ?? []) as CatalogPlatform[];

    const [createItem, { isLoading: creating }] = useCreateCatalogItemMutation();
    const [updateItem, { isLoading: updating }] = useUpdateCatalogItemMutation();
    const [toggleItem] = useToggleCatalogItemMutation();
    const [deleteItem] = useDeleteCatalogItemMutation();

    const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);

    // Features offered in the package form: only the chosen service's (fetched on demand, not the whole table).
    const { data: formFeatureData } = useGetCatalogItemsQuery(
        { entity: 'features', params: { all: true, serviceId: editing?.form.serviceId } },
        { skip: !(editing && tab === 'packages' && editing.form.serviceId) },
    );
    const features = (formFeatureData?.items ?? []) as CatalogFeature[];

    const svcName = (id?: string | null) => services.find((s) => s._id === id)?.name ?? '—';
    const platName = (id?: string | null) => (id ? platforms.find((p) => p._id === id)?.name ?? '—' : '—');

    const open = (id: string | null, source?: Form) => {
        const f = { ...DEFAULTS[tab], ...(source ?? {}) };
        for (const k of ['platformId', 'price', 'priceMax']) if (f[k] === null || f[k] === undefined) f[k] = '';
        setEditing({ id, form: f });
    };

    const setField = (k: string, v: unknown) =>
        setEditing((e) => {
            if (!e) return e;
            const form = { ...e.form, [k]: v };
            // Changing the service/platform invalidates feature links that belonged to the old scope.
            if (k === 'serviceId') Object.assign(form, { platformId: '', featureIds: [], addonIds: [] });
            if (k === 'platformId') Object.assign(form, { featureIds: [], addonIds: [] });
            return { ...e, form };
        });

    const save = async () => {
        if (!editing) return;
        const body: Form = { ...editing.form };
        for (const f of FIELDS[tab]) {
            if (f.required && !String(body[f.key] ?? '').trim()) return toast.error(`${f.label} is required`);
            if (f.type === 'lines') body[f.key] = (body[f.key] as string[]).map((l) => l.trim()).filter(Boolean);
            if (f.type === 'number') body[f.key] = body[f.key] === '' ? null : Number(body[f.key]);
        }
        if (body.platformId === '') body.platformId = null;
        try {
            if (editing.id) await updateItem({ entity: tab, id: editing.id, body }).unwrap();
            else await createItem({ entity: tab, body }).unwrap();
            toast.success(`${TITLES[tab].replace(/s$/, '')} saved`);
            setEditing(null);
        } catch (e) {
            toast.error((e as { data?: { message?: string } })?.data?.message || 'Failed to save');
        }
    };

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

    const ctx: Ctx = { services, platforms, features, form: editing?.form ?? {} };
    const showSvcFilter = tab === 'packages' || tab === 'features';

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Service Catalog</h1>
                    <p className="text-sm text-muted-foreground">
                        Define the services, platforms, packages and features that power the New Quotation page. Everything is linked by reference, so renaming never breaks a package.
                    </p>
                </div>
                {canManage && (
                    <Button onClick={() => open(null)}>
                        <IconPlus className="size-4" /> Add {SINGULAR[tab]}
                    </Button>
                )}
            </div>

            <Tabs value={tab} onValueChange={(v) => { setTab(v as CatalogEntity); setSearch(''); setSvcFilter('all'); setPage(1); }}>
                <TabsList>
                    {(Object.keys(TITLES) as CatalogEntity[]).map((t) => (
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
                                    <TableCell className="whitespace-nowrap">{p.price === null ? 'Custom quote' : `৳${p.price.toLocaleString()}${p.priceMax ? `–${p.priceMax.toLocaleString()}` : ''}`}{p.billingCycle !== 'one-time' && <span className="text-xs text-muted-foreground"> / {p.billingCycle}</span>}</TableCell>
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
                <div className="flex items-center justify-between gap-4 border-t px-5 py-3">
                    <p className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                        Showing <span className="mx-1 font-medium text-foreground/80">{rows.length}</span> of{' '}
                        <span className="mx-1 font-medium text-foreground/80">{total}</span> {TITLES[tab].toLowerCase()}
                    </p>
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        limit={limit}
                        onPageChange={setPage}
                        onLimitChange={(l) => { setLimit(l); setPage(1); }}
                        isLoading={loading}
                    />
                </div>
            </div>

            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? 'Edit' : 'New'} {SINGULAR[tab]}</DialogTitle>
                        <DialogDescription>Links to other items are stored by reference.</DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {FIELDS[tab].filter((f) => !f.show || f.show(editing.form)).map((f) => (
                                <div key={f.key} className={f.full || f.type === 'ids' || f.type === 'lines' ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
                                    {f.type !== 'switch' && <Label className="text-xs">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>}
                                    {f.type === 'text' && <Input value={editing.form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />}
                                    {f.type === 'number' && <Input type="number" min={0} value={editing.form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />}
                                    {f.type === 'textarea' && <Textarea rows={2} value={editing.form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />}
                                    {f.type === 'lines' && <Textarea rows={4} value={(editing.form[f.key] as string[]).join('\n')} onChange={(e) => setField(f.key, e.target.value.split('\n'))} />}
                                    {f.type === 'select' && (
                                        <Select value={String(editing.form[f.key] ?? '') || '__none'} onValueChange={(v) => setField(f.key, v === '__none' ? '' : v)}>
                                            <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                                            <SelectContent>
                                                {f.options!(ctx).map((o) => <SelectItem key={o.value || '__none'} value={o.value || '__none'}>{o.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {f.type === 'ids' && <IdChecklist options={f.options!(ctx)} value={editing.form[f.key] ?? []} onChange={(v) => setField(f.key, v)} />}
                                    {f.type === 'switch' && (
                                        <label className="flex items-center gap-3 pt-6 text-sm"><Switch checked={!!editing.form[f.key]} onCheckedChange={(v) => setField(f.key, v)} /> {f.label}</label>
                                    )}
                                    {f.hint && f.type !== 'switch' && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button disabled={creating || updating} onClick={save}>{creating || updating ? 'Saving…' : 'Save'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
