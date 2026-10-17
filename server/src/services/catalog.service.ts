import { Types, type Model } from 'mongoose';
import CatalogService from '../models/catalog-service.model.js';
import CatalogPlatform from '../models/catalog-platform.model.js';
import CatalogPackage from '../models/catalog-package.model.js';
import CatalogFeature from '../models/catalog-feature.model.js';
import CatalogSection, { CATALOG_SECTION_KINDS, CATALOG_TEXT_KINDS, DURATION_UNITS } from '../models/catalog-section.model.js';
import CatalogLayout from '../models/catalog-layout.model.js';
import { CATALOG_FLOW_TYPES } from '../models/catalog-service.model.js';
import { sanitizeBlueprint } from './catalog-blueprint.js';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/AppError.js';

/**
 * Quotation catalog — Service → Platform → Package → Feature.
 * Every link is an ObjectId reference (never a name), so renaming an item
 * cannot break a package or an old quotation. One generic CRUD per entity,
 * plus the reference-integrity rules that tie the four collections together.
 */

export type CatalogEntity = 'services' | 'platforms' | 'packages' | 'features' | 'sections';

type Doc = Record<string, any>;
interface EntityDef {
    model: Model<any>;
    /** Fields a client may write. Everything else is ignored. */
    fields: string[];
    required: string[];
    /** Cross-reference checks + derived fields (slug). Runs before every create/update. */
    prepare: (data: Doc, current?: Doc) => Promise<void>;
    /** Throws if other records still point at this one. */
    guardDelete: (id: string) => Promise<void>;
    /** Runs after a successful delete (remove content that only made sense under it). */
    cleanup?: (id: string) => Promise<void>;
}

const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const asId = (v: unknown, label: string): Types.ObjectId => {
    if (!Types.ObjectId.isValid(String(v))) throw new AppError(`Invalid ${label} id`, 400);
    return new Types.ObjectId(String(v));
};
const uniq = (ids: unknown[]) => [...new Set(ids.map(String))];

const requireExisting = async (model: Model<any>, ids: unknown[], label: string) => {
    const list = uniq(ids);
    list.forEach((i) => asId(i, label));
    if (list.length && (await model.countDocuments({ _id: { $in: list } })) !== list.length) {
        throw new AppError(`One or more ${label} references do not exist`, 400);
    }
};

const inUse = async (checks: [Promise<number>, string][]) => {
    for (const [count, label] of checks) {
        const n = await count;
        if (n > 0) throw new AppError(`Cannot delete: used by ${n} ${label}. Deactivate it instead.`, 409);
    }
};

const defs: Record<CatalogEntity, EntityDef> = {
    platforms: {
        model: CatalogPlatform,
        fields: ['name', 'description', 'logo', 'logoSecondary', 'color', 'sortOrder', 'isActive'],
        required: ['name'],
        prepare: async (d, cur) => {
            if (d.name !== undefined && !cur) d.slug = slugify(d.name);
            if (d.slug) d.slug = slugify(d.slug);
        },
        guardDelete: async (id) =>
            inUse([
                [CatalogService.countDocuments({ platformIds: id }), 'service(s)'],
                [CatalogPackage.countDocuments({ platformId: id }), 'package(s)'],
                [CatalogFeature.countDocuments({ platformId: id }), 'feature(s)'],
            ]),
    },

    services: {
        model: CatalogService,
        fields: ['name', 'description', 'icon', 'quotationCategory', 'pricingMode', 'flowType', 'blueprint', 'platformIds', 'sortOrder', 'isActive'],
        required: ['name', 'quotationCategory'],
        prepare: async (d, cur) => {
            if (d.name !== undefined && !cur) d.slug = slugify(d.name);
            if (d.flowType === '') d.flowType = undefined;
            if (d.flowType !== undefined && !(CATALOG_FLOW_TYPES as readonly string[]).includes(d.flowType)) throw new AppError('Unknown flow type', 400);
            if (d.blueprint !== undefined) d.blueprint = sanitizeBlueprint(d.blueprint);
            if (d.platformIds) {
                d.platformIds = uniq(d.platformIds);
                await requireExisting(CatalogPlatform, d.platformIds, 'platform');
                // Dropping a platform from a service must not strand packages/features that use it.
                if (cur) {
                    const removed = (cur.platformIds ?? []).map(String).filter((p: string) => !d.platformIds.includes(p));
                    if (removed.length) {
                        await inUse([
                            [CatalogPackage.countDocuments({ serviceId: cur._id, platformId: { $in: removed } }), 'package(s) on that platform'],
                            [CatalogFeature.countDocuments({ serviceId: cur._id, platformId: { $in: removed } }), 'feature(s) on that platform'],
                        ]);
                    }
                }
            }
        },
        guardDelete: async (id) =>
            inUse([
                [CatalogPackage.countDocuments({ serviceId: id }), 'package(s)'],
                [CatalogFeature.countDocuments({ serviceId: id }), 'feature(s)'],
            ]),
        cleanup: async (id) => void (await CatalogSection.deleteMany({ serviceId: id })),
    },

    features: {
        model: CatalogFeature,
        fields: ['serviceId', 'platformId', 'name', 'description', 'group', 'kind', 'price', 'sortOrder', 'isActive'],
        required: ['serviceId', 'name'],
        prepare: async (d, cur) => {
            const serviceId = d.serviceId ?? cur?.serviceId;
            const svc = await CatalogService.findById(asId(serviceId, 'service')).lean();
            if (!svc) throw new AppError('Service not found', 400);
            if (d.platformId === '' || d.platformId === undefined) {
                if (d.platformId === '') d.platformId = null;
            }
            const platformId = d.platformId !== undefined ? d.platformId : cur?.platformId;
            if (platformId && !svc.platformIds.map(String).includes(String(platformId))) {
                throw new AppError('Platform is not enabled for this service', 400);
            }
            if (d.kind !== 'addon' && (cur?.kind ?? d.kind) !== 'addon') d.price = 0;
        },
        guardDelete: async (id) =>
            inUse([[CatalogPackage.countDocuments({ $or: [{ featureIds: id }, { addonIds: id }] }), 'package(s)']]),
    },

    packages: {
        model: CatalogPackage,
        fields: [
            'serviceId', 'platformId', 'name', 'badge', 'description', 'price', 'priceMax', 'billingCycle', 'unitLabel',
            'bullets', 'featureIds', 'featureDepths', 'addonIds', 'duration', 'supportPeriod', 'bestFor', 'notes', 'supportInclusions',
            'additionalCharges', 'blueprint', 'sortOrder', 'isActive',
        ],
        required: ['serviceId', 'name'],
        prepare: async (d, cur) => {
            const serviceId = String(d.serviceId ?? cur?.serviceId);
            const svc = await CatalogService.findById(asId(serviceId, 'service')).lean();
            if (!svc) throw new AppError('Service not found', 400);
            if (d.platformId === '') d.platformId = null;
            const platformId = d.platformId !== undefined ? d.platformId : cur?.platformId ?? null;
            if (platformId && !svc.platformIds.map(String).includes(String(platformId))) {
                throw new AppError('Platform is not enabled for this service', 400);
            }
            if (d.name !== undefined && !cur) d.slug = slugify(d.name);
            if (d.price === '') d.price = null;
            if (d.priceMax === '') d.priceMax = null;
            if (d.blueprint !== undefined) d.blueprint = sanitizeBlueprint(d.blueprint);

            // Linked features must belong to the same service and be either platform-agnostic or on the package's platform.
            for (const [key, kind] of [['featureIds', 'included'], ['addonIds', 'addon']] as const) {
                if (!d[key]) continue;
                d[key] = uniq(d[key]);
                d[key].forEach((i: string) => asId(i, 'feature'));
                const found = await CatalogFeature.find({ _id: { $in: d[key] } }, 'serviceId platformId kind').lean();
                const ok =
                    found.length === d[key].length &&
                    found.every(
                        (f) =>
                            String(f.serviceId) === serviceId &&
                            f.kind === kind &&
                            (!f.platformId || String(f.platformId) === String(platformId ?? '')),
                    );
                if (!ok) throw new AppError(`${key} must be ${kind} features of the same service/platform`, 400);
            }

            // Outline depths only apply to linked included features: keep sub (1) / sub-sub (2) levels, drop the rest.
            if (d.featureDepths !== undefined || d.featureIds) {
                const linked = new Set<string>((d.featureIds ?? cur?.featureIds ?? []).map(String));
                const raw: Doc = d.featureDepths !== undefined ? d.featureDepths : ((cur?.featureDepths as Doc | undefined) ?? {});
                d.featureDepths = Object.fromEntries(
                    Object.entries(raw && typeof raw === 'object' ? raw : {})
                        .filter(([id, depth]) => linked.has(id) && (Number(depth) === 1 || Number(depth) === 2))
                        .map(([id, depth]) => [id, Number(depth)]),
                );
            }
        },
        guardDelete: async () => undefined,
        cleanup: async (id) => void (await CatalogSection.deleteMany({ packageId: id })),
    },

    sections: {
        model: CatalogSection,
        fields: ['serviceId', 'packageId', 'kind', 'items', 'text', 'sortOrder', 'isActive'],
        required: ['serviceId', 'kind'],
        prepare: async (d, cur) => {
            const serviceId = String(d.serviceId ?? cur?.serviceId);
            if (!(await CatalogService.exists({ _id: asId(serviceId, 'service') }))) throw new AppError('Service not found', 400);
            if (d.packageId === '') d.packageId = null;
            const packageId = d.packageId !== undefined ? d.packageId : cur?.packageId ?? null;
            if (packageId) {
                const pkg = await CatalogPackage.findById(asId(packageId, 'package'), 'serviceId').lean();
                if (!pkg || String(pkg.serviceId) !== serviceId) throw new AppError('Package does not belong to this service', 400);
            }
            if (d.kind !== undefined && !(CATALOG_SECTION_KINDS as readonly string[]).includes(d.kind)) throw new AppError('Unknown section kind', 400);
            if (d.items !== undefined) d.items = normalizeItems(d.items);
            if (d.text !== undefined) d.text = String(d.text);
            const kind = d.kind ?? cur?.kind;
            if ((CATALOG_TEXT_KINDS as readonly string[]).includes(kind)) delete d.items; // text kinds never carry items
        },
        guardDelete: async () => undefined,
    },
};

/** Cleans a client-supplied item list: stable keys, trimmed titles, valid durations. */
function normalizeItems(raw: unknown): Doc[] {
    if (!Array.isArray(raw)) throw new AppError('items must be an array', 400);
    return raw
        .map((i: Doc) => {
            const title = String(i?.title ?? '').trim();
            const dur = i?.duration;
            const duration =
                dur && Number(dur.value) >= 0 && (DURATION_UNITS as readonly string[]).includes(dur.unit) && dur.value !== ''
                    ? { value: Number(dur.value), unit: dur.unit }
                    : null;
            return { key: String(i?.key || randomUUID()), title, description: i?.description ? String(i.description).trim() : undefined, duration };
        })
        .filter((i) => i.title);
}

const pick = (body: Doc, fields: string[]): Doc =>
    Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

const dupeToConflict = (e: any): never => {
    if (e?.code === 11000) throw new AppError('Already exists (same name, or this section is already defined for that scope)', 409);
    throw e;
};

/** Row counts shown in the services/platforms tables, computed for the current page only. */
const withCounts = async (entity: CatalogEntity, rows: Doc[]): Promise<Doc[]> => {
    if (!rows.length) return rows;
    const ids = rows.map((r) => r._id);
    const countBy = async (model: Model<any>, field: string) =>
        new Map<string, number>(
            (await model.aggregate([{ $unwind: `$${field}` }, { $match: { [field]: { $in: ids } } }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }])).map(
                (g: { _id: Types.ObjectId; n: number }) => [String(g._id), g.n],
            ),
        );
    if (entity === 'services') {
        const [pk, ft] = await Promise.all([countBy(CatalogPackage, 'serviceId'), countBy(CatalogFeature, 'serviceId')]);
        return rows.map((r) => ({ ...r, packageCount: pk.get(String(r._id)) ?? 0, featureCount: ft.get(String(r._id)) ?? 0 }));
    }
    if (entity === 'platforms') {
        const used = await countBy(CatalogService, 'platformIds');
        return rows.map((r) => ({ ...r, serviceCount: used.get(String(r._id)) ?? 0 }));
    }
    return rows;
};

export const CatalogCrud = {
    /**
     * Server-side pagination + search (+ service/platform/kind filters).
     * `all=true` skips paging — only for small dropdown sources (services, platforms,
     * or the features of one service).
     */
    async list(entity: CatalogEntity, q: Doc) {
        const def = defs[entity];
        const filter: Doc = {};
        if (q.isActive === 'true') filter.isActive = true;
        if (q.isActive === 'false') filter.isActive = false;
        if (q.serviceId && Types.ObjectId.isValid(String(q.serviceId))) filter.serviceId = q.serviceId;
        if (q.platformId === 'none') filter.platformId = null;
        else if (q.platformId && Types.ObjectId.isValid(String(q.platformId))) filter.platformId = q.platformId;
        if (q.kind === 'included' || q.kind === 'addon') filter.kind = q.kind;
        if (entity === 'sections') {
            if ((CATALOG_SECTION_KINDS as readonly string[]).includes(String(q.kind))) filter.kind = q.kind;
            if (q.packageId === 'none') filter.packageId = null;
            else if (q.packageId && Types.ObjectId.isValid(String(q.packageId))) filter.packageId = q.packageId;
        }
        if (typeof q.search === 'string' && q.search.trim()) {
            const rx = new RegExp(q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = entity === 'features' ? [{ name: rx }, { group: rx }] : [{ name: rx }];
        }

        const all = q.all === 'true';
        const page = Math.max(1, parseInt(String(q.page)) || 1);
        const limit = all ? 0 : Math.min(100, Math.max(1, parseInt(String(q.limit)) || 20));

        const query = def.model.find(filter).sort({ sortOrder: 1, name: 1, _id: 1 }).select('-__v');
        if (!all) query.skip((page - 1) * limit).limit(limit);
        const [rows, total] = await Promise.all([query.lean(), def.model.countDocuments(filter)]);
        const items = await withCounts(entity, rows as Doc[]);

        return {
            items,
            pagination: { page: all ? 1 : page, limit: all ? total : limit, total, pages: all ? 1 : Math.max(1, Math.ceil(total / limit)) },
        };
    },

    async get(entity: CatalogEntity, id: string) {
        const doc = await defs[entity].model.findById(asId(id, entity)).select('-__v').lean();
        if (!doc) throw new AppError('Not found', 404);
        return doc;
    },

    async create(entity: CatalogEntity, body: Doc, userId?: string) {
        const def = defs[entity];
        const data = pick(body, def.fields);
        for (const r of def.required) {
            if (data[r] === undefined || data[r] === null || data[r] === '') throw new AppError(`${r} is required`, 400);
        }
        await def.prepare(data);
        if (userId && 'createdBy' in def.model.schema.paths) data.createdBy = userId;
        try {
            return (await def.model.create(data)).toObject();
        } catch (e) {
            return dupeToConflict(e);
        }
    },

    async update(entity: CatalogEntity, id: string, body: Doc) {
        const def = defs[entity];
        const current = await def.model.findById(asId(id, entity)).lean();
        if (!current) throw new AppError('Not found', 404);
        const data = pick(body, def.fields);
        await def.prepare(data, current);
        try {
            return await def.model.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).select('-__v').lean();
        } catch (e) {
            return dupeToConflict(e);
        }
    },

    async toggle(entity: CatalogEntity, id: string) {
        const doc = await defs[entity].model.findById(asId(id, entity));
        if (!doc) throw new AppError('Not found', 404);
        doc.set('isActive', !doc.get('isActive'));
        await doc.save();
        return doc.toObject();
    },

    async remove(entity: CatalogEntity, id: string) {
        const def = defs[entity];
        asId(id, entity);
        if (!(await def.model.exists({ _id: id }))) throw new AppError('Not found', 404);
        await def.guardDelete(id);
        await def.model.deleteOne({ _id: id });
        await def.cleanup?.(id);
    },
};

/**
 * One round-trip for the quotation wizard: active services with their
 * platforms, packages, and each package's resolved features / add-ons.
 * 5 indexed queries joined in memory — no N+1. `sections` = quotation content blocks (service-wide + package overrides).
 */
export const getCatalogTree = async () => {
    const [services, platforms, packages, features, sections] = await Promise.all([
        CatalogService.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogPlatform.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogPackage.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogFeature.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogSection.find({ isActive: true }).sort({ sortOrder: 1 }).select('-__v').lean(),
    ]);
    const platformById = new Map(platforms.map((p) => [String(p._id), p]));
    const featureById = new Map(features.map((f) => [String(f._id), f]));
    const resolve = (ids: Types.ObjectId[]) => ids.map((i) => featureById.get(String(i))).filter(Boolean);

    return services.map((s) => ({
        ...s,
        platforms: s.platformIds.map((i) => platformById.get(String(i))).filter(Boolean),
        sections: sections.filter((x) => String(x.serviceId) === String(s._id)),
        packages: packages
            .filter((p) => String(p.serviceId) === String(s._id))
            .map((p) => ({ ...p, features: resolve(p.featureIds), addons: resolve(p.addonIds) })),
    }));
};

// ───────────────────────────── canvas support ─────────────────────────────

/** Everything the catalog canvas needs in one round-trip — inactive records included (it is the admin view). */
export const getCatalogGraph = async () => {
    const [services, platforms, packages, features, sections, layout] = await Promise.all([
        CatalogService.find().sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogPlatform.find().sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogPackage.find().sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogFeature.find().sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogSection.find().sort({ sortOrder: 1 }).select('-__v').lean(),
        CatalogLayout.findOne({ key: 'default' }).lean(),
    ]);
    return { services, platforms, packages, features, sections, positions: layout?.positions ?? {} };
};

export const saveCatalogLayout = async (positions: unknown) => {
    if (!positions || typeof positions !== 'object') throw new AppError('positions must be an object', 400);
    const clean: Record<string, { x: number; y: number }> = {};
    for (const [k, v] of Object.entries(positions as Doc)) {
        const x = Number(v?.x), y = Number(v?.y);
        if (k.length <= 80 && Number.isFinite(x) && Number.isFinite(y)) clean[k] = { x: Math.round(x), y: Math.round(y) };
    }
    await CatalogLayout.findOneAndUpdate({ key: 'default' }, { $set: { positions: clean } }, { upsert: true });
    return clean;
};

const freshKeys = (items: Doc[]) => items.map((i) => ({ ...i, key: randomUUID() }));

/** Copy a section onto a scope. Existing section there → items are appended (text is replaced). */
export const duplicateSection = async (id: string, target: { serviceId?: string; packageId?: string | null }) => {
    const src = await CatalogSection.findById(asId(id, 'section')).lean();
    if (!src) throw new AppError('Section not found', 404);
    const serviceId = String(target.serviceId ?? src.serviceId);
    const packageId = target.packageId === undefined ? src.packageId ?? null : target.packageId || null;
    await defs.sections.prepare({ serviceId, packageId, kind: src.kind });
    const existing = await CatalogSection.findOne({ serviceId, packageId, kind: src.kind });
    const items = freshKeys(src.items as unknown as Doc[]);
    if (existing) {
        if (items.length) existing.set('items', [...existing.items, ...items]);
        if (src.text) existing.set('text', src.text);
        await existing.save();
        return existing.toObject();
    }
    return (await CatalogSection.create({ serviceId, packageId, kind: src.kind, items, text: src.text, sortOrder: src.sortOrder, isActive: src.isActive })).toObject();
};

/**
 * Copy a package (+ its package-level sections). Same service → the new package
 * links the same features. Other service → features are cloned into that service.
 */
export const duplicatePackage = async (id: string, target: { serviceId?: string; platformId?: string | null }) => {
    const src = await CatalogPackage.findById(asId(id, 'package')).lean();
    if (!src) throw new AppError('Package not found', 404);
    const serviceId = String(target.serviceId ?? src.serviceId);
    const sameService = serviceId === String(src.serviceId);
    const platformId = target.platformId === undefined ? (sameService ? src.platformId ?? null : null) : target.platformId || null;

    const svc = await CatalogService.findById(asId(serviceId, 'service')).lean();
    if (!svc) throw new AppError('Service not found', 400);
    if (platformId && !svc.platformIds.map(String).includes(String(platformId))) throw new AppError('Platform is not enabled for this service', 400);

    let featureIds = src.featureIds, addonIds = src.addonIds;
    let featureDepths = (src.featureDepths ?? {}) as Record<string, number>;
    if (!sameService || String(platformId ?? '') !== String(src.platformId ?? '')) {
        const idMap = new Map<string, string>();
        const clone = async (ids: Types.ObjectId[]) => {
            const out: Types.ObjectId[] = [];
            for (const srcId of ids) {
                const f = await CatalogFeature.findById(srcId).lean();
                if (!f) continue;
                // Fields in the upsert filter are inserted from it; only the remaining content goes in $setOnInsert.
                const { _id, createdAt, updatedAt, __v, serviceId: _s, platformId: _p, kind, name, ...rest } = f as Doc;
                void _id; void createdAt; void updatedAt; void __v; void _s; void _p;
                const doc = await CatalogFeature.findOneAndUpdate(
                    { serviceId, platformId, kind, name },
                    { $setOnInsert: rest },
                    { upsert: true, new: true },
                ).lean();
                out.push(doc!._id as Types.ObjectId);
                idMap.set(String(srcId), String(doc!._id));
            }
            return out;
        };
        featureIds = await clone(src.featureIds);
        addonIds = await clone(src.addonIds);
        featureDepths = Object.fromEntries(Object.entries(featureDepths).filter(([k]) => idMap.has(k)).map(([k, v]) => [idMap.get(k)!, v]));
    }

    // Unique name/slug inside the target scope.
    const baseName = sameService && String(platformId ?? '') === String(src.platformId ?? '') ? `${src.name} (copy)` : src.name;
    let name = baseName, n = 2;
    while (await CatalogPackage.exists({ serviceId, platformId, slug: slugify(name) })) name = `${baseName} ${n++}`;

    const { _id, createdAt, updatedAt, __v, ...rest } = src as Doc;
    void _id; void createdAt; void updatedAt; void __v;
    const created = (await CatalogPackage.create({ ...rest, name, slug: slugify(name), serviceId, platformId, featureIds, featureDepths, addonIds })).toObject();

    for (const sec of await CatalogSection.find({ packageId: src._id }).lean()) {
        await CatalogSection.create({ serviceId, packageId: created._id, kind: sec.kind, items: freshKeys(sec.items as unknown as Doc[]), text: sec.text, sortOrder: sec.sortOrder, isActive: sec.isActive });
    }
    return created;
};
