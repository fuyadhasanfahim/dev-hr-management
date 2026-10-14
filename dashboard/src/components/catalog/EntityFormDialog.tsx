'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconSearch } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CATALOG_ICONS } from '@/lib/catalog-icons';
import { BlueprintEditor } from './BlueprintEditor';
import {
    useCreateCatalogItemMutation,
    useGetCatalogItemsQuery,
    useUpdateCatalogItemMutation,
} from '@/redux/features/catalog/catalogApi';
import type { CatalogFeature, CatalogPlatform, CatalogService, FormEntity } from '@/types/catalog.type';

// ───────────────────────────── field config ─────────────────────────────

export type Form = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Opt = { value: string; label: string; group?: string };
type Ctx = { services: CatalogService[]; platforms: CatalogPlatform[]; features: CatalogFeature[]; form: Form };

interface Field {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'switch' | 'lines' | 'ids' | 'blueprint';
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

const FIELDS: Record<FormEntity, Field[]> = {
    services: [
        { key: 'name', label: 'Service name', type: 'text', required: true },
        { key: 'icon', label: 'Icon', type: 'select', options: () => Object.keys(CATALOG_ICONS).map((k) => ({ value: k, label: k })) },
        { key: 'quotationCategory', label: 'Quotation category', type: 'select', required: true, options: () => CATEGORIES, hint: 'Which quotation/PDF category this maps to.' },
        { key: 'pricingMode', label: 'Pricing mode', type: 'select', options: () => [{ value: 'package', label: 'Package' }, { value: 'unit', label: 'Per unit (rate × quantity)' }] },
        { key: 'flowType', label: 'Quotation flow', type: 'select', options: () => [{ value: '', label: 'Auto (from pricing mode / category)' }, { value: 'project', label: 'Project — milestones, revisions, support, hosting' }, { value: 'retainer', label: 'Retainer — monthly recurring (e.g. marketing)' }, { value: 'production', label: 'Production — per unit (photo / video)' }], hint: 'Decides which cards the quotation wizard shows for this service.' },
        { key: 'description', label: 'Short description', type: 'textarea', full: true },
        { key: 'platformIds', label: 'Platforms offered for this service', type: 'ids', full: true, options: (c) => c.platforms.map((p) => ({ value: p._id, label: p.name })) },
        { key: 'blueprint', label: 'Quotation blueprint (service defaults)', type: 'blueprint', full: true },
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
        { key: 'blueprint', label: 'Quotation blueprint (package overrides)', type: 'blueprint', full: true },
        { key: 'sortOrder', label: 'Sort order', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'switch' },
    ],
};

const DEFAULTS: Record<FormEntity, Form> = {
    services: { name: '', icon: 'website', quotationCategory: 'web-development', pricingMode: 'package', description: '', flowType: '', blueprint: null, platformIds: [], sortOrder: 0, isActive: true },
    platforms: { name: '', color: 'currentColor', logo: '', logoSecondary: '', description: '', sortOrder: 0, isActive: true },
    features: { serviceId: '', platformId: '', name: '', group: '', kind: 'included', price: 0, description: '', sortOrder: 0, isActive: true },
    packages: {
        serviceId: '', platformId: '', name: '', badge: '', price: '', priceMax: '', billingCycle: 'one-time', unitLabel: '', duration: '', supportPeriod: '', description: '', bestFor: '',
        bullets: [], featureIds: [], addonIds: [], notes: [], supportInclusions: [], additionalCharges: [], blueprint: null, sortOrder: 0, isActive: true,
    },
};

export const TITLES: Record<FormEntity, string> = { services: 'Services', platforms: 'Platforms', packages: 'Packages', features: 'Features' };
export const SINGULAR: Record<FormEntity, string> = { services: 'service', platforms: 'platform', packages: 'package', features: 'feature' };

// ───────────────────────────── ids checklist ─────────────────────────────

export function IdChecklist({ options, value, onChange }: { options: Opt[]; value: string[]; onChange: (v: string[]) => void }) {
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


// ───────────────────────────── dialog ─────────────────────────────

interface Props {
    entity: FormEntity;
    /** Set when editing an existing record. */
    id?: string | null;
    /** The existing record (edit) or preset values (create, e.g. serviceId from the canvas). */
    initial?: Form;
    onClose: () => void;
    /** Called with the saved record — the canvas uses it to link a freshly created feature to its package. */
    onSaved?: (doc: { _id: string } & Form) => void;
}

/** Create / edit form for services, platforms, packages and features — shared by the list view and the canvas. */
export function EntityFormDialog({ entity, id = null, initial, onClose, onSaved }: Props) {
    const [form, setForm] = useState<Form>(() => {
        const f = { ...DEFAULTS[entity], ...(initial ?? {}) };
        for (const k of ['platformId', 'price', 'priceMax']) if (f[k] === null || f[k] === undefined) f[k] = '';
        return f;
    });

    // Small lookup sources for the dropdowns (never paged); features only for the chosen service.
    const services = (useGetCatalogItemsQuery({ entity: 'services', params: { all: true } }).data?.items ?? []) as CatalogService[];
    const platforms = (useGetCatalogItemsQuery({ entity: 'platforms', params: { all: true } }).data?.items ?? []) as CatalogPlatform[];
    const { data: featureData } = useGetCatalogItemsQuery(
        { entity: 'features', params: { all: true, serviceId: form.serviceId } },
        { skip: !(entity === 'packages' && form.serviceId) },
    );
    const features = (featureData?.items ?? []) as CatalogFeature[];

    const [createItem, { isLoading: creating }] = useCreateCatalogItemMutation();
    const [updateItem, { isLoading: updating }] = useUpdateCatalogItemMutation();

    const setField = (k: string, v: unknown) =>
        setForm((cur) => {
            const next = { ...cur, [k]: v };
            // Changing the service/platform invalidates feature links that belonged to the old scope.
            if (k === 'serviceId') Object.assign(next, { platformId: '', featureIds: [], addonIds: [] });
            if (k === 'platformId') Object.assign(next, { featureIds: [], addonIds: [] });
            return next;
        });

    const save = async () => {
        const body: Form = { ...form };
        for (const f of FIELDS[entity]) {
            if (f.required && !String(body[f.key] ?? '').trim()) return toast.error(`${f.label} is required`);
            if (f.type === 'lines') body[f.key] = (body[f.key] as string[]).map((l) => l.trim()).filter(Boolean);
            if (f.type === 'number') body[f.key] = body[f.key] === '' ? null : Number(body[f.key]);
        }
        if (body.platformId === '') body.platformId = null;
        try {
            const saved = id ? await updateItem({ entity, id, body }).unwrap() : await createItem({ entity, body }).unwrap();
            toast.success(`${SINGULAR[entity][0]!.toUpperCase()}${SINGULAR[entity].slice(1)} saved`);
            onSaved?.(saved as { _id: string } & Form);
            onClose();
        } catch (e) {
            toast.error((e as { data?: { message?: string } })?.data?.message || 'Failed to save');
        }
    };

    const ctx: Ctx = { services, platforms, features, form };
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{id ? 'Edit' : 'New'} {SINGULAR[entity]}</DialogTitle>
                    <DialogDescription>Links to other items are stored by reference.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    {FIELDS[entity].filter((f) => !f.show || f.show(form)).map((f) => (
                        <div key={f.key} className={f.full || f.type === 'ids' || f.type === 'lines' || f.type === 'blueprint' ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
                            {f.type !== 'switch' && <Label className="text-xs">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>}
                            {f.type === 'text' && <Input value={form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />}
                            {f.type === 'number' && <Input type="number" min={0} value={form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />}
                            {f.type === 'textarea' && <Textarea rows={2} value={form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />}
                            {f.type === 'lines' && <Textarea rows={4} value={(form[f.key] as string[]).join('\n')} onChange={(e) => setField(f.key, e.target.value.split('\n'))} />}
                            {f.type === 'select' && (
                                <Select value={String(form[f.key] ?? '') || '__none'} onValueChange={(v) => setField(f.key, v === '__none' ? '' : v)}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                                    <SelectContent>
                                        {f.options!(ctx).map((o) => <SelectItem key={o.value || '__none'} value={o.value || '__none'}>{o.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                            {f.type === 'blueprint' && <BlueprintEditor scope={entity === 'services' ? 'service' : 'package'} value={form[f.key]} onChange={(v) => setField(f.key, v)} />}
                            {f.type === 'ids' && <IdChecklist options={f.options!(ctx)} value={form[f.key] ?? []} onChange={(v) => setField(f.key, v)} />}
                            {f.type === 'switch' && (
                                <label className="flex items-center gap-3 pt-6 text-sm"><Switch checked={!!form[f.key]} onCheckedChange={(v) => setField(f.key, v)} /> {f.label}</label>
                            )}
                            {f.hint && f.type !== 'switch' && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button disabled={creating || updating} onClick={save}>{creating || updating ? 'Saving…' : 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
