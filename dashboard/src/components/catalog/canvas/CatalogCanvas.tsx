'use client';

import '@xyflow/react/dist/style.css';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    applyNodeChanges,
    Background,
    Controls,
    MiniMap,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
    type Node,
    type NodeChange,
} from '@xyflow/react';
import { IconArrowBackUp, IconArrowForwardUp, IconFocusCentered, IconLayoutDistributeHorizontal, IconPlus, IconRefresh, IconFoldDown, IconFoldUp } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import {
    useCreateCatalogItemMutation,
    useDeleteCatalogItemMutation,
    useDuplicateCatalogItemMutation,
    useGetCatalogGraphQuery,
    useSaveCatalogLayoutMutation,
    useToggleCatalogItemMutation,
    useUpdateCatalogItemMutation,
} from '@/redux/features/catalog/catalogApi';
import type { CatalogPackage, CatalogSection, CatalogSectionItem, CatalogSectionKind, FormEntity } from '@/types/catalog.type';
import { EntityFormDialog, type Form } from '../EntityFormDialog';
import { ContextMenu } from './ContextMenu';
import { CanvasContext } from './context';
import { buildGraph } from './graph';
import { nodeTypes } from './nodes';
import { FeaturePicker, ViewSheet } from './panels';
import type { CanvasActions, CanvasNodeData, Clip, MenuItem, ServiceNodeData, ViewTarget } from './types';
import { useHistory } from './use-history';

const EXPANDED_KEY = 'catalog-canvas-expanded';
const newKey = () => crypto.randomUUID();
const errMsg = (e: unknown) => (e as { data?: { message?: string } })?.data?.message || 'Something went wrong';
const NO_POSITIONS: Record<string, { x: number; y: number }> = {};
const EMPTY = { nodes: [] as Node<CanvasNodeData>[], edges: [] };

type FormState = { entity: FormEntity; id: string | null; initial?: Form; onSaved?: (doc: { _id: string } & Form) => void };

export default function CatalogCanvas() {
    return (
        <ReactFlowProvider>
            <Board />
        </ReactFlowProvider>
    );
}

function Board() {
    const { can } = usePermissions();
    const canManage = can('catalog.manage');
    const rf = useReactFlow();
    const wrap = useRef<HTMLDivElement>(null);

    const { data: graph, isLoading } = useGetCatalogGraphQuery();
    const [createItem] = useCreateCatalogItemMutation();
    const [updateItem] = useUpdateCatalogItemMutation();
    const [deleteItem] = useDeleteCatalogItemMutation();
    const [toggleItem] = useToggleCatalogItemMutation();
    const [duplicate] = useDuplicateCatalogItemMutation();
    const [saveLayout] = useSaveCatalogLayoutMutation();
    const history = useHistory();

    // ── view state ──
    const [expanded, setExpanded] = useState<Set<string>>(() => {
        try {
            const raw = localStorage.getItem(EXPANDED_KEY);
            return new Set<string>(raw ? JSON.parse(raw) : []);
        } catch {
            return new Set<string>();
        }
    });
    const [posOverride, setPosOverride] = useState<Record<string, { x: number; y: number }> | null>(null);
    const positions = posOverride ?? graph?.positions ?? NO_POSITIONS;
    const [clip, setClip] = useState<Clip | null>(null);
    const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [viewing, setViewing] = useState<ViewTarget | null>(null);
    const [picker, setPicker] = useState<{ pkg: CatalogPackage; kind: 'included' | 'addon' } | null>(null);

    // First visit: open the first service so the board is not empty.
    const effectiveExpanded = useMemo(() => {
        if (expanded.size === 0 && graph?.services[0]) return new Set([`svc:${graph.services[0]._id}`]);
        return expanded;
    }, [expanded, graph]);

    const persistExpanded = (next: Set<string>) => {
        setExpanded(next);
        try { localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next])); } catch { /* storage unavailable */ }
    };

    // ── nodes: derived from data, mirrored into state so React Flow can apply drags / measurements ──
    const derived = useMemo(() => (graph ? buildGraph({ graph, expanded: effectiveExpanded, positions }) : EMPTY), [graph, effectiveExpanded, positions]);
    const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>([]);
    const [syncedFrom, setSyncedFrom] = useState<typeof derived | null>(null);
    if (syncedFrom !== derived) {
        setSyncedFrom(derived);
        setNodes((prev) => {
            const old = new Map(prev.map((n) => [n.id, n]));
            return derived.nodes.map((n) => {
                const p = old.get(n.id);
                return p ? { ...n, measured: p.measured, selected: p.selected } : n;
            });
        });
    }
    const onNodesChange = useCallback((changes: NodeChange<Node<CanvasNodeData>>[]) => setNodes((ns) => applyNodeChanges(changes, ns)), []);

    // ── helpers ──
    const run = async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
        try {
            const r = await fn();
            if (ok) toast.success(ok);
            return r;
        } catch (e) {
            toast.error(errMsg(e));
            return undefined;
        }
    };
    const patch = (entity: FormEntity | 'sections', id: string, body: Record<string, unknown>) => updateItem({ entity, id, body }).unwrap();
    const sectionById = (id: string) => graph?.sections.find((s) => s._id === id);

    const toggleExpand = (id: string) => {
        const next = new Set(effectiveExpanded);
        if (next.has(id)) next.delete(id); else next.add(id);
        persistExpanded(next);
    };

    /** Zoom to what is open (expanded services and their children) instead of the whole tall board. */
    const fitOpen = (delay = 0) =>
        setTimeout(() => {
            const open = rf.getNodes().filter((n) => n.type !== 'service' || (n.data as ServiceNodeData).expanded);
            rf.fitView({ nodes: open.length ? open.map((n) => ({ id: n.id })) : undefined, duration: 300, padding: 0.12, maxZoom: 1 });
        }, delay);

    const setAllExpanded = (open: boolean) => {
        if (!graph) return;
        persistExpanded(open ? new Set([...graph.services.map((s) => `svc:${s._id}`), ...graph.packages.map((p) => `pkg:${p._id}`)]) : new Set(['__none__']));
        fitOpen(120);
    };

    // ── positions (drag) with undo ──
    const savePositions = (next: Record<string, { x: number; y: number }>) => {
        setPosOverride(next);
        void saveLayout({ positions: next });
    };
    const onNodeDragStop = (_: unknown, __: Node, dragged: Node[]) => {
        const before: Record<string, { x: number; y: number }> = {};
        const after: Record<string, { x: number; y: number }> = {};
        for (const n of dragged) {
            const prev = derived.nodes.find((d) => d.id === n.id)?.position;
            if (!prev || (prev.x === n.position.x && prev.y === n.position.y)) continue;
            before[n.id] = prev;
            after[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
        }
        if (Object.keys(after).length === 0) return;
        const base = { ...positions };
        const next = { ...base, ...after };
        savePositions(next);
        history.record({
            label: 'Move node',
            undo: async () => savePositions({ ...base, ...Object.fromEntries(Object.keys(after).map((k) => [k, before[k]!])) }),
            redo: async () => savePositions(next),
        });
    };

    // ── actions ──
    const actions: CanvasActions = {
        canManage,
        toggleExpand,
        view: setViewing,
        openForm: (entity, id, initial, onSaved) => setForm({ entity, id, initial, onSaved }),
        clip,
        menu: (e, items) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ x: e.clientX, y: e.clientY, items: items.filter((i) => i.separator || i.label) });
        },
        copy: (c) => { setClip(c); toast.success(`Copied “${c.name}”`); },

        remove: async (entity, id, name) => {
            if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
            await run(() => deleteItem({ entity, id }).unwrap(), 'Deleted');
        },
        toggleActive: (entity, id) => void run(() => toggleItem({ entity, id }).unwrap()),

        linkPlatform: async (serviceId, platformId) => {
            const s = graph?.services.find((x) => x._id === serviceId);
            if (s) await run(() => patch('services', serviceId, { platformIds: [...new Set([...s.platformIds, platformId])] }), 'Platform added to service');
        },
        unlinkPlatform: async (serviceId, platformId) => {
            const s = graph?.services.find((x) => x._id === serviceId);
            if (!s || !confirm('Remove this platform from the service?')) return;
            await run(() => patch('services', serviceId, { platformIds: s.platformIds.filter((p) => p !== platformId) }), 'Platform removed');
        },

        duplicatePackage: async (id, target) => void (await run(() => duplicate({ entity: 'packages', id, body: target ?? {} }).unwrap(), 'Package duplicated')),
        pastePackage: async (serviceId, platformId) => {
            if (clip?.type === 'package') await run(() => duplicate({ entity: 'packages', id: clip.id, body: { serviceId, platformId } }).unwrap(), 'Package pasted');
        },
        pasteSection: async (serviceId, packageId) => {
            if (clip?.type !== 'section') return;
            if (packageId) persistExpanded(new Set([...effectiveExpanded, `pkg:${packageId}`]));
            await run(() => duplicate({ entity: 'sections', id: clip.id, body: { serviceId, packageId } }).unwrap(), 'Section pasted');
        },

        addSection: async (serviceId, packageId, kind: CatalogSectionKind) => {
            if (packageId) persistExpanded(new Set([...effectiveExpanded, `pkg:${packageId}`]));
            else persistExpanded(new Set([...effectiveExpanded, `svc:${serviceId}`]));
            await run(() => createItem({ entity: 'sections', body: { serviceId, packageId, kind, items: [], text: '' } }).unwrap());
        },

        saveItems: async (section: CatalogSection, items: CatalogSectionItem[], label) => {
            const prev = section.items;
            const ok = await run(() => patch('sections', section._id, { items }));
            if (ok) history.record({ label, undo: () => patch('sections', section._id, { items: prev }), redo: () => patch('sections', section._id, { items }) });
        },
        saveText: async (section, text) => {
            const prev = section.text ?? '';
            const ok = await run(() => patch('sections', section._id, { text }));
            if (ok) history.record({ label: 'Edit text', undo: () => patch('sections', section._id, { text: prev }), redo: () => patch('sections', section._id, { text }) });
        },
        moveItem: async (fromId, key, to, index) => {
            const from = sectionById(fromId);
            const item = from?.items.find((i) => i.key === key);
            if (!from || !item || from._id === to._id) return;
            const fromNext = from.items.filter((i) => i.key !== key);
            const toNext = [...to.items.slice(0, index), item, ...to.items.slice(index)];
            const apply = (f: CatalogSectionItem[], t: CatalogSectionItem[]) => Promise.all([patch('sections', from._id, { items: f }), patch('sections', to._id, { items: t })]);
            const ok = await run(() => apply(fromNext, toNext));
            if (ok) history.record({ label: `Move "${item.title}"`, undo: () => apply(from.items, to.items), redo: () => apply(fromNext, toNext) });
        },
        pasteItem: async (section) => {
            if (clip?.type !== 'item') return;
            await actions.saveItems(section, [...section.items, { ...clip.item, key: newKey() }], `Paste "${clip.name}"`);
        },

        pickFeatures: (pkg, kind) => setPicker({ pkg, kind }),
        linkFeatures: async (pkg, kind, ids) => {
            const field = kind === 'included' ? 'featureIds' : 'addonIds';
            const cur = pkg[field];
            await run(() => patch('packages', pkg._id, { [field]: [...new Set([...cur, ...ids])] }));
        },
        setFeatureOrder: async (pkg, kind, ids) => {
            const field = kind === 'included' ? 'featureIds' : 'addonIds';
            const prev = pkg[field];
            const ok = await run(() => patch('packages', pkg._id, { [field]: ids }));
            if (ok) history.record({ label: 'Edit features', undo: () => patch('packages', pkg._id, { [field]: prev }), redo: () => patch('packages', pkg._id, { [field]: ids }) });
        },
        moveFeature: async (from, featureId, to, kind, index) => {
            const field = kind === 'included' ? 'featureIds' : 'addonIds';
            const source = graph?.packages.find((p) => p._id === from.pkgId);
            if (!source) return;
            if (source._id === to._id) {
                const ids = source[field].filter((i) => i !== featureId);
                ids.splice(index > source[field].indexOf(featureId) ? index - 1 : index, 0, featureId);
                return actions.setFeatureOrder(to, kind, ids);
            }
            const srcNext = source[field].filter((i) => i !== featureId);
            const dstNext = [...to[field].filter((i) => i !== featureId)];
            dstNext.splice(index, 0, featureId);
            const apply = (s: string[], d: string[]) => Promise.all([patch('packages', source._id, { [field]: s }), patch('packages', to._id, { [field]: d })]);
            const ok = await run(() => apply(srcNext, dstNext));
            if (ok) history.record({ label: 'Move feature', undo: () => apply(source[field], to[field]), redo: () => apply(srcNext, dstNext) });
        },
    };

    // ── toolbar / pane menu / keyboard ──
    const doUndo = async () => { const c = await history.undo(); if (c) toast(`Undid: ${c.label}`); };
    const doRedo = async () => { const c = await history.redo(); if (c) toast(`Redid: ${c.label}`); };
    const resetLayout = () => { savePositions({}); fitOpen(150); };

    const onKeyDown = (e: React.KeyboardEvent) => {
        const el = e.target as HTMLElement;
        if (el.closest('input, textarea, select, [contenteditable=true]')) return; // let text fields keep their own undo
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); void (e.shiftKey ? doRedo() : doUndo()); }
        if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); void doRedo(); }
    };

    if (isLoading || !graph) return <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading catalog…</div>;

    const pickerOptions = picker
        ? graph.features.filter(
              (f) =>
                  f.serviceId === picker.pkg.serviceId &&
                  f.kind === picker.kind &&
                  (!f.platformId || f.platformId === (picker.pkg.platformId ?? null)) &&
                  !(picker.kind === 'included' ? picker.pkg.featureIds : picker.pkg.addonIds).includes(f._id),
          )
        : [];

    return (
        <CanvasContext.Provider value={actions}>
            <div ref={wrap} tabIndex={0} onKeyDown={onKeyDown} className="h-[calc(100vh-15rem)] min-h-[560px] overflow-hidden rounded-xl border bg-muted/20 outline-none">
                <ReactFlow
                    nodes={nodes}
                    edges={derived.edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onNodeDragStop={onNodeDragStop}
                    onPaneContextMenu={(e) =>
                        actions.menu(e as unknown as React.MouseEvent, [
                            ...(canManage ? [{ label: 'Add service', onClick: () => setForm({ entity: 'services', id: null }) }, { label: 'New platform', onClick: () => setForm({ entity: 'platforms', id: null }) }, { separator: true }] : []),
                            { label: 'Undo', disabled: !history.canUndo, onClick: () => void doUndo() },
                            { label: 'Redo', disabled: !history.canRedo, onClick: () => void doRedo() },
                            { separator: true },
                            { label: 'Fit to open items', onClick: () => fitOpen() },
                            { label: 'Expand all', onClick: () => setAllExpanded(true) },
                            { label: 'Collapse all', onClick: () => setAllExpanded(false) },
                            { label: 'Reset layout', onClick: resetLayout },
                        ])
                    }
                    onPaneClick={() => setMenu(null)}
                    onInit={() => fitOpen(60)}
                    minZoom={0.1}
                    maxZoom={1.5}
                    nodesConnectable={false}
                    deleteKeyCode={null}
                    zoomOnDoubleClick={false}
                    proOptions={{ hideAttribution: true }}
                    colorMode="system"
                >
                    <Background gap={22} />
                    <Controls showInteractive={false} />
                    <MiniMap pannable zoomable className="!hidden md:!block" />
                    <Panel position="top-left" className="flex flex-wrap items-center gap-1.5">
                        {canManage && (
                            <Button size="sm" onClick={() => setForm({ entity: 'services', id: null })}><IconPlus className="size-4" /> Service</Button>
                        )}
                        <Button size="sm" variant="outline" disabled={!history.canUndo} onClick={() => void doUndo()} title={history.nextUndo ? `Undo: ${history.nextUndo}` : 'Undo (Ctrl+Z)'}><IconArrowBackUp className="size-4" /></Button>
                        <Button size="sm" variant="outline" disabled={!history.canRedo} onClick={() => void doRedo()} title={history.nextRedo ? `Redo: ${history.nextRedo}` : 'Redo (Ctrl+Shift+Z)'}><IconArrowForwardUp className="size-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => fitOpen()} title="Fit to open items"><IconFocusCentered className="size-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setAllExpanded(true)} title="Expand all"><IconFoldDown className="size-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setAllExpanded(false)} title="Collapse all"><IconFoldUp className="size-4" /></Button>
                        <Button size="sm" variant="outline" onClick={resetLayout} title="Reset layout"><IconLayoutDistributeHorizontal className="size-4" /></Button>
                    </Panel>
                    <Panel position="bottom-center" className="rounded-md bg-background/80 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
                        Right-click anything for actions · drag items by the ⋮⋮ handle (also between cards) · double-click an item to edit · Ctrl+Z / Ctrl+Shift+Z
                        {clip && <span className="ml-2 inline-flex items-center gap-1 text-primary"><IconRefresh className="size-3" /> clipboard: {clip.name}</span>}
                    </Panel>
                </ReactFlow>
            </div>

            {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}

            {form && (
                <EntityFormDialog
                    key={`${form.entity}:${form.id ?? 'new'}`}
                    entity={form.entity}
                    id={form.id}
                    initial={form.initial}
                    onSaved={form.onSaved}
                    onClose={() => setForm(null)}
                />
            )}

            {picker && (
                <FeaturePicker
                    title={picker.kind === 'included' ? `Link features to “${picker.pkg.name}”` : `Link add-ons to “${picker.pkg.name}”`}
                    options={pickerOptions}
                    onConfirm={(ids) => void actions.linkFeatures(picker.pkg, picker.kind, ids)}
                    onClose={() => setPicker(null)}
                />
            )}

            <ViewSheet target={viewing} graph={graph} onClose={() => setViewing(null)} />
        </CanvasContext.Provider>
    );
}
