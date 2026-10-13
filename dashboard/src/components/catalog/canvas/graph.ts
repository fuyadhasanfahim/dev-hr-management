import type { Edge, Node } from '@xyflow/react';
import type { CatalogGraph, CatalogSection } from '@/types/catalog.type';
import { SECTION_META, SECTION_ORDER } from './section-meta';
import type { CanvasNodeData } from './types';

interface T {
    id: string;
    type: string;
    data: CanvasNodeData;
    w: number;
    h: number;
    dashed?: boolean;
    children: T[];
}

const GAP_X = 90;
const GAP_Y = 28;

const MAX_ROWS = 8;
const rows = (n: number) => Math.min(n, MAX_ROWS);

/** Rough heights — only used to space the tree; React Flow measures the real size. */
const heightOf = {
    service: 150,
    platform: 112,
    package: 168,
    features: (n: number) => 120 + rows(n) * 30,
    section: (s: CatalogSection) => (SECTION_META[s.kind].type === 'text' ? 190 : 130 + rows(s.items.length) * 34),
};

interface Options {
    graph: CatalogGraph;
    expanded: Set<string>;
    positions: Record<string, { x: number; y: number }>;
}

/**
 * Service → (platform) → package → (features / add-ons / sections), laid out as a
 * left-to-right tree. Collapsed branches are not rendered, so the canvas stays light.
 * Saved positions (manual drags) win over the computed layout.
 */
export function buildGraph({ graph, expanded, positions }: Options): { nodes: Node<CanvasNodeData>[]; edges: Edge[] } {
    const { services, platforms, packages, features, sections } = graph;
    const platformById = new Map(platforms.map((p) => [p._id, p]));
    const featureById = new Map(features.map((f) => [f._id, f]));

    const sectionsOf = (serviceId: string, packageId: string | null) =>
        sections
            .filter((s) => s.serviceId === serviceId && (s.packageId ?? null) === packageId)
            .sort((a, b) => SECTION_ORDER.indexOf(a.kind) - SECTION_ORDER.indexOf(b.kind));

    const roots: T[] = services.map((service) => {
        const svcPackages = packages.filter((p) => p.serviceId === service._id);
        const open = expanded.has(`svc:${service._id}`);
        const root: T = {
            id: `svc:${service._id}`,
            type: 'service',
            w: 290,
            h: heightOf.service,
            children: [],
            data: { kind: 'service', service, platformCount: service.platformIds.length, packageCount: svcPackages.length, expanded: open, sectionKinds: sectionsOf(service._id, null).map((s) => s.kind) },
        };
        if (!open) return root;

        const packageNode = (pkg: (typeof packages)[number]): T => {
            const pOpen = expanded.has(`pkg:${pkg._id}`);
            const platform = pkg.platformId ? platformById.get(pkg.platformId) : undefined;
            const node: T = {
                id: `pkg:${pkg._id}`,
                type: 'package',
                w: 310,
                h: heightOf.package,
                children: [],
                data: { kind: 'package', pkg, service, platform, expanded: pOpen, featureCount: pkg.featureIds.length, addonCount: pkg.addonIds.length, sectionKinds: sectionsOf(service._id, pkg._id).map((s) => s.kind) },
            };
            if (pOpen) {
                const own = sectionsOf(service._id, pkg._id);
                const inherited = new Set(sectionsOf(service._id, null).map((s) => s.kind));
                for (const listKind of ['included', 'addon'] as const) {
                    const ids = listKind === 'included' ? pkg.featureIds : pkg.addonIds;
                    const items = ids.map((id) => featureById.get(id)).filter((f): f is NonNullable<typeof f> => !!f);
                    node.children.push({
                        id: `feat:${pkg._id}:${listKind}`,
                        type: 'features',
                        w: 340,
                        h: heightOf.features(items.length),
                        dashed: true,
                        children: [],
                        data: { kind: 'features', listKind, pkg, service, items },
                    });
                }
                for (const section of own) {
                    node.children.push({
                        id: `sec:${section._id}`,
                        type: 'section',
                        w: 340,
                        h: heightOf.section(section),
                        dashed: true,
                        children: [],
                        data: { kind: 'section', section, service, pkg, overrides: inherited.has(section.kind) },
                    });
                }
            }
            return node;
        };

        // Platforms the service offers, each with its packages; platform-less packages hang off the service.
        for (const pid of service.platformIds) {
            const platform = platformById.get(pid);
            if (!platform) continue;
            const mine = svcPackages.filter((p) => p.platformId === pid);
            root.children.push({
                id: `plat:${service._id}:${pid}`,
                type: 'platform',
                w: 250,
                h: heightOf.platform,
                children: mine.map(packageNode),
                data: { kind: 'platform', platform, service, packageCount: mine.length },
            });
        }
        for (const pkg of svcPackages.filter((p) => !p.platformId)) root.children.push(packageNode(pkg));

        for (const section of sectionsOf(service._id, null)) {
            root.children.push({
                id: `sec:${section._id}`,
                type: 'section',
                w: 340,
                h: heightOf.section(section),
                dashed: true,
                children: [],
                data: { kind: 'section', section, service, overrides: false },
            });
        }
        return root;
    });

    const nodes: Node<CanvasNodeData>[] = [];
    const edges: Edge[] = [];

    /** Places a subtree, returns the vertical space it uses. */
    const place = (t: T, x: number, y: number, parent?: T): number => {
        let cy = y;
        const childX = x + t.w + GAP_X;
        for (const c of t.children) cy += place(c, childX, cy, t) + GAP_Y;
        const childrenH = t.children.length ? cy - y - GAP_Y : 0;
        const block = Math.max(t.h, childrenH);
        const auto = { x, y: y + (block - t.h) / 2 };
        nodes.push({ id: t.id, type: t.type, position: positions[t.id] ?? auto, data: t.data });
        if (parent) {
            edges.push({
                id: `e:${parent.id}>${t.id}`,
                source: parent.id,
                target: t.id,
                type: 'smoothstep',
                style: t.dashed ? { strokeDasharray: '6 4', opacity: 0.7 } : undefined,
            });
        }
        return block;
    };

    let y = 0;
    for (const r of roots) y += place(r, 0, y) + GAP_Y * 2;
    return { nodes, edges };
}
