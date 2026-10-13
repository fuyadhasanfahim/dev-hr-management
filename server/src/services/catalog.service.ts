import { Types, type Model } from 'mongoose';
import CatalogService from '../models/catalog-service.model.js';
import CatalogPlatform from '../models/catalog-platform.model.js';
import CatalogPackage from '../models/catalog-package.model.js';
import CatalogFeature from '../models/catalog-feature.model.js';
import { AppError } from '../utils/AppError.js';

/**
 * Quotation catalog — Service → Platform → Package → Feature.
 * Every link is an ObjectId reference (never a name), so renaming an item
 * cannot break a package or an old quotation. One generic CRUD per entity,
 * plus the reference-integrity rules that tie the four collections together.
 */

export type CatalogEntity = 'services' | 'platforms' | 'packages' | 'features';

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
        fields: ['name', 'description', 'icon', 'quotationCategory', 'pricingMode', 'platformIds', 'sortOrder', 'isActive'],
        required: ['name', 'quotationCategory'],
        prepare: async (d, cur) => {
            if (d.name !== undefined && !cur) d.slug = slugify(d.name);
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
            'bullets', 'featureIds', 'addonIds', 'duration', 'supportPeriod', 'bestFor', 'notes', 'supportInclusions',
            'additionalCharges', 'sortOrder', 'isActive',
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
        },
        guardDelete: async () => undefined,
    },
};

const pick = (body: Doc, fields: string[]): Doc =>
    Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

const dupeToConflict = (e: any): never => {
    if (e?.code === 11000) throw new AppError('An item with this name already exists', 409);
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
    },
};

/**
 * One round-trip for the quotation wizard: active services with their
 * platforms, packages, and each package's resolved features / add-ons.
 * 4 indexed queries joined in memory — no N+1.
 */
export const getCatalogTree = async () => {
    const [services, platforms, packages, features] = await Promise.all([
        CatalogService.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogPlatform.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogPackage.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
        CatalogFeature.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('-__v').lean(),
    ]);
    const platformById = new Map(platforms.map((p) => [String(p._id), p]));
    const featureById = new Map(features.map((f) => [String(f._id), f]));
    const resolve = (ids: Types.ObjectId[]) => ids.map((i) => featureById.get(String(i))).filter(Boolean);

    return services.map((s) => ({
        ...s,
        platforms: s.platformIds.map((i) => platformById.get(String(i))).filter(Boolean),
        packages: packages
            .filter((p) => String(p.serviceId) === String(s._id))
            .map((p) => ({ ...p, features: resolve(p.featureIds), addons: resolve(p.addonIds) })),
    }));
};
