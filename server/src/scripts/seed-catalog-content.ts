/**
 * Loads the Webbriks default quotation content (Webbriks_Quotation_Default_Content.docx) into the
 * catalog: per package → sections (title, overview, deliverables, milestones, responsibilities,
 * exclusions, support note), Terms lists, general terms and blueprint revisions / payment milestones.
 * Data: ./data/catalog-default-content.json. Packages must already exist (run seed-catalog.ts first).
 *
 * Replaces the package-level sections / term lists it covers (a JSON backup is written first).
 * Run from server/:  node --import tsx src/scripts/seed-catalog-content.ts [--dry]
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import CatalogService from '../models/catalog-service.model.js';
import CatalogPlatform from '../models/catalog-platform.model.js';
import CatalogPackage from '../models/catalog-package.model.js';
import CatalogSection from '../models/catalog-section.model.js';

interface Entry {
    service: string; platform: string | null; slug: string; duration: string;
    revisions: { ui: number | null; dev: number | null };
    paymentMilestones: { label: string; percentage: number; note: string }[];
    title: string; overview: string; deliverables: string[]; milestones: string[];
    clientResponsibilities: string[]; exclusions: string[]; supportNote: string;
    supportInclusions: string[]; supportExclusions: string[]; notes: string[];
}

const data: Entry[] = JSON.parse(readFileSync(new URL('./data/catalog-default-content.json', import.meta.url), 'utf8'));
const dry = process.argv.includes('--dry');
const items = (l: string[]) => l.map((title) => ({ key: randomUUID(), title }));

const run = async () => {
    await mongoose.connect(envConfig.mongo_uri as string);
    const pairs: { e: Entry; pkg: any }[] = [];
    for (const e of data) {
        const svc = await CatalogService.findOne({ slug: e.service }).lean();
        const plat = e.platform ? await CatalogPlatform.findOne({ slug: e.platform }).lean() : null;
        const pkg = svc && (await CatalogPackage.findOne({ serviceId: svc._id, platformId: plat?._id ?? null, slug: e.slug }).lean());
        if (!pkg) throw new Error(`Package not found: ${e.service}/${e.platform ?? '-'}/${e.slug}`);
        pairs.push({ e, pkg });
    }

    if (!dry) {
        mkdirSync('backups', { recursive: true });
        const ids = pairs.map((p) => p.pkg._id);
        const file = `backups/catalog-content-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        writeFileSync(file, JSON.stringify({ packages: await CatalogPackage.find({ _id: { $in: ids } }).lean(), sections: await CatalogSection.find({ packageId: { $in: ids } }).lean() }, null, 1));
        console.log(`Backup: ${file}`);
    }

    for (const { e, pkg } of pairs) {
        const scope = { serviceId: pkg.serviceId, packageId: pkg._id };
        const sections: [string, object][] = [
            ['projectTitle', { text: e.title }],
            ['projectOverview', { text: e.overview }],
            ['supportNote', { text: e.supportNote }],
            ['deliverables', { items: items(e.deliverables) }],
            ['milestones', { items: items(e.milestones) }],
            ['clientResponsibilities', { items: items(e.clientResponsibilities) }],
            ['exclusions', { items: items(e.exclusions) }],
        ];
        const bp = (pkg.blueprint ?? {}) as Record<string, any>;
        const set = {
            duration: e.duration,
            supportInclusions: e.supportInclusions,
            additionalCharges: e.supportExclusions,
            notes: e.notes,
            blueprint: {
                ...bp,
                revisions: { ui: e.revisions.ui, dev: e.revisions.dev, uiExtraFee: 0, devExtraFee: 0 },
                paymentMilestones: e.paymentMilestones,
                policies: { ...(bp.policies ?? {}), extraFeatureRate: bp.policies?.extraFeatureRate ?? 0, hourlyRate: bp.policies?.hourlyRate ?? 0, validityDays: 15 },
            },
        };
        console.log(`${dry ? '[dry] ' : ''}${e.service}/${e.slug}: ${sections.length} sections, ${e.notes.length} general terms`);
        if (dry) continue;
        await CatalogPackage.updateOne({ _id: pkg._id }, { $set: set });
        for (const [kind, body] of sections)
            await CatalogSection.updateOne({ ...scope, kind }, { $set: { ...body, isActive: true }, $setOnInsert: { sortOrder: 0 } }, { upsert: true });
    }
};

run()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
