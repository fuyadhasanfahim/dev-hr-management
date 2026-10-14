/**
 * Adds quotation blueprints (flow type, inclusions, design mode, payment milestones, revisions)
 * and the PDF-based content sections to the EXISTING catalog (run seed-catalog.ts first).
 *
 * Safe to re-run: a service/package that already has a blueprint, and a section that already
 * exists, is left untouched so admin edits are never overwritten. Pass --force to overwrite.
 *
 * Source: the five Webbriks price-plan PDFs. Anything the PDFs do not state is left blank.
 * Run from server/:  npm run seed:blueprints
 */
import mongoose, { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import envConfig from '../config/env.config.js';
import CatalogService from '../models/catalog-service.model.js';
import CatalogPackage from '../models/catalog-package.model.js';
import CatalogPlatform from '../models/catalog-platform.model.js';
import CatalogSection from '../models/catalog-section.model.js';

const force = process.argv.includes('--force');

type Incl = { key: string; label: string; kind: 'domain' | 'hosting' | 'support' | 'other'; included: boolean; termMonths: number | null; owner: '' | 'client' | 'agency'; renews: boolean; charge: number; note: string };
const incl = (key: string, label: string, kind: Incl['kind'], termMonths: number | null, o: Partial<Incl> = {}): Incl => ({
    key, label, kind, included: true, termMonths, owner: '', renews: false, charge: 0, note: '', ...o,
});

/** Defaults the agency asked for: 50/50 payment, 3 UI/UX + 5 dev revisions, no extra-work fees until set. */
const BASE = {
    paymentMilestones: [
        { label: 'Advance Payment', percentage: 50, note: 'Upon quotation acceptance' },
        { label: 'Final Payment', percentage: 50, note: 'After project handover' },
    ],
    revisions: { ui: 3, dev: 5, uiExtraFee: 0, devExtraFee: 0 },
    policies: { extraFeatureRate: 0, hourlyRate: 0 },
};

const FLOW: Record<string, 'project' | 'retainer' | 'production'> = {
    'website-development': 'project',
    'e-commerce-shopify': 'project',
    'mobile-app-development': 'project',
    'web-application-custom': 'project',
    'performance-marketing': 'retainer',
    'product-photography': 'production',
    'product-reels-video': 'production',
    'photo-video-editing': 'production',
};

// ── Package blueprints (design mode + inclusions with terms), straight from the PDFs ──
const NEXT_INCL = [
    incl('domain', 'Domain', 'domain', 12, { owner: 'client', renews: true, note: 'Domain ownership & access: client' }),
    incl('hosting', 'VPS Hosting (50GB KVM-1, Hostinger)', 'hosting', 12, { renews: true }),
    incl('support', 'Technical support', 'support', 12),
    incl('training', 'Basic admin training', 'other', null),
];
const LARAVEL_INCL = [
    incl('domain', 'Domain', 'domain', 12, { renews: true }),
    incl('hosting', 'VPS Hosting (50GB KVM-1, Hostinger)', 'hosting', 12, { renews: true }),
    incl('support', 'Technical support', 'support', 12),
];
const SHOPIFY_INCL = [
    incl('domain', 'Custom domain connection', 'domain', null),
    incl('hosting', 'Shopify-managed SSL & hosting', 'hosting', null),
    incl('support', 'Technical support', 'support', 12),
];

// serviceSlug → packageSlug → blueprint override
const PACKAGES: Record<string, Record<string, object>> = {
    'website-development': {
        starter: { _platform: 'laravel', designMode: 'template', inclusions: LARAVEL_INCL },
        'business-pro': { _platform: 'laravel', designMode: 'custom', inclusions: LARAVEL_INCL },
    },
    'e-commerce-shopify': {
        'shopify-starter': { designMode: 'template', inclusions: SHOPIFY_INCL },
        'shopify-business-pro': { designMode: 'custom', inclusions: SHOPIFY_INCL },
    },
};
// Next.js packages share the same slugs as Laravel's, so they are matched by platform.
const NEXT_PACKAGES = ['starter', 'business-pro', 'custom-solution'];

// ── Sections (content blocks) the PDFs state explicitly ──
const item = (title: string, description = '') => ({ key: randomUUID(), title, description });
const PRODUCTION_STEPS = [
    item('Requirement discussion', 'Confirm products, quantity, angles, content formats and creative brief.'),
    item('Product handover', 'The client sends or delivers the products for production.'),
    item('Planning & production', 'We arrange the shots, lighting, concept and video direction as required.'),
    item('Post-production', 'We complete editing, retouching, color adjustments and final polish.'),
    item('Final delivery', 'We provide finished, edited photo and video files in the agreed format.'),
];
const PRODUCTION_BRIEF = [
    item('Product categories'),
    item('Number of products'),
    item('Images or videos needed per product'),
    item('Preferred references'),
    item('Location requirements'),
    item('Special creative instructions'),
];
const PRODUCTION_EXCLUSIONS = [
    item('Model or talent fees'),
    item('Outdoor shooting expenses, transportation / conveyance & location-related costs'),
    item('Specific, unusual or client-requested props (client-supplied or charged separately)'),
    item('Additional production requirements, special locations, complex setups or services outside the agreed scope'),
];

type SectionSeed = { service: string; package?: string; kind: string; items?: object[]; text?: string };
const SECTIONS: SectionSeed[] = [
    ...['product-photography', 'product-reels-video'].flatMap((service) => [
        { service, kind: 'milestones', items: PRODUCTION_STEPS },
        { service, kind: 'requiredAssets', items: PRODUCTION_BRIEF },
        { service, kind: 'exclusions', items: PRODUCTION_EXCLUSIONS },
    ]),
    { service: 'product-photography', package: 'product-photography', kind: 'deliverables', items: [item('4 professionally edited photographs per product from different angles')] },
    { service: 'product-reels-video', package: 'short-form-product-reel', kind: 'deliverables', items: [item('1 edited reel, 15–30 seconds')] },
    { service: 'product-reels-video', package: 'product-explainer-ad-creative-video', kind: 'deliverables', items: [item('1 edited product presentation / explanatory video, typically 30–60 seconds (up to about 70–80 seconds when agreed)')] },
    {
        service: 'performance-marketing',
        kind: 'deliverables',
        items: [
            item('Marketing research & strategic plan before advertising starts'),
            item('8–12 Facebook & Instagram posts per month (static, carousel, reels, informative)'),
            item('Monthly content calendar'),
            item('Post copywriting & captions, scheduling and publishing'),
            item('Monthly content performance review'),
        ],
    },
    {
        service: 'performance-marketing',
        kind: 'exclusions',
        items: [
            item('Advertising budget'),
            item('Ad creative production (scriptwriting, product photography, video shooting, editing, models) — a separate budget applies when hired from the Webbriks Creative Production Team'),
        ],
    },
];

const run = async () => {
    await mongoose.connect(envConfig.mongo_uri as string);
    console.log(`Connected.${force ? ' (--force: overwriting existing blueprints)' : ''}`);

    const svcId: Record<string, Types.ObjectId> = {};
    for (const [slug, flowType] of Object.entries(FLOW)) {
        const svc = await CatalogService.findOne({ slug });
        if (!svc) { console.warn(`! service not found: ${slug}`); continue; }
        svcId[slug] = svc._id as Types.ObjectId;
        if (force || !svc.flowType) svc.flowType = flowType;
        if (force || !svc.blueprint) svc.blueprint = { ...BASE };
        svc.markModified('blueprint');
        await svc.save();
        console.log(`service  ${slug} → ${flowType}`);
    }

    const setPkg = async (filter: object, bp: Record<string, unknown>, label: string) => {
        const p = await CatalogPackage.findOne(filter);
        if (!p) { console.warn(`! package not found: ${label}`); return; }
        if (p.blueprint && !force) { console.log(`package  ${label} (kept)`); return; }
        p.blueprint = bp;
        p.markModified('blueprint');
        await p.save();
        console.log(`package  ${label}`);
    };
    for (const [service, pkgs] of Object.entries(PACKAGES)) {
        for (const [slug, { _platform, ...bp }] of Object.entries(pkgs as Record<string, any>)) {
            const filter: Record<string, unknown> = { serviceId: svcId[service], slug };
            if (_platform) {
                const pl = await CatalogPlatform.findOne({ slug: _platform }, '_id').lean();
                if (pl) filter.platformId = pl._id;
            }
            await setPkg(filter, bp, `${service}/${slug}`);
        }
    }
    {
        const next = await CatalogPlatform.findOne({ slug: 'next-js-node-js' }, '_id').lean();
        for (const slug of NEXT_PACKAGES) {
            if (next) await setPkg({ serviceId: svcId['website-development'], platformId: next._id, slug }, { designMode: 'custom', inclusions: NEXT_INCL }, `website-development/next-js/${slug}`);
        }
    }

    for (const s of SECTIONS) {
        const serviceId = svcId[s.service];
        if (!serviceId) continue;
        let packageId: Types.ObjectId | null = null;
        if (s.package) {
            const p = await CatalogPackage.findOne({ serviceId, slug: s.package }, '_id').lean();
            if (!p) { console.warn(`! package not found for section: ${s.service}/${s.package}`); continue; }
            packageId = p._id as Types.ObjectId;
        }
        const filter = { serviceId, packageId, kind: s.kind };
        const exists = await CatalogSection.exists(filter);
        if (exists && !force) { console.log(`section  ${s.service}/${s.package ?? '*'} ${s.kind} (kept)`); continue; }
        await CatalogSection.findOneAndUpdate(filter, { $set: { items: s.items ?? [], text: s.text ?? '', isActive: true } }, { upsert: true, setDefaultsOnInsert: true });
        console.log(`section  ${s.service}/${s.package ?? '*'} ${s.kind}`);
    }

    await mongoose.disconnect();
    console.log('Done.');
};

run().catch(async (e) => {
    console.error(e);
    await mongoose.disconnect();
    process.exit(1);
});
