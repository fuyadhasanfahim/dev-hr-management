import CatalogServiceModel from '../models/catalog-service.model.js';
import CatalogPlatformModel from '../models/catalog-platform.model.js';
import CatalogPackageModel from '../models/catalog-package.model.js';
import CatalogFeatureModel from '../models/catalog-feature.model.js';
import { logger } from '../lib/logger.js';

// The live quotation catalog (services → platforms → packages → features), turned into prompt text so the AI can
// compare what a customer wants with what each package includes — straight from the same data the quotations use.
// Overview (all packages, prices) always; the full feature list only for the service/platform the chat is about.

interface Snapshot {
    at: number;
    services: any[];
    platforms: Map<string, any>;
    packages: any[];
    features: Map<string, any>;
}

let cache: Snapshot | null = null;
const TTL_MS = 5 * 60_000;
const MAX_FEATURES_PER_PACKAGE = 40;

async function load(): Promise<Snapshot> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache;
    const [services, platforms, packages, features] = await Promise.all([
        CatalogServiceModel.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
        CatalogPlatformModel.find({ isActive: true }).lean(),
        CatalogPackageModel.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
        CatalogFeatureModel.find({ isActive: true }).lean(),
    ]);
    cache = {
        at: Date.now(),
        services,
        platforms: new Map(platforms.map((p: any) => [String(p._id), p])),
        packages,
        features: new Map(features.map((f: any) => [String(f._id), f])),
    };
    return cache;
}

const money = (n: number | null | undefined, max?: number | null) =>
    n == null ? 'custom quote' : `BDT ${n.toLocaleString('en-US')}${max ? `–${max.toLocaleString('en-US')}` : ''}`;

const CYCLE: Record<string, string> = {
    'one-time': '',
    monthly: '/month',
    yearly: '/year',
    'per-image': '/image',
    'per-video': '/video',
    'per-second': '/second',
    'per-10s': '/10 seconds',
};

/** Prompt text describing the catalog, or '' when it can't be read (the AI then relies on the knowledge base alone). */
export async function getCatalogContext(chatText: string, opts: { showPrices?: boolean } = {}): Promise<string> {
    // Prices are left out of the text entirely until the sales flow reaches the price step — the model can't leak what it never saw.
    const showPrices = opts.showPrices !== false;
    try {
        const snap = await load();
        const text = chatText.toLowerCase();
        const mentioned = (name: string, slug?: string) => {
            const n = name.toLowerCase();
            return text.includes(n) || (!!slug && text.includes(slug.replace(/-/g, ' ')));
        };
        const lines: string[] = [];
        for (const service of snap.services) {
            const sid = String(service._id);
            const pkgs = snap.packages.filter((p: any) => String(p.serviceId) === sid);
            if (!pkgs.length) continue;
            const serviceHit = mentioned(service.name, service.slug);
            lines.push(`SERVICE: ${service.name}${service.description ? ` — ${service.description}` : ''}`);
            for (const p of pkgs) {
                const platform = p.platformId ? snap.platforms.get(String(p.platformId)) : null;
                const platformHit = !!platform && mentioned(platform.name, platform.slug);
                const label = `${platform ? `${platform.name} · ` : ''}${p.name}`;
                lines.push(
                    `- ${label}${showPrices ? `: ${money(p.price, p.priceMax)}${CYCLE[p.billingCycle] ?? ''}` : ''}` +
                        `${p.bestFor ? ` — best for: ${String(p.bestFor).slice(0, 100)}` : ''}` +
                        `${p.duration ? ` — delivery: ${p.duration}` : ''}`,
                );
                if (platformHit || (serviceHit && !platform)) {
                    const names = (p.featureIds ?? [])
                        .map((id: any) => snap.features.get(String(id)))
                        .filter(Boolean)
                        .slice(0, MAX_FEATURES_PER_PACKAGE)
                        .map((f: any) => f.name);
                    const bullets: string[] = names.length ? names : (p.bullets ?? []).slice(0, MAX_FEATURES_PER_PACKAGE);
                    if (bullets.length) lines.push(`  includes: ${bullets.join('; ')}`);
                    // Optional paid extras for this package — what the "extras" step offers the customer.
                    const addons = (p.addonIds ?? [])
                        .map((id: any) => snap.features.get(String(id)))
                        .filter(Boolean)
                        .slice(0, MAX_FEATURES_PER_PACKAGE)
                        .map((f: any) => (showPrices && f.price ? `${f.name} (+${money(f.price)})` : f.name));
                    if (addons.length) lines.push(`  optional extras: ${addons.join('; ')}`);
                }
            }
        }
        return lines.join('\n').slice(0, 9000);
    } catch (err: any) {
        logger.error(`AI catalog context failed: ${err.message}`);
        return '';
    }
}
