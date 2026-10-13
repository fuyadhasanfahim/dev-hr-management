'use client';

import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
    IconChevronDown,
    IconChevronRight,
    IconCode,
    IconCopy,
    IconDotsVertical,
    IconEye,
    IconPencil,
    IconPlus,
    IconStarFilled,
} from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import { CatalogIcon } from '@/lib/catalog-icons';
import { BrandLogo } from '../BrandLogo';
import { ItemList, type ListItem } from './ItemList';
import { SECTION_META, SECTION_ORDER } from './section-meta';
import { useCanvas } from './context';
import type {
    FeaturesNodeData,
    MenuItem,
    PackageNodeData,
    PlatformNodeData,
    SectionNodeData,
    ServiceNodeData,
} from './types';
import type { CatalogSectionKind } from '@/types/catalog.type';

const money = (n: number) => `৳${Math.round(n).toLocaleString('en-US')}`;

function priceText(p: PackageNodeData['pkg']) {
    if (p.price == null) return 'Custom quote';
    const range = p.priceMax ? `${money(p.price)} – ${Math.round(p.priceMax).toLocaleString('en-US')}` : money(p.price);
    return p.billingCycle === 'one-time' ? range : `${range} / ${p.unitLabel || p.billingCycle.replace('per-', '')}`;
}

/** Card chrome shared by every node type: handles, selection ring, header row. */
function Shell({
    selected, width, tone, icon, title, subtitle, inactive, actions, children, onContextMenu, className,
}: {
    selected?: boolean;
    width: number;
    tone: string;
    icon: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    inactive?: boolean;
    actions?: React.ReactNode;
    children?: React.ReactNode;
    onContextMenu?: (e: React.MouseEvent) => void;
    className?: string;
}) {
    return (
        <div
            style={{ width }}
            onContextMenu={onContextMenu}
            className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', selected && 'ring-2 ring-primary', inactive && 'opacity-60', className)}
        >
            <Handle type="target" position={Position.Left} className="!size-2 !border-primary !bg-background" />
            <div className={cn('flex items-start gap-2.5 rounded-t-xl border-b px-3 py-2.5', tone)}>
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/80 text-primary">{icon}</span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{title}</p>
                    {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
                </div>
                <div className="nodrag flex shrink-0 items-center gap-0.5">{actions}</div>
            </div>
            {children && <div className="space-y-2 p-3">{children}</div>}
            <Handle type="source" position={Position.Right} className="!size-2 !border-primary !bg-background" />
        </div>
    );
}

const IconBtn = ({ label, onClick, children }: { label: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) => (
    <button type="button" aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className="nodrag flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">{children}</button>
);

const Chip = ({ children, tone }: { children: React.ReactNode; tone?: 'primary' | 'warn' }) => (
    <span className={cn('rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground', tone === 'primary' && 'bg-primary/10 text-primary', tone === 'warn' && 'bg-amber-500/10 text-amber-600')}>{children}</span>
);

const Chevron = ({ open, onClick }: { open: boolean; onClick: () => void }) => (
    <IconBtn label={open ? 'Collapse' : 'Expand'} onClick={onClick}>{open ? <IconChevronDown className="size-4" /> : <IconChevronRight className="size-4" />}</IconBtn>
);

/** "Add section …" entries for kinds the scope does not have yet. */
function sectionMenu(existing: Set<CatalogSectionKind>, add: (k: CatalogSectionKind) => void, prefix: string): MenuItem[] {
    return SECTION_ORDER.filter((k) => !existing.has(k)).map((k) => ({ label: `${prefix}${SECTION_META[k].label}`, onClick: () => add(k) }));
}

// ───────────────────────────── service ─────────────────────────────

export function ServiceNode({ data, selected }: NodeProps & { data: ServiceNodeData }) {
    const a = useCanvas();
    const { service: s } = data;
    const id = `svc:${s._id}`;

    const menu = (): MenuItem[] => [
        { label: 'View', onClick: () => a.view({ type: 'service', id: s._id }) },
        ...(a.canManage
            ? [
                  { label: 'Edit service', onClick: () => a.openForm('services', s._id, s as never) },
                  { label: 'Add package', onClick: () => a.openForm('packages', null, { serviceId: s._id }) },
                  { label: 'Add platform (new)', onClick: () => a.openForm('platforms', null, {}, (doc) => void a.linkPlatform(s._id, doc._id)) },
                  { separator: true },
                  ...sectionMenu(new Set<CatalogSectionKind>(data.sectionKinds), (k) => void a.addSection(s._id, null, k), 'Add default · '),
                  { separator: true },
                  ...(a.clip?.type === 'package' ? [{ label: `Paste package “${a.clip.name}”`, onClick: () => void a.pastePackage(s._id, null) }] : []),
                  ...(a.clip?.type === 'section' ? [{ label: `Paste section “${a.clip.name}” (default)`, onClick: () => void a.pasteSection(s._id, null) }] : []),
                  { separator: true },
                  { label: s.isActive ? 'Deactivate' : 'Activate', onClick: () => a.toggleActive('services', s._id) },
                  { label: 'Delete service', danger: true, onClick: () => void a.remove('services', s._id, s.name) },
              ]
            : []),
    ];

    return (
        <Shell selected={selected} width={290} tone="bg-primary/5" inactive={!s.isActive} icon={<CatalogIcon name={s.icon} className="size-5" />}
            title={s.name} subtitle={s.description}
            onContextMenu={(e) => a.menu(e, menu())}
            actions={<>
                <IconBtn label="View" onClick={() => a.view({ type: 'service', id: s._id })}><IconEye className="size-4" /></IconBtn>
                {a.canManage && <IconBtn label="Edit" onClick={() => a.openForm('services', s._id, s as never)}><IconPencil className="size-4" /></IconBtn>}
                <IconBtn label="More" onClick={(e) => a.menu(e, menu())}><IconDotsVertical className="size-4" /></IconBtn>
                <Chevron open={data.expanded} onClick={() => a.toggleExpand(id)} />
            </>}>
            <div className="flex flex-wrap gap-1.5">
                <Chip tone="primary">{s.quotationCategory}</Chip>
                <Chip>{s.pricingMode === 'unit' ? 'per unit' : 'packages'}</Chip>
                <Chip>{data.platformCount} platform{data.platformCount === 1 ? '' : 's'}</Chip>
                <Chip>{data.packageCount} package{data.packageCount === 1 ? '' : 's'}</Chip>
                {!s.isActive && <Chip tone="warn">inactive</Chip>}
            </div>
        </Shell>
    );
}

// ───────────────────────────── platform (per service) ─────────────────────────────

export function PlatformNode({ data, selected }: NodeProps & { data: PlatformNodeData }) {
    const a = useCanvas();
    const { platform: p, service: s } = data;
    const menu = (): MenuItem[] => [
        { label: 'View', onClick: () => a.view({ type: 'platform', id: p._id, serviceId: s._id }) },
        ...(a.canManage
            ? [
                  { label: 'Edit platform', onClick: () => a.openForm('platforms', p._id, p as never) },
                  { label: 'Add package', onClick: () => a.openForm('packages', null, { serviceId: s._id, platformId: p._id }) },
                  ...(a.clip?.type === 'package' ? [{ label: `Paste package “${a.clip.name}”`, onClick: () => void a.pastePackage(s._id, p._id) }] : []),
                  { separator: true },
                  { label: 'Remove from this service', danger: true, onClick: () => void a.unlinkPlatform(s._id, p._id) },
              ]
            : []),
    ];
    return (
        <Shell selected={selected} width={250} tone="bg-sky-500/5" inactive={!p.isActive}
            icon={p.logo ? <BrandLogo name={p.logo} color={p.color} className="size-5" /> : <IconCode className="size-5" />}
            title={p.name} subtitle={p.description} onContextMenu={(e) => a.menu(e, menu())}
            actions={<>
                <IconBtn label="View" onClick={() => a.view({ type: 'platform', id: p._id, serviceId: s._id })}><IconEye className="size-4" /></IconBtn>
                {a.canManage && <IconBtn label="Add package" onClick={() => a.openForm('packages', null, { serviceId: s._id, platformId: p._id })}><IconPlus className="size-4" /></IconBtn>}
                <IconBtn label="More" onClick={(e) => a.menu(e, menu())}><IconDotsVertical className="size-4" /></IconBtn>
            </>}>
            <div className="flex gap-1.5"><Chip>{data.packageCount} package{data.packageCount === 1 ? '' : 's'}</Chip></div>
        </Shell>
    );
}

// ───────────────────────────── package ─────────────────────────────

export function PackageNode({ data, selected }: NodeProps & { data: PackageNodeData }) {
    const a = useCanvas();
    const { pkg, service: s } = data;
    const id = `pkg:${pkg._id}`;
    const have = new Set<CatalogSectionKind>(data.sectionKinds);

    const menu = (): MenuItem[] => [
        { label: 'View', onClick: () => a.view({ type: 'package', id: pkg._id }) },
        ...(a.canManage
            ? [
                  { label: 'Edit package', onClick: () => a.openForm('packages', pkg._id, pkg as never) },
                  { label: 'New feature', onClick: () => a.openForm('features', null, { serviceId: s._id, platformId: pkg.platformId ?? '', kind: 'included' }, (d) => void a.linkFeatures(pkg, 'included', [d._id])) },
                  { label: 'Link existing features…', onClick: () => a.pickFeatures(pkg, 'included') },
                  { label: 'New add-on', onClick: () => a.openForm('features', null, { serviceId: s._id, platformId: pkg.platformId ?? '', kind: 'addon' }, (d) => void a.linkFeatures(pkg, 'addon', [d._id])) },
                  { separator: true },
                  ...sectionMenu(have, (k) => void a.addSection(s._id, pkg._id, k), 'Add section · '),
                  { separator: true },
                  { label: 'Copy', onClick: () => a.copy({ type: 'package', id: pkg._id, name: pkg.name }) },
                  { label: 'Duplicate', onClick: () => void a.duplicatePackage(pkg._id) },
                  ...(a.clip?.type === 'section' ? [{ label: `Paste section “${a.clip.name}” here`, onClick: () => void a.pasteSection(s._id, pkg._id) }] : []),
                  { separator: true },
                  { label: pkg.isActive ? 'Deactivate' : 'Activate', onClick: () => a.toggleActive('packages', pkg._id) },
                  { label: 'Delete package', danger: true, onClick: () => void a.remove('packages', pkg._id, pkg.name) },
              ]
            : []),
    ];

    return (
        <Shell selected={selected} width={310} tone="bg-emerald-500/5" inactive={!pkg.isActive}
            icon={<span className="text-xs font-bold">৳</span>}
            title={<span className="flex items-center gap-1.5">{pkg.name}{pkg.badge && <span className="flex items-center gap-0.5 rounded bg-primary px-1 text-[9px] font-semibold text-primary-foreground"><IconStarFilled className="size-2" />{pkg.badge}</span>}</span>}
            subtitle={pkg.description} onContextMenu={(e) => a.menu(e, menu())}
            actions={<>
                <IconBtn label="View" onClick={() => a.view({ type: 'package', id: pkg._id })}><IconEye className="size-4" /></IconBtn>
                {a.canManage && <IconBtn label="Edit" onClick={() => a.openForm('packages', pkg._id, pkg as never)}><IconPencil className="size-4" /></IconBtn>}
                <IconBtn label="More" onClick={(e) => a.menu(e, menu())}><IconDotsVertical className="size-4" /></IconBtn>
                <Chevron open={data.expanded} onClick={() => a.toggleExpand(id)} />
            </>}>
            <p className="text-lg font-bold leading-none">{priceText(pkg)}</p>
            <div className="flex flex-wrap gap-1.5">
                <Chip tone="primary">{pkg.billingCycle}</Chip>
                <Chip>{data.featureCount} features</Chip>
                {data.addonCount > 0 && <Chip>{data.addonCount} add-ons</Chip>}
                {data.platform && <Chip>{data.platform.name}</Chip>}
                {!pkg.isActive && <Chip tone="warn">inactive</Chip>}
            </div>
        </Shell>
    );
}

// ───────────────────────────── features / add-ons list ─────────────────────────────

export function FeaturesNode({ data, selected }: NodeProps & { data: FeaturesNodeData }) {
    const a = useCanvas();
    const { pkg, service: s, listKind, items } = data;
    const addon = listKind === 'addon';
    const ids = (addon ? pkg.addonIds : pkg.featureIds) as string[];
    const list: ListItem[] = items.map((f) => ({ key: f._id, title: f.name, badge: addon ? money(f.price) : f.group }));

    const addNew = () => a.openForm('features', null, { serviceId: s._id, platformId: pkg.platformId ?? '', kind: listKind }, (d) => void a.linkFeatures(pkg, listKind, [d._id]));
    const addMenu = (e: React.MouseEvent) => a.menu(e, [
        { label: addon ? 'New add-on' : 'New feature', onClick: addNew },
        { label: 'Link existing…', onClick: () => a.pickFeatures(pkg, listKind) },
    ]);

    return (
        <Shell selected={selected} width={340} tone="bg-violet-500/5" icon={<IconPlus className="size-4" />}
            title={addon ? 'Optional add-ons' : 'Included features'} subtitle={`${items.length} · ${pkg.name}`}
            onContextMenu={(e) => a.menu(e, [{ label: addon ? 'New add-on' : 'New feature', onClick: addNew }, { label: 'Link existing…', onClick: () => a.pickFeatures(pkg, listKind) }])}
            actions={a.canManage ? <IconBtn label="Add" onClick={addMenu}><IconPlus className="size-4" /></IconBtn> : null}>
            <ItemList
                listId={`feat:${pkg._id}:${listKind}`}
                mime="application/x-catalog-feature"
                items={list}
                readOnly={!a.canManage}
                inlineEdit={false}
                placeholder={addon ? 'New add-on…' : 'New feature…'}
                payloadExtra={{ pkgId: pkg._id, listKind, serviceId: s._id }}
                emptyText={addon ? 'No add-ons — add one or drag here' : 'No features yet'}
                onAddClick={addNew}
                onReorder={(keys) => void a.setFeatureOrder(pkg, listKind, keys)}
                onRemove={(key) => void a.setFeatureOrder(pkg, listKind, ids.filter((i) => i !== key))}
                onEditItem={(key) => { const f = items.find((x) => x._id === key); if (f) a.openForm('features', f._id, f as never); }}
                onDropExternal={(p, index) => {
                    if (p.serviceId !== s._id || p.listKind !== listKind) return;
                    void a.moveFeature({ pkgId: String(p.pkgId), listKind: p.listKind as 'included' | 'addon' }, p.key, pkg, listKind, index);
                }}
                onItemMenu={(e, it) => a.menu(e, [
                    { label: 'Edit', onClick: () => { const f = items.find((x) => x._id === it.key); if (f) a.openForm('features', f._id, f as never); } },
                    { label: 'Remove from package', onClick: () => void a.setFeatureOrder(pkg, listKind, ids.filter((i) => i !== it.key)) },
                    { label: 'Delete feature everywhere', danger: true, onClick: () => void a.remove('features', it.key, it.title) },
                ])}
            />
        </Shell>
    );
}

// ───────────────────────────── section (list or text) ─────────────────────────────

export function SectionNode({ data, selected }: NodeProps & { data: SectionNodeData }) {
    const a = useCanvas();
    const { section, service: s, pkg, overrides } = data;
    const meta = SECTION_META[section.kind];
    const Icon = meta.icon;
    const [draft, setDraft] = useState<string | null>(null);
    const scopeName = pkg ? pkg.name : `${s.name} (default)`;

    const menu = (): MenuItem[] => [
        { label: 'Copy section', onClick: () => a.copy({ type: 'section', id: section._id, name: meta.label }) },
        ...(a.canManage
            ? [
                  ...(a.clip?.type === 'item' && meta.type === 'list' ? [{ label: `Paste item “${a.clip.name}”`, onClick: () => void a.pasteItem(section) }] : []),
                  { separator: true },
                  { label: section.isActive ? 'Deactivate' : 'Activate', onClick: () => a.toggleActive('sections', section._id) },
                  { label: 'Delete section', danger: true, onClick: () => void a.remove('sections', section._id, meta.label) },
              ]
            : []),
    ];

    return (
        <Shell selected={selected} width={340} tone="bg-amber-500/5" inactive={!section.isActive} icon={<Icon className="size-4" />}
            title={meta.label} subtitle={<>{scopeName}{overrides && ' · overrides default'}</>}
            onContextMenu={(e) => a.menu(e, menu())}
            actions={<IconBtn label="More" onClick={(e) => a.menu(e, menu())}><IconDotsVertical className="size-4" /></IconBtn>}>
            {meta.type === 'text' ? (
                <textarea
                    key={section.text}
                    className="nodrag nowheel nopan min-h-24 w-full resize-y rounded-md border bg-background p-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    defaultValue={section.text}
                    placeholder={meta.placeholder}
                    readOnly={!a.canManage}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => { if (draft !== null && draft !== (section.text ?? '')) void a.saveText(section, draft); setDraft(null); }}
                />
            ) : (
                <ItemList
                    listId={`sec:${section._id}`}
                    mime="application/x-catalog-section-item"
                    items={section.items}
                    readOnly={!a.canManage}
                    withDuration={meta.withDuration}
                    placeholder={meta.placeholder}
                    onChange={(items, label) => void a.saveItems(section, items, label)}
                    onDropExternal={(p, index) => void a.moveItem(String(p.listId).replace('sec:', ''), p.key, section, index)}
                    onItemMenu={(e, it) => a.menu(e, [
                        { label: 'Copy item', onClick: () => a.copy({ type: 'item', item: it as never, name: it.title }) },
                        ...(a.canManage ? [{ label: 'Delete item', danger: true, onClick: () => void a.saveItems(section, section.items.filter((x) => x.key !== it.key), `Delete "${it.title}"`) }] : []),
                    ])}
                />
            )}
            {a.canManage && a.clip?.type === 'item' && meta.type === 'list' && (
                <button type="button" className="nodrag flex w-full items-center justify-center gap-1 rounded border border-dashed py-1 text-[11px] text-primary hover:bg-primary/5" onClick={() => void a.pasteItem(section)}>
                    <IconCopy className="size-3.5" /> Paste “{a.clip.name}”
                </button>
            )}
        </Shell>
    );
}

export const nodeTypes = { service: ServiceNode, platform: PlatformNode, package: PackageNode, features: FeaturesNode, section: SectionNode };
