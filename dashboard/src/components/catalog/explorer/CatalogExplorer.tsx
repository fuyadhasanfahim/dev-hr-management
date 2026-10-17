'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    IconArrowDown,
    IconArrowUp,
    IconCheck,
    IconChevronDown,
    IconChevronRight,
    IconCopy,
    IconLink,
    IconPencil,
    IconPlus,
    IconSearch,
    IconTrash,
    IconX,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import {
    AddInline,
    BulkButton,
    IconBtn,
    Tip,
    addonPrompt,
    freshOnly,
    listPrompt,
    milestonePrompt,
    norm,
    parseAddons,
    parseLines,
    parseMilestones,
} from '@/components/quotation/list-kit';
import {
    useCreateCatalogItemMutation,
    useDeleteCatalogItemMutation,
    useDuplicateCatalogItemMutation,
    useGetCatalogGraphQuery,
    useToggleCatalogItemMutation,
    useUpdateCatalogItemMutation,
} from '@/redux/features/catalog/catalogApi';
import type {
    CatalogEntity,
    CatalogFeature,
    CatalogGraph,
    CatalogPackage,
    CatalogSection,
    CatalogSectionItem,
    CatalogSectionKind,
    CatalogService,
    FormEntity,
} from '@/types/catalog.type';
import { EntityFormDialog, IdChecklist, type Form } from '../EntityFormDialog';
import { SECTION_META, unitLabel } from '../canvas/section-meta';

// ───────────────────────────── helpers ─────────────────────────────

/** The quotation wizard only reads these content blocks, so they are the only ones the explorer shows. */
const CONTENT_KINDS: CatalogSectionKind[] = ['projectTitle', 'projectOverview', 'deliverables', 'milestones', 'clientResponsibilities', 'exclusions'];

const errMsg = (e: unknown) => (e as { data?: { message?: string } })?.data?.message || 'Something went wrong';
const bySort = <T extends { sortOrder: number; name?: string }>(a: T, b: T) => a.sortOrder - b.sortOrder || (a.name ?? '').localeCompare(b.name ?? '');
const filled = (s?: CatalogSection) => !!s && s.isActive !== false && (s.items.length > 0 || !!s.text?.trim());
const pkgKey = (s: CatalogSection) => String(s.packageId ?? '');
const money = (n: number) => n.toLocaleString('en-US');

function useActions() {
    const [create] = useCreateCatalogItemMutation();
    const [update] = useUpdateCatalogItemMutation();
    const [remove] = useDeleteCatalogItemMutation();
    const [toggle] = useToggleCatalogItemMutation();
    const [duplicate] = useDuplicateCatalogItemMutation();
    return {
        /** Runs a request, toasts a failure and resolves undefined instead of throwing. */
        run: async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
            try {
                const r = await fn();
                if (ok) toast.success(ok);
                return r;
            } catch (e) {
                toast.error(errMsg(e));
                return undefined;
            }
        },
        create: (entity: CatalogEntity, body: Record<string, unknown>) => create({ entity, body }).unwrap(),
        patch: (entity: CatalogEntity, id: string, body: Record<string, unknown>) => update({ entity, id, body }).unwrap(),
        remove: (entity: CatalogEntity, id: string) => remove({ entity, id }).unwrap(),
        toggle: (entity: CatalogEntity, id: string) => toggle({ entity, id }).unwrap(),
        duplicate: (entity: 'packages' | 'sections', id: string, body: Record<string, unknown>) => duplicate({ entity, id, body }).unwrap(),
    };
}

/** Which content a package really ends up with (its own block, else the service-wide default). */
function coverage(graph: CatalogGraph, pkg: CatalogPackage) {
    const eff = (kind: CatalogSectionKind) =>
        graph.sections.find((s) => s.serviceId === pkg.serviceId && s.kind === kind && pkgKey(s) === pkg._id) ??
        graph.sections.find((s) => s.serviceId === pkg.serviceId && s.kind === kind && !s.packageId);
    return [
        { k: 'F', label: 'Features', ok: pkg.featureIds.length > 0 },
        { k: 'A', label: 'Add-ons', ok: pkg.addonIds.length > 0 },
        { k: 'D', label: 'Deliverables', ok: filled(eff('deliverables')) },
        { k: 'M', label: 'Milestones', ok: filled(eff('milestones')) },
        { k: 'R', label: 'Client responsibilities', ok: filled(eff('clientResponsibilities')) },
        { k: 'X', label: 'Exclusions', ok: filled(eff('exclusions')) },
    ];
}

function CoverageChips({ graph, pkg }: { graph: CatalogGraph; pkg: CatalogPackage }) {
    return (
        <span className="flex shrink-0 items-center gap-0.5">
            {coverage(graph, pkg).map((c) => (
                <Tip key={c.k} label={`${c.label}: ${c.ok ? 'added' : 'missing'}`}>
                    <span className={cn('flex size-[18px] items-center justify-center rounded text-[10px] font-semibold', c.ok ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground/60')}>{c.k}</span>
                </Tip>
            ))}
        </span>
    );
}

// ───────────────────────────── features / add-ons tab ─────────────────────────────

function FeaturesTab({ graph, pkg, kind, canManage }: { graph: CatalogGraph; pkg: CatalogPackage; kind: 'included' | 'addon'; canManage: boolean }) {
    const act = useActions();
    const field = kind === 'included' ? 'featureIds' : 'addonIds';
    const byId = new Map(graph.features.map((f) => [f._id, f]));
    const rows = pkg[field].map((id) => byId.get(id)).filter((f): f is CatalogFeature => !!f);
    const rowIds = rows.map((r) => r._id);
    const [edit, setEdit] = useState<{ id: string; name: string; price: string } | null>(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [pick, setPick] = useState<string[]>([]);
    const isAddon = kind === 'addon';

    const setIds = (next: string[]) => act.run(() => act.patch('packages', pkg._id, { [field]: next }));
    const move = (i: number, d: -1 | 1) => {
        const j = i + d;
        if (j < 0 || j >= rowIds.length) return;
        const next = [...rowIds];
        [next[i], next[j]] = [next[j]!, next[i]!];
        void setIds(next);
    };

    /** Reuses an identical feature of this service/platform, otherwise creates it. */
    const ensure = async (name: string, price: number) => {
        const hit = graph.features.find((f) => f.serviceId === pkg.serviceId && f.kind === kind && (f.platformId ?? null) === (pkg.platformId ?? null) && norm(f.name) === norm(name));
        if (hit) return hit._id;
        const doc = await act.create('features', { serviceId: pkg.serviceId, platformId: pkg.platformId ?? null, name, kind, price });
        return doc._id;
    };
    const addMany = (list: { name: string; price: number }[]) =>
        act.run(async () => {
            const names = new Set(freshOnly(rows.map((r) => r.name), list.map((l) => l.name)).map(norm));
            const add: string[] = [];
            for (const it of list.filter((l) => names.has(norm(l.name)))) {
                const id = await ensure(it.name, it.price);
                if (!rowIds.includes(id) && !add.includes(id)) add.push(id);
            }
            if (add.length) await act.patch('packages', pkg._id, { [field]: [...rowIds, ...add] });
        });

    const removeFrom = (f: CatalogFeature) =>
        act.run(async () => {
            await act.patch('packages', pkg._id, { [field]: rowIds.filter((i) => i !== f._id) });
            const used = graph.packages.some((p) => p._id !== pkg._id && (p.featureIds.includes(f._id) || p.addonIds.includes(f._id)));
            if (!used) await act.remove('features', f._id); // nothing else uses it, so do not leave an orphan behind
        });

    const saveEdit = async () => {
        if (!edit || !edit.name.trim()) return setEdit(null);
        const f = byId.get(edit.id);
        const body: Record<string, unknown> = { name: edit.name.trim() };
        if (isAddon) body.price = Number(edit.price) || 0;
        if (f && (f.name !== body.name || (isAddon && f.price !== body.price))) await act.run(() => act.patch('features', edit.id, body));
        setEdit(null);
    };

    const linkable = graph.features
        .filter((f) => f.serviceId === pkg.serviceId && f.kind === kind && (!f.platformId || f.platformId === (pkg.platformId ?? null)) && !rowIds.includes(f._id))
        .map((f) => ({ value: f._id, label: isAddon ? `${f.name} — ${money(f.price)}` : f.name, group: f.group || 'General' }));

    return (
        <div className="space-y-3">
            {rows.length === 0 && <p className="py-2 text-sm text-muted-foreground">{isAddon ? 'No add-ons for this package yet.' : 'No features for this package yet.'}</p>}
            <div className="space-y-0.5">
                {rows.map((f, i) => (
                    <div key={f._id} className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">{i + 1}</span>
                        {edit?.id === f._id ? (
                            <>
                                <Input autoFocus className="h-8 min-w-0 flex-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => (e.key === 'Enter' ? void saveEdit() : e.key === 'Escape' && setEdit(null))} />
                                {isAddon && <Input className="h-8 w-24 text-right" type="number" min={0} value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} onKeyDown={(e) => (e.key === 'Enter' ? void saveEdit() : e.key === 'Escape' && setEdit(null))} />}
                                <IconBtn label="Save" onClick={() => void saveEdit()} className="text-primary"><IconCheck className="size-4" /></IconBtn>
                                <IconBtn label="Cancel" onClick={() => setEdit(null)}><IconX className="size-4" /></IconBtn>
                            </>
                        ) : (
                            <>
                                <span className="min-w-0 flex-1 break-words text-sm">
                                    {f.name}
                                    {f.group && <Badge variant="secondary" className="ml-2 text-[10px]">{f.group}</Badge>}
                                </span>
                                {isAddon && <span className="shrink-0 text-sm font-medium">{money(f.price)}</span>}
                                {canManage && (
                                    <div className="flex shrink-0 items-center">
                                        <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><IconArrowUp className="size-4" /></IconBtn>
                                        <IconBtn label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><IconArrowDown className="size-4" /></IconBtn>
                                        <IconBtn label="Edit" className="hover:text-primary" onClick={() => setEdit({ id: f._id, name: f.name, price: String(f.price) })}><IconPencil className="size-4" /></IconBtn>
                                        <IconBtn label="Remove from this package" className="text-destructive/80 hover:text-destructive" onClick={() => void removeFrom(f)}><IconTrash className="size-4" /></IconBtn>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>

            {canManage && (
                <div className="flex items-start gap-2 pt-1">
                    <div className="min-w-0 flex-1">
                        <AddInline
                            label={isAddon ? 'Add Add-on' : 'Add Feature'}
                            placeholder={isAddon ? 'Add-on name' : 'Feature name'}
                            secondPlaceholder={isAddon ? 'Price' : undefined}
                            onAdd={(name, price) => void addMany([{ name, price: Number(price) || 0 }])}
                        />
                    </div>
                    {isAddon ? (
                        <BulkButton noun="add-ons" prompt={addonPrompt} placeholder={'[{ "name": "SEO setup", "price": 5000 }]'} parse={parseAddons} onImport={(list) => void addMany(list)} />
                    ) : (
                        <BulkButton noun="features" prompt={listPrompt('included features')} placeholder={'["Product catalog", "Checkout"]'} parse={parseLines} onImport={(list) => void addMany(list.map((name) => ({ name, price: 0 })))} />
                    )}
                    <Tip label={`Link an existing ${isAddon ? 'add-on' : 'feature'} of this service`}>
                        <Button type="button" variant="outline" size="icon" className="size-9" aria-label="Link existing" disabled={!linkable.length} onClick={() => { setPick([]); setLinkOpen(true); }}>
                            <IconLink className="size-[18px]" />
                        </Button>
                    </Tip>
                </div>
            )}

            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Link existing {isAddon ? 'add-ons' : 'features'}</DialogTitle>
                        <DialogDescription>Features are shared inside a service, so pick the ones another package already has.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[50vh] overflow-y-auto"><IdChecklist options={linkable} value={pick} onChange={setPick} /></div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
                        <Button type="button" disabled={!pick.length} onClick={async () => { await setIds([...rowIds, ...pick]); setLinkOpen(false); }}>Link {pick.length || ''}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ───────────────────────────── content tab ─────────────────────────────

const toDuration = (t: string) => {
    const m = t.match(/(\d+(?:\.\d+)?)\s*(day|week|month)/i);
    return m ? { value: Number(m[1]), unit: m[2]!.toLowerCase() as 'day' | 'week' | 'month' } : null;
};
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random()}`);

function TextSection({ section, canManage }: { section: CatalogSection; canManage: boolean }) {
    const act = useActions();
    const [v, setV] = useState(section.text ?? '');
    const dirty = v !== (section.text ?? '');
    return (
        <div className="space-y-2">
            <Textarea rows={5} value={v} disabled={!canManage} onChange={(e) => setV(e.target.value)} placeholder={SECTION_META[section.kind].placeholder} />
            {canManage && (
                <div className="flex justify-end">
                    <Button type="button" size="sm" disabled={!dirty} onClick={() => void act.run(() => act.patch('sections', section._id, { text: v }), 'Saved')}>Save</Button>
                </div>
            )}
        </div>
    );
}

function ListSection({ section, canManage }: { section: CatalogSection; canManage: boolean }) {
    const act = useActions();
    const meta = SECTION_META[section.kind];
    const withDur = !!meta.withDuration;
    const items = section.items;
    const [edit, setEdit] = useState<{ key: string; title: string; duration: string } | null>(null);
    const save = (next: CatalogSectionItem[]) => act.run(() => act.patch('sections', section._id, { items: next }));
    const move = (i: number, d: -1 | 1) => {
        const j = i + d;
        if (j < 0 || j >= items.length) return;
        const next = [...items];
        [next[i], next[j]] = [next[j]!, next[i]!];
        void save(next);
    };
    const saveEdit = async () => {
        if (!edit || !edit.title.trim()) return setEdit(null);
        await save(items.map((it) => (it.key === edit.key ? { ...it, title: edit.title.trim(), ...(withDur ? { duration: toDuration(edit.duration) } : {}) } : it)));
        setEdit(null);
    };
    const noun = meta.label.toLowerCase();
    return (
        <div className="space-y-2">
            <div className="space-y-0.5">
                {items.map((it, i) => (
                    <div key={it.key} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">{i + 1}</span>
                        {edit?.key === it.key ? (
                            <>
                                <Input autoFocus className="h-8 min-w-0 flex-1" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} onKeyDown={(e) => (e.key === 'Enter' ? void saveEdit() : e.key === 'Escape' && setEdit(null))} />
                                {withDur && <Input className="h-8 w-24 text-center" value={edit.duration} placeholder="1 week" onChange={(e) => setEdit({ ...edit, duration: e.target.value })} onKeyDown={(e) => (e.key === 'Enter' ? void saveEdit() : e.key === 'Escape' && setEdit(null))} />}
                                <IconBtn label="Save" onClick={() => void saveEdit()} className="text-primary"><IconCheck className="size-4" /></IconBtn>
                                <IconBtn label="Cancel" onClick={() => setEdit(null)}><IconX className="size-4" /></IconBtn>
                            </>
                        ) : (
                            <>
                                <span className="min-w-0 flex-1 break-words text-sm">{it.title}</span>
                                {withDur && it.duration && <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{unitLabel(it.duration)}</span>}
                                {canManage && (
                                    <div className="flex shrink-0 items-center">
                                        <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><IconArrowUp className="size-4" /></IconBtn>
                                        <IconBtn label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><IconArrowDown className="size-4" /></IconBtn>
                                        <IconBtn label="Edit" className="hover:text-primary" onClick={() => setEdit({ key: it.key, title: it.title, duration: unitLabel(it.duration) })}><IconPencil className="size-4" /></IconBtn>
                                        <IconBtn label="Delete" className="text-destructive/80 hover:text-destructive" onClick={() => void save(items.filter((x) => x.key !== it.key))}><IconTrash className="size-4" /></IconBtn>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </div>
            {canManage && (
                <div className="flex items-start gap-2 pt-1">
                    <div className="min-w-0 flex-1">
                        <AddInline
                            label={meta.placeholder}
                            placeholder="Type a title and press Enter"
                            secondPlaceholder={withDur ? '1 week' : undefined}
                            onAdd={(title, d) => void save([...items, { key: newKey(), title, ...(withDur ? { duration: toDuration(d) } : {}) }])}
                        />
                    </div>
                    {withDur ? (
                        <BulkButton
                            noun={noun}
                            prompt={milestonePrompt}
                            placeholder={'[{ "title": "Design", "duration": "2 weeks" }]'}
                            parse={parseMilestones}
                            onImport={(list) => {
                                const keep = new Set(freshOnly(items.map((x) => x.title), list.map((x) => x.title)).map(norm));
                                void save([...items, ...list.filter((m) => keep.has(norm(m.title))).map((m) => ({ key: newKey(), title: m.title, duration: toDuration(m.duration) }))]);
                            }}
                        />
                    ) : (
                        <BulkButton noun={noun} prompt={listPrompt(noun)} placeholder={'["First item", "Second item"]'} parse={parseLines} onImport={(list) => void save([...items, ...freshOnly(items.map((x) => x.title), list).map((title) => ({ key: newKey(), title }))])} />
                    )}
                </div>
            )}
        </div>
    );
}

function SectionCard({ graph, service, pkg, kind, canManage }: { graph: CatalogGraph; service: CatalogService; pkg: CatalogPackage | null; kind: CatalogSectionKind; canManage: boolean }) {
    const act = useActions();
    const meta = SECTION_META[kind];
    const Icon = meta.icon;
    const own = graph.sections.find((s) => s.serviceId === service._id && s.kind === kind && pkgKey(s) === (pkg?._id ?? ''));
    const inherited = pkg ? graph.sections.find((s) => s.serviceId === service._id && s.kind === kind && !s.packageId) : undefined;
    const showInherited = !own && filled(inherited);
    const status = own ? (pkg ? 'This package' : 'Service default') : showInherited ? 'From service default' : 'Empty';

    return (
        <Card className="gap-3 py-4 shadow-xs">
            <CardHeader className="px-4 md:px-5">
                <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
                    <div className="min-w-0">
                        <CardTitle className="text-sm">{meta.label}</CardTitle>
                        <CardDescription className="text-xs">{meta.hint ?? ''}</CardDescription>
                    </div>
                </div>
                <CardAction className="flex items-center gap-2">
                    <Badge variant={own ? 'default' : 'secondary'} className="text-[10px]">{status}</Badge>
                    {canManage && own && pkg && (
                        <IconBtn label="Remove this package's override" className="text-destructive/80 hover:text-destructive" onClick={() => void act.run(() => act.remove('sections', own._id))}>
                            <IconTrash className="size-4" />
                        </IconBtn>
                    )}
                </CardAction>
            </CardHeader>
            <CardContent className="px-4 md:px-5">
                {own ? (
                    meta.type === 'text' ? <TextSection key={own._id} section={own} canManage={canManage} /> : <ListSection section={own} canManage={canManage} />
                ) : (
                    <div className="space-y-3">
                        {showInherited && inherited && (
                            <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                                {meta.type === 'text' ? <p className="line-clamp-4 whitespace-pre-line">{inherited.text}</p> : <ul className="list-disc space-y-0.5 pl-5">{inherited.items.map((i) => <li key={i.key}>{i.title}{i.duration ? ` — ${unitLabel(i.duration)}` : ''}</li>)}</ul>}
                            </div>
                        )}
                        {canManage && (
                            <div className="flex flex-wrap gap-2">
                                {showInherited && inherited && pkg && (
                                    <Button type="button" size="sm" variant="outline" onClick={() => void act.run(() => act.duplicate('sections', inherited._id, { serviceId: service._id, packageId: pkg._id }), 'Copied to this package')}>
                                        <IconCopy className="size-4" /> Customize for this package
                                    </Button>
                                )}
                                <Button type="button" size="sm" variant="outline" onClick={() => void act.run(() => act.create('sections', { serviceId: service._id, packageId: pkg?._id ?? null, kind, items: [], text: '' }))}>
                                    <IconPlus className="size-4" /> {showInherited ? 'Start empty' : `Add ${meta.label.toLowerCase()}`}
                                </Button>
                            </div>
                        )}
                        {!canManage && !showInherited && <p className="text-sm text-muted-foreground">Nothing added yet.</p>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ContentTab({ graph, service, pkg, canManage }: { graph: CatalogGraph; service: CatalogService; pkg: CatalogPackage | null; canManage: boolean }) {
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            {CONTENT_KINDS.map((k) => (
                <div key={k} className={cn('min-w-0', SECTION_META[k].type === 'text' && 'lg:col-span-1')}>
                    <SectionCard graph={graph} service={service} pkg={pkg} kind={k} canManage={canManage} />
                </div>
            ))}
        </div>
    );
}

// ───────────────────────────── explorer ─────────────────────────────

type Sel = { type: 'service' | 'package'; id: string };

/** One screen for the catalog: service → platform → package tree on the left, everything inside the selection on the right. */
export default function CatalogExplorer() {
    const { can } = usePermissions();
    const canManage = can('catalog.manage');
    const { data: graph, isLoading } = useGetCatalogGraphQuery();
    const act = useActions();
    const [sel, setSel] = useState<Sel | null>(null);
    const [q, setQ] = useState('');
    const [open, setOpen] = useState<Set<string>>(new Set());
    const [form, setForm] = useState<{ entity: FormEntity; id: string | null; initial?: Form } | null>(null);

    const needle = q.trim().toLowerCase();
    const tree = useMemo(() => {
        if (!graph) return [];
        const hit = (t: string) => !needle || t.toLowerCase().includes(needle);
        return [...graph.services]
            .sort(bySort)
            .map((svc) => {
                const plats = graph.platforms.filter((p) => svc.platformIds.includes(p._id));
                const all = graph.packages.filter((p) => p.serviceId === svc._id).sort(bySort);
                const svcHit = hit(svc.name);
                const groups = [
                    ...plats.map((pl) => ({ key: pl._id, name: pl.name, pkgs: all.filter((p) => p.platformId === pl._id) })),
                    { key: '_none', name: plats.length ? 'No platform' : '', pkgs: all.filter((p) => !p.platformId || !plats.some((pl) => pl._id === p.platformId)) },
                ]
                    .map((g) => ({ ...g, pkgs: svcHit || hit(g.name) ? g.pkgs : g.pkgs.filter((p) => hit(p.name)) }))
                    .filter((g) => g.pkgs.length > 0);
                return { svc, groups, show: svcHit || groups.length > 0 };
            })
            .filter((t) => t.show);
    }, [graph, needle]);

    if (isLoading || !graph) return <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading catalog…</div>;

    const current: Sel | null = sel ?? (graph.services[0] ? { type: 'service', id: [...graph.services].sort(bySort)[0]!._id } : null);
    const curPkg = current?.type === 'package' ? graph.packages.find((p) => p._id === current.id) : undefined;
    const curSvc = graph.services.find((s) => s._id === (curPkg ? curPkg.serviceId : current?.id));
    const platName = (id?: string | null) => graph.platforms.find((p) => p._id === id)?.name;

    const toggleOpen = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const isOpen = (id: string) => !!needle || open.has(id) || curSvc?._id === id;
    const del = async (entity: 'services' | 'packages', id: string, name: string) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        await act.run(() => act.remove(entity, id), 'Deleted');
        setSel(null);
    };

    return (
        <div className="grid min-h-0 items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            {/* ── tree ── */}
            <Card className="gap-3 py-4 shadow-xs lg:sticky lg:top-4 lg:max-h-[calc(100vh-9rem)] lg:overflow-hidden">
                <CardHeader className="px-4">
                    <div className="relative">
                        <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Search services, packages…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
                    {tree.length === 0 && <p className="px-2 py-4 text-sm text-muted-foreground">Nothing found.</p>}
                    {tree.map(({ svc, groups }) => {
                        const expanded = isOpen(svc._id);
                        const active = current?.type === 'service' && current.id === svc._id;
                        const pkgCount = groups.reduce((a, g) => a + g.pkgs.length, 0);
                        return (
                            <div key={svc._id}>
                                <div className={cn('flex items-center gap-1 rounded-md pr-2 hover:bg-muted/60', active && 'bg-primary/10')}>
                                    <button type="button" aria-label={expanded ? 'Collapse' : 'Expand'} className="p-1.5 text-muted-foreground" onClick={() => toggleOpen(svc._id)}>
                                        {expanded ? <IconChevronDown className="size-4" /> : <IconChevronRight className="size-4" />}
                                    </button>
                                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left" onClick={() => { setSel({ type: 'service', id: svc._id }); setOpen((o) => new Set(o).add(svc._id)); }}>
                                        <span className={cn('truncate text-sm font-medium', !svc.isActive && 'text-muted-foreground line-through')}>{svc.name}</span>
                                        <Badge variant="secondary" className="text-[10px]">{pkgCount}</Badge>
                                    </button>
                                </div>
                                {expanded && (
                                    <div className="ml-4 space-y-0.5 border-l pl-2">
                                        {groups.map((g) => (
                                            <div key={g.key}>
                                                {g.name && <p className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.name}</p>}
                                                {g.pkgs.map((p) => (
                                                    <button
                                                        key={p._id}
                                                        type="button"
                                                        onClick={() => setSel({ type: 'package', id: p._id })}
                                                        className={cn('flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60', current?.type === 'package' && current.id === p._id && 'bg-primary/10')}
                                                    >
                                                        <span className={cn('truncate text-sm', !p.isActive && 'text-muted-foreground line-through')}>{p.name}</span>
                                                        <CoverageChips graph={graph} pkg={p} />
                                                    </button>
                                                ))}
                                            </div>
                                        ))}
                                        {groups.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No packages yet.</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
                {canManage && (
                    <div className="px-4">
                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setForm({ entity: 'services', id: null })}>
                            <IconPlus className="size-4" /> Add service
                        </Button>
                    </div>
                )}
            </Card>

            {/* ── detail ── */}
            <div className="min-w-0 space-y-4">
                {!curSvc && <Card className="py-10 text-center text-sm text-muted-foreground shadow-xs">No services in the catalog yet. Add one to start.</Card>}

                {curSvc && (
                    <Card className="gap-3 py-4 shadow-xs">
                        <CardHeader className="px-4 md:px-5">
                            <div className="min-w-0">
                                <CardDescription className="text-xs">
                                    {curSvc.name}{curPkg && platName(curPkg.platformId) ? ` › ${platName(curPkg.platformId)}` : ''}
                                </CardDescription>
                                <CardTitle className="mt-0.5 flex flex-wrap items-center gap-2 text-lg">
                                    {curPkg ? curPkg.name : curSvc.name}
                                    {curPkg?.badge && <Badge className="text-[10px]">{curPkg.badge}</Badge>}
                                    {curPkg && <span className="text-sm font-normal text-muted-foreground">{curPkg.price === null ? 'Custom quote' : money(curPkg.price)}{curPkg.billingCycle !== 'one-time' ? ` / ${curPkg.unitLabel || curPkg.billingCycle.replace('per-', '')}` : ''}</span>}
                                </CardTitle>
                            </div>
                            {canManage && (
                                <CardAction className="flex items-center gap-1">
                                    <Tip label={(curPkg ?? curSvc).isActive ? 'Active - click to deactivate' : 'Inactive - click to activate'}>
                                        <span><Switch checked={(curPkg ?? curSvc).isActive} onCheckedChange={() => void act.run(() => act.toggle(curPkg ? 'packages' : 'services', (curPkg ?? curSvc)._id))} aria-label="Active" /></span>
                                    </Tip>
                                    {curPkg ? (
                                        <IconBtn label="Duplicate package" onClick={() => void act.run(() => act.duplicate('packages', curPkg._id, {}), 'Package duplicated')}><IconCopy className="size-4" /></IconBtn>
                                    ) : (
                                        <IconBtn label="Add package" onClick={() => setForm({ entity: 'packages', id: null, initial: { serviceId: curSvc._id } })}><IconPlus className="size-4" /></IconBtn>
                                    )}
                                    <IconBtn label={curPkg ? 'Edit package' : 'Edit service'} className="hover:text-primary" onClick={() => setForm({ entity: curPkg ? 'packages' : 'services', id: (curPkg ?? curSvc)._id, initial: (curPkg ?? curSvc) as unknown as Form })}><IconPencil className="size-4" /></IconBtn>
                                    <IconBtn label={curPkg ? 'Delete package' : 'Delete service'} className="text-destructive/80 hover:text-destructive" onClick={() => void del(curPkg ? 'packages' : 'services', (curPkg ?? curSvc)._id, (curPkg ?? curSvc).name)}><IconTrash className="size-4" /></IconBtn>
                                </CardAction>
                            )}
                        </CardHeader>
                        {curPkg && (
                            <CardContent className="px-4 md:px-5">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <CoverageChips graph={graph} pkg={curPkg} />
                                    <span>F features · A add-ons · D deliverables · M milestones · R responsibilities · X exclusions</span>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                )}

                {curSvc && curPkg && (
                    <Tabs defaultValue="features" key={curPkg._id}>
                        <TabsList>
                            <TabsTrigger value="features">Features <span className="ml-1.5 text-xs text-muted-foreground">{curPkg.featureIds.length}</span></TabsTrigger>
                            <TabsTrigger value="addons">Add-ons <span className="ml-1.5 text-xs text-muted-foreground">{curPkg.addonIds.length}</span></TabsTrigger>
                            <TabsTrigger value="content">Content</TabsTrigger>
                        </TabsList>
                        <TabsContent value="features" className="mt-3">
                            <Card className="py-4 shadow-xs"><CardContent className="px-4 md:px-5"><FeaturesTab graph={graph} pkg={curPkg} kind="included" canManage={canManage} /></CardContent></Card>
                        </TabsContent>
                        <TabsContent value="addons" className="mt-3">
                            <Card className="py-4 shadow-xs"><CardContent className="px-4 md:px-5"><FeaturesTab graph={graph} pkg={curPkg} kind="addon" canManage={canManage} /></CardContent></Card>
                        </TabsContent>
                        <TabsContent value="content" className="mt-3">
                            <ContentTab graph={graph} service={curSvc} pkg={curPkg} canManage={canManage} />
                        </TabsContent>
                    </Tabs>
                )}

                {curSvc && !curPkg && (
                    <Tabs defaultValue="packages" key={curSvc._id}>
                        <TabsList>
                            <TabsTrigger value="packages">Packages</TabsTrigger>
                            <TabsTrigger value="content">Default content</TabsTrigger>
                        </TabsList>
                        <TabsContent value="packages" className="mt-3">
                            <Card className="py-2 shadow-xs">
                                <CardContent className="divide-y px-4 md:px-5">
                                    {graph.packages.filter((p) => p.serviceId === curSvc._id).sort(bySort).map((p) => (
                                        <button key={p._id} type="button" onClick={() => { setSel({ type: 'package', id: p._id }); setOpen((o) => new Set(o).add(curSvc._id)); }} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-primary">
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium">{p.name}</span>
                                                <span className="block text-xs text-muted-foreground">{platName(p.platformId) ?? 'No platform'} · {p.price === null ? 'Custom quote' : money(p.price)}</span>
                                            </span>
                                            <CoverageChips graph={graph} pkg={p} />
                                        </button>
                                    ))}
                                    {graph.packages.every((p) => p.serviceId !== curSvc._id) && <p className="py-4 text-sm text-muted-foreground">No packages yet.</p>}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="content" className="mt-3">
                            <p className="mb-3 text-xs text-muted-foreground">Used by every package of this service unless the package has its own version.</p>
                            <ContentTab graph={graph} service={curSvc} pkg={null} canManage={canManage} />
                        </TabsContent>
                    </Tabs>
                )}
            </div>

            {form && <EntityFormDialog entity={form.entity} id={form.id} initial={form.initial} onClose={() => setForm(null)} />}
        </div>
    );
}
