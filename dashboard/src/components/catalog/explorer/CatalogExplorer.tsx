'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    IconCheck,
    IconChevronDown,
    IconIndentDecrease,
    IconIndentIncrease,
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
    DragGrip,
    FEATURE_PROMPT,
    IconBtn,
    Tip,
    addonPrompt,
    canIndent,
    fixDepths,
    freshOnly,
    listPrompt,
    milestonePrompt,
    moveBlockTo,
    moveTo,
    norm,
    parseAddons,
    parseFeatureTree,
    parseLines,
    parseMilestones,
    removeKeepChildren,
    shiftBlock,
    useDragReorder,
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
import { SECTION_META, unitLabel } from '../section-meta';
import { BlueprintEditor } from '../BlueprintEditor';
import type { Blueprint } from '@/lib/quotation-blueprint';

// ───────────────────────────── helpers ─────────────────────────────


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
                    <span className={cn('flex size-[18px] items-center justify-center rounded text-[10px] font-semibold', c.ok ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground/75')}>{c.k}</span>
                </Tip>
            ))}
        </span>
    );
}

// ───────────────────────────── features / add-ons tab ─────────────────────────────

type FeatureRow = { f: CatalogFeature; depth: number };

/** Included features are an outline (main → sub → sub-sub); add-ons are a flat priced list. */
function FeaturesTab({ graph, pkg, kind, canManage }: { graph: CatalogGraph; pkg: CatalogPackage; kind: 'included' | 'addon'; canManage: boolean }) {
    const act = useActions();
    const isAddon = kind === 'addon';
    const field = isAddon ? 'addonIds' : 'featureIds';
    const byId = new Map(graph.features.map((f) => [f._id, f]));
    const rows: FeatureRow[] = fixDepths(
        pkg[field]
            .map((id) => byId.get(id))
            .filter((f): f is CatalogFeature => !!f)
            .map((f) => ({ f, depth: isAddon ? 0 : pkg.featureDepths?.[f._id] ?? 0 })),
    );
    const rowIds = rows.map((r) => r.f._id);
    const [edit, setEdit] = useState<{ id: string; name: string; price: string } | null>(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [pick, setPick] = useState<string[]>([]);

    const counters = [0, 0, 0];
    const labels = rows.map((r) => {
        counters[r.depth]!++;
        for (let k = r.depth + 1; k < 3; k++) counters[k] = 0;
        return counters.slice(0, r.depth + 1).join('.');
    });

    /** Saves order + outline depths together (the server drops depths of ids that are no longer linked). */
    const persist = (next: FeatureRow[]) => {
        const fixed = fixDepths(next);
        return act.patch(
            'packages',
            pkg._id,
            isAddon
                ? { addonIds: fixed.map((r) => r.f._id) }
                : { featureIds: fixed.map((r) => r.f._id), featureDepths: Object.fromEntries(fixed.filter((r) => r.depth > 0).map((r) => [r.f._id, r.depth])) },
        );
    };
    const saveRows = (next: FeatureRow[]) => act.run(() => persist(next));
    const dnd = useDragReorder((from, to) => void saveRows(moveBlockTo(rows, from, to)));

    /** Reuses an identical feature of this service/platform, otherwise creates it. */
    const ensure = async (name: string, price: number) => {
        const hit = graph.features.find((f) => f.serviceId === pkg.serviceId && f.kind === kind && (f.platformId ?? null) === (pkg.platformId ?? null) && norm(f.name) === norm(name));
        if (hit) return hit;
        return (await act.create('features', { serviceId: pkg.serviceId, platformId: pkg.platformId ?? null, name, kind, price })) as unknown as CatalogFeature;
    };
    const addMany = (list: { name: string; price: number; depth: number }[]) =>
        act.run(async () => {
            const names = new Set(freshOnly(rows.map((r) => r.f.name), list.map((l) => l.name)).map(norm));
            const add: FeatureRow[] = [];
            for (const it of list.filter((l) => names.has(norm(l.name)))) {
                const f = await ensure(it.name, it.price);
                if (rowIds.includes(f._id) || add.some((a) => a.f._id === f._id)) continue;
                add.push({ f, depth: isAddon ? 0 : it.depth });
            }
            if (add.length) await persist([...rows, ...add]);
        });

    const removeFrom = (i: number) =>
        act.run(async () => {
            const f = rows[i]!.f;
            await persist(isAddon ? rows.filter((_, k) => k !== i) : removeKeepChildren(rows, i));
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
                {rows.map((r, i) => {
                    const f = r.f;
                    return (
                        <div key={f._id} {...dnd.row(i)} className={cn('flex items-center gap-2 rounded-md py-1.5 pr-1 hover:bg-muted/50', dnd.rowClass(i))} style={{ paddingLeft: 4 + r.depth * 22 }}>
                            {canManage && <DragGrip {...dnd.handle(i)} />}
                            <span className="w-9 shrink-0 text-[11px] tabular-nums text-muted-foreground">{isAddon ? i + 1 : labels[i]}</span>
                            {edit?.id === f._id ? (
                                <>
                                    <Input autoFocus className="h-8 min-w-0 flex-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => (e.key === 'Enter' ? void saveEdit() : e.key === 'Escape' && setEdit(null))} />
                                    {isAddon && <Input className="h-8 w-24 text-right" type="number" min={0} value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} onKeyDown={(e) => (e.key === 'Enter' ? void saveEdit() : e.key === 'Escape' && setEdit(null))} />}
                                    <IconBtn label="Save" onClick={() => void saveEdit()} className="text-primary"><IconCheck className="size-4" /></IconBtn>
                                    <IconBtn label="Cancel" onClick={() => setEdit(null)}><IconX className="size-4" /></IconBtn>
                                </>
                            ) : (
                                <>
                                    <span className={cn('min-w-0 flex-1 break-words text-sm', !isAddon && r.depth === 0 && 'font-medium')}>
                                        {f.name}
                                        {f.group && <Badge variant="secondary" className="ml-2 text-[10px]">{f.group}</Badge>}
                                    </span>
                                    {isAddon && <span className="shrink-0 text-sm font-medium">{money(f.price)}</span>}
                                    {canManage && (
                                        <div className="flex shrink-0 items-center">
                                            {!isAddon && (
                                                <>
                                                    <IconBtn label="Make sub-feature" disabled={!canIndent(rows, i)} onClick={() => void saveRows(shiftBlock(rows, i, 1))}><IconIndentIncrease className="size-4" /></IconBtn>
                                                    <IconBtn label="Make main feature" disabled={r.depth === 0} onClick={() => void saveRows(shiftBlock(rows, i, -1))}><IconIndentDecrease className="size-4" /></IconBtn>
                                                </>
                                            )}
                                            <IconBtn label="Edit" className="hover:text-primary" onClick={() => setEdit({ id: f._id, name: f.name, price: String(f.price) })}><IconPencil className="size-4" /></IconBtn>
                                            <IconBtn label="Remove from this package" className="text-destructive/80 hover:text-destructive" onClick={() => void removeFrom(i)}><IconTrash className="size-4" /></IconBtn>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {canManage && (
                <div className="flex items-start gap-2 pt-1">
                    <div className="min-w-0 flex-1">
                        <AddInline
                            label={isAddon ? 'Add Add-on' : 'Add Feature'}
                            placeholder={isAddon ? 'Add-on name' : 'Feature name'}
                            secondPlaceholder={isAddon ? 'Price' : undefined}
                            onAdd={(name, price) => void addMany([{ name, price: Number(price) || 0, depth: 0 }])}
                        />
                    </div>
                    {isAddon ? (
                        <BulkButton noun="add-ons" prompt={addonPrompt} placeholder={'[{ "name": "SEO setup", "price": 5000 }]'} parse={parseAddons} onImport={(list) => void addMany(list.map((a) => ({ ...a, depth: 0 })))} />
                    ) : (
                        <BulkButton
                            noun="features"
                            prompt={FEATURE_PROMPT}
                            placeholder={'[\n  { "name": "Store Design and Setup", "children": [ { "name": "Homepage design" } ] }\n]'}
                            parse={parseFeatureTree}
                            onImport={(list) => void addMany(list.map((l) => ({ name: l.text, price: 0, depth: l.depth ?? 0 })))}
                        />
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
                        <Button
                            type="button"
                            disabled={!pick.length}
                            onClick={async () => {
                                await saveRows([...rows, ...pick.map((id) => ({ f: byId.get(id)!, depth: 0 }))]);
                                setLinkOpen(false);
                            }}
                        >
                            Link {pick.length || ''}
                        </Button>
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
    const dnd = useDragReorder((from, to) => void save(moveTo(items, from, to)));
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
                    <div key={it.key} {...dnd.row(i)} className={cn('flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50', dnd.rowClass(i))}>
                        {canManage && <DragGrip {...dnd.handle(i)} />}
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

/** Package facts + the lists the wizard's Terms step is pre-filled from. */
function PackageFacts({ pkg, canManage }: { pkg: CatalogPackage; canManage: boolean }) {
    const act = useActions();
    const [duration, setDuration] = useState(pkg.duration ?? '');
    const [support, setSupport] = useState(pkg.supportPeriod ?? '');
    const dirty = duration !== (pkg.duration ?? '') || support !== (pkg.supportPeriod ?? '');
    return (
        <Card className="gap-3 py-4 shadow-xs">
            <CardHeader className="px-4 md:px-5">
                <CardTitle className="text-sm">Delivery & support period</CardTitle>
                <CardDescription className="text-xs">Fills Estimated Delivery and the free support duration in the quotation.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-4 sm:grid-cols-2 md:px-5">
                <div className="space-y-1.5">
                    <p className="text-xs font-medium">Estimated delivery</p>
                    <Input disabled={!canManage} value={duration} placeholder="e.g. 4–6 weeks" onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <p className="text-xs font-medium">Free support period</p>
                    <Input disabled={!canManage} value={support} placeholder="e.g. 6 Months" onChange={(e) => setSupport(e.target.value)} />
                </div>
                {canManage && (
                    <div className="flex justify-end sm:col-span-2">
                        <Button type="button" size="sm" disabled={!dirty} onClick={() => void act.run(() => act.patch('packages', pkg._id, { duration: duration.trim(), supportPeriod: support.trim() }), 'Saved')}>Save</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PkgStringList({ pkg, field, title, hint, canManage }: { pkg: CatalogPackage; field: 'supportInclusions' | 'additionalCharges' | 'notes'; title: string; hint: string; canManage: boolean }) {
    const act = useActions();
    const items = pkg[field] ?? [];
    const [edit, setEdit] = useState<{ i: number; text: string } | null>(null);
    const save = (next: string[]) => act.run(() => act.patch('packages', pkg._id, { [field]: next }));
    const dnd = useDragReorder((from, to) => void save(moveTo(items, from, to)));
    const saveEdit = async () => {
        if (!edit) return;
        if (edit.text.trim()) await save(items.map((t, i) => (i === edit.i ? edit.text.trim() : t)));
        setEdit(null);
    };
    const noun = title.toLowerCase();
    return (
        <Card className="gap-3 py-4 shadow-xs">
            <CardHeader className="px-4 md:px-5">
                <CardTitle className="text-sm">{title}</CardTitle>
                <CardDescription className="text-xs">{hint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-4 md:px-5">
                <div className="space-y-0.5">
                    {items.map((t, i) => (
                        <div key={`${i}-${t}`} {...dnd.row(i)} className={cn('flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50', dnd.rowClass(i))}>
                            {canManage && <DragGrip {...dnd.handle(i)} />}
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">{i + 1}</span>
                            {edit?.i === i ? (
                                <>
                                    <Input autoFocus className="h-8 min-w-0 flex-1" value={edit.text} onChange={(e) => setEdit({ i, text: e.target.value })} onKeyDown={(e) => (e.key === 'Enter' ? void saveEdit() : e.key === 'Escape' && setEdit(null))} />
                                    <IconBtn label="Save" onClick={() => void saveEdit()} className="text-primary"><IconCheck className="size-4" /></IconBtn>
                                    <IconBtn label="Cancel" onClick={() => setEdit(null)}><IconX className="size-4" /></IconBtn>
                                </>
                            ) : (
                                <>
                                    <span className="min-w-0 flex-1 break-words text-sm">{t}</span>
                                    {canManage && (
                                        <div className="flex shrink-0 items-center">
                                                                                        <IconBtn label="Edit" className="hover:text-primary" onClick={() => setEdit({ i, text: t })}><IconPencil className="size-4" /></IconBtn>
                                            <IconBtn label="Delete" className="text-destructive/80 hover:text-destructive" onClick={() => void save(items.filter((_, j) => j !== i))}><IconTrash className="size-4" /></IconBtn>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                    {items.length === 0 && <p className="py-1 text-sm text-muted-foreground">Nothing added yet.</p>}
                </div>
                {canManage && (
                    <div className="flex items-start gap-2 pt-1">
                        <div className="min-w-0 flex-1"><AddInline label={`Add ${noun}`} placeholder="Type a title and press Enter" onAdd={(t) => void save([...items, t])} /></div>
                        <BulkButton noun={noun} prompt={listPrompt(noun)} placeholder={'["First item", "Second item"]'} parse={parseLines} onImport={(list) => void save([...items, ...freshOnly(items, list)])} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/** Blueprint (inclusions, revisions, payment milestones, policies) with an explicit Save instead of saving per keystroke. */
function BlueprintTab({ entity, id, value, scope, canManage }: { entity: 'services' | 'packages'; id: string; value: Blueprint | null | undefined; scope: 'service' | 'package'; canManage: boolean }) {
    const act = useActions();
    const [v, setV] = useState<Blueprint | null>(value ?? null);
    const dirty = JSON.stringify(v ?? null) !== JSON.stringify(value ?? null);
    return (
        <Card className="gap-3 py-4 shadow-xs">
            <CardHeader className="px-4 md:px-5">
                <CardTitle className="text-sm">Quotation blueprint</CardTitle>
                <CardDescription className="text-xs">Domain / hosting inclusions, revisions, payment milestones and policies the wizard starts with.</CardDescription>
                {canManage && (
                    <CardAction>
                        <Button type="button" size="sm" disabled={!dirty} onClick={() => void act.run(() => act.patch(entity, id, { blueprint: v }), 'Blueprint saved')}>Save</Button>
                    </CardAction>
                )}
            </CardHeader>
            <CardContent className="px-4 md:px-5">
                <fieldset disabled={!canManage} className="min-w-0 border-0 p-0"><BlueprintEditor value={v} onChange={setV} scope={scope} /></fieldset>
            </CardContent>
        </Card>
    );
}

const SECTION_TABS: { value: string; label: string; kinds: CatalogSectionKind[] }[] = [
    { value: 'project', label: 'Project', kinds: ['projectTitle', 'projectOverview'] },
    { value: 'deliverables', label: 'Deliverables', kinds: ['deliverables'] },
    { value: 'timeline', label: 'Milestones & timeline', kinds: ['milestones'] },
    { value: 'responsibilities', label: 'Client responsibilities', kinds: ['clientResponsibilities'] },
    { value: 'exclusions', label: 'Exclusions', kinds: ['exclusions'] },
];

/** Every block of the selection on its own tab. A dot on a tab means it has content (own or inherited). */
function DetailTabs({ graph, service, pkg, canManage, packagesView }: { graph: CatalogGraph; service: CatalogService; pkg: CatalogPackage | null; canManage: boolean; packagesView?: React.ReactNode }) {
    const hasContent = (kinds: CatalogSectionKind[]) =>
        kinds.some((k) =>
            filled(
                graph.sections.find((s) => s.serviceId === service._id && s.kind === k && pkgKey(s) === (pkg?._id ?? '')) ??
                    (pkg ? graph.sections.find((s) => s.serviceId === service._id && s.kind === k && !s.packageId) : undefined),
            ),
        );
    const Dot = ({ on }: { on: boolean }) => (on ? <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary" /> : null);
    const count = (n: number) => <span className="ml-1.5 text-xs text-muted-foreground">{n}</span>;
    return (
        <Tabs defaultValue={pkg ? 'features' : 'packages'} key={pkg?._id ?? service._id}>
            <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="w-max">
                {pkg ? (
                    <>
                        <TabsTrigger value="features">Features{count(pkg.featureIds.length)}</TabsTrigger>
                        <TabsTrigger value="addons">Add-ons{count(pkg.addonIds.length)}</TabsTrigger>
                    </>
                ) : (
                    <TabsTrigger value="packages">Packages</TabsTrigger>
                )}
                {SECTION_TABS.map((t) => (
                    <TabsTrigger key={t.value} value={t.value}>{t.label}<Dot on={hasContent(t.kinds)} /></TabsTrigger>
                ))}
                {pkg && <TabsTrigger value="terms">Terms & support</TabsTrigger>}
                <TabsTrigger value="blueprint">Blueprint</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {pkg ? (
                <>
                    <TabsContent value="features" className="mt-3">
                        <Card className="py-4 shadow-xs"><CardContent className="px-4 md:px-5"><FeaturesTab graph={graph} pkg={pkg} kind="included" canManage={canManage} /></CardContent></Card>
                    </TabsContent>
                    <TabsContent value="addons" className="mt-3">
                        <Card className="py-4 shadow-xs"><CardContent className="px-4 md:px-5"><FeaturesTab graph={graph} pkg={pkg} kind="addon" canManage={canManage} /></CardContent></Card>
                    </TabsContent>
                </>
            ) : (
                <TabsContent value="packages" className="mt-3">{packagesView}</TabsContent>
            )}

            {SECTION_TABS.map((t) => (
                <TabsContent key={t.value} value={t.value} className="mt-3">
                    {!pkg && <p className="mb-3 text-xs text-muted-foreground">Service default: used by every package unless the package has its own version.</p>}
                    <div className={cn('grid gap-4', t.kinds.length > 1 && 'lg:grid-cols-2')}>
                        {t.kinds.map((k) => (
                            <SectionCard key={k} graph={graph} service={service} pkg={pkg} kind={k} canManage={canManage} />
                        ))}
                    </div>
                </TabsContent>
            ))}

            {pkg && (
                <TabsContent value="terms" className="mt-3">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="lg:col-span-2"><PackageFacts pkg={pkg} canManage={canManage} /></div>
                        <PkgStringList pkg={pkg} field="supportInclusions" title="Support inclusions" hint="What the free technical support covers." canManage={canManage} />
                        <PkgStringList pkg={pkg} field="additionalCharges" title="Support exclusions" hint="What is not covered or is charged extra." canManage={canManage} />
                        <div className="lg:col-span-2"><PkgStringList pkg={pkg} field="notes" title="General terms" hint="Shown as General Terms & Conditions in the quotation." canManage={canManage} /></div>
                    </div>
                </TabsContent>
            )}

            <TabsContent value="blueprint" className="mt-3">
                <BlueprintTab
                    key={pkg?._id ?? service._id}
                    entity={pkg ? 'packages' : 'services'}
                    id={pkg?._id ?? service._id}
                    value={(pkg ?? service).blueprint}
                    scope={pkg ? 'package' : 'service'}
                    canManage={canManage}
                />
            </TabsContent>
        </Tabs>
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
            <Card className="h-[60vh] gap-3 py-4 shadow-xs lg:sticky lg:top-4 lg:h-[calc(100vh-9rem)]">
                <CardHeader className="px-4">
                    <div className="relative">
                        <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Search services, packages…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </CardHeader>
                <ScrollArea className="min-h-0 flex-1 px-2"><div className="space-y-1 pr-2">
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
                </div></ScrollArea>
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

                {curSvc && (
                    <DetailTabs
                        graph={graph}
                        service={curSvc}
                        pkg={curPkg ?? null}
                        canManage={canManage}
                        packagesView={
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
                        }
                    />
                )}
            </div>

            {form && <EntityFormDialog entity={form.entity} id={form.id} initial={form.initial} onClose={() => setForm(null)} />}
        </div>
    );
}
