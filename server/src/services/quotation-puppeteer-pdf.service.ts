import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QuotationModel from '../models/quotation.model.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import { isUpfrontBillingCycle } from '../types/quotation.type.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ────────────────────────────────────────────────────────────────────────────
 * WebBriks Quotation PDF — "Editorial Proposal" edition.
 *
 * A three-page commercial proposal (Cover → Scope & Delivery → Investment &
 * Terms) built to read like a document a senior designer at a premium agency
 * prepared for one specific client — not a system-generated invoice. The
 * visual language is deliberately restrained: near-black type, one accent
 * colour used sparingly, hairline dividers instead of boxed cards, and a
 * single low-opacity brand mark on the cover only.
 *
 * Typography is self-contained: fonts are fetched once and embedded as base64
 * @font-face rules so a cold Puppeteer container never falls back to a system
 * font mid-render. Page numbers ("WEBBRIKS · #QTN-… · 1 / 3") are rendered by
 * Chrome's own header/footer templating (via `page.pdf({ displayHeaderFooter
 * })`), which is the only reliable way to know the true page count for
 * variable-length content — every other element on the page is authored HTML.
 * ──────────────────────────────────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
    'web-development': 'Web Design & Development',
    marketing: 'Marketing',
    'photo-editing': 'Photo Editing',
    'video-editing': 'Video Editing',
};

const CATEGORY_KICKERS: Record<string, string> = {
    'web-development': 'Engineering & Product',
    marketing: 'Growth & Analytics',
    'photo-editing': 'Visual Production',
    'video-editing': 'Motion & Post-Production',
};

const SERVICE_RANK_ORDER: Record<string, number> = {
    'web-development': 1,
    marketing: 2,
    'video-editing': 3,
    'photo-editing': 4,
};

/** Formats currency amounts cleanly without unnecessary trailing zeros (e.g., "Tk 15,000" or "$1,500"). */
function formatMoneyPdf(
    amount: number | null | undefined,
    currency?: string | null,
    showDecimals = false,
): string {
    const n = Number(amount || 0);
    const fractionDigits = showDecimals || (n % 1 !== 0) ? 2 : 0;
    const BDT_TOKENS = new Set(['BDT', 'BDT.', '৳', 'Tk', 'TK', 'tk']);
    const cur = currency?.trim() || '';
    const isBDT = cur && BDT_TOKENS.has(cur);

    if (isBDT) {
        return `Tk ${n.toLocaleString('en-IN', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        })}`;
    }

    const fallbackSymbol = cur || '$';
    if (/^[A-Za-z]{3}$/.test(fallbackSymbol)) {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: fallbackSymbol.toUpperCase(),
                minimumFractionDigits: fractionDigits,
                maximumFractionDigits: fractionDigits,
            }).format(n);
        } catch {
            /* fall through */
        }
    }

    return `${fallbackSymbol}${n.toLocaleString('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    })}`;
}

function esc(s: unknown): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Normalizes typography on ingest: fixes the wrong modifier-letter apostrophe
 * (U+02BC / U+2018 / U+201B) to a proper right single quote, straightens smart
 * double quotes, and collapses whitespace.
 */
function normalizeText(input: unknown): string {
    return String(input ?? '')
        .replace(/[ʼ‘‛]/g, '’')
        .replace(/[“”]/g, '"')
        .replace(/ /g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trimEnd();
}

/* ── Data hygiene ─────────────────────────────────────────────────────────── */

// Unambiguous placeholder markers that must never reach a client. Kept narrow
// on purpose: substrings like "new feature" appear inside legitimate copy
// ("New features requested after final scope approval"), so those are handled
// by exact-match row filtering below — not by this render-blocking gate.
const PLACEHOLDER_BLOCK_RE = /temp@|@temp\.|@example\.|example\.com|lorem ipsum|test@|@test\.|placeholder/i;

// Exact leftover-row values dropped from any scope list (case-insensitive, whole
// value only — never a substring match).
const EXACT_PLACEHOLDER_ROWS = new Set([
    'new feature',
    'new features',
    'lorem ipsum',
    'placeholder',
    'sample',
    'test',
    'untitled',
    'n/a',
    '-',
]);

function isPlaceholderRow(text: string): boolean {
    const t = text.trim().toLowerCase();
    return t.length === 0 || EXACT_PLACEHOLDER_ROWS.has(t);
}

const DEFAULT_LOGO =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png';

// Authorising signature shown at the close of the document. Overridable per
// deployment so a different signatory can be configured without a code change.
const DEFAULT_SIGNATURE =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png';
const SIGNATORY_NAME = process.env.COMPANY_SIGNATORY_NAME || 'Md. Ashaduzzaman';
const SIGNATORY_ROLE = process.env.COMPANY_SIGNATORY_ROLE || 'Founder & CEO';

// Read the local logo as a fallback base64 string
let LOCAL_LOGO_BASE64 = '';
try {
    const pathsToTry = [
        path.join(__dirname, '../assets/logo.png'),
        path.join(process.cwd(), 'src/assets/logo.png'),
        path.join(process.cwd(), 'server/src/assets/logo.png'),
    ];
    for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
            const fileBuf = fs.readFileSync(p);
            LOCAL_LOGO_BASE64 = `data:image/png;base64,${fileBuf.toString('base64')}`;
            break;
        }
    }
} catch (e) {
    logger.error({ err: e }, 'Failed to load local logo.png');
}

const FALLBACK_PIXEL_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const DEFAULT_COMPANY = {
    name: 'WebBriks',
    website: 'www.webbriks.com',
    email: 'hello@webbriks.com',
    phone: '+880 1977 201923',
    address: '115 Senpara Parbata, Mirpur, Dhaka 1216, Bangladesh.',
};

const imageCache = new Map<string, string>();

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
    if (!url) return null;
    if (imageCache.has(url)) {
        return imageCache.get(url)!;
    }
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 18_000);
        const res = await fetch(url, {
            signal: ctrl.signal,
            redirect: 'follow',
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) return null;
        const ctRaw = (res.headers.get('content-type') || '').split(';')[0] ?? '';
        const ct = ctRaw.trim() || 'image/png';
        const safeCt = /^image\/[a-z0-9.+-]+$/i.test(ct) ? ct : 'image/png';
        const dataUrl = `data:${safeCt};base64,${buf.toString('base64')}`;
        imageCache.set(url, dataUrl);
        return dataUrl;
    } catch {
        return null;
    }
}

/* ── Self-hosted font pipeline ────────────────────────────────────────────── */

const BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Google Fonts family specs. Only the latin (and, for Hind Siliguri, bengali)
// subsets are embedded to keep the payload lean. Inter carries the entire
// type system (body copy through display headings — one typeface, hierarchy
// via weight/size); Geist Mono is reserved for eyebrows, labels and figures.
const FONT_FAMILIES: Array<{ spec: string; subsets: string[] }> = [
    { spec: 'Inter:wght@400;500;600;700;800', subsets: ['latin'] },
    { spec: 'Geist+Mono:wght@400;500;600', subsets: ['latin'] },
    { spec: 'Hind+Siliguri:wght@400;600', subsets: ['bengali', 'latin'] },
];

let embeddedFontCss: string | null = null;

async function fetchText(url: string): Promise<string | null> {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15_000);
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': BROWSER_UA } });
        clearTimeout(timer);
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

async function fetchWoff2AsDataUrl(url: string): Promise<string | null> {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15_000);
        const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': BROWSER_UA } });
        clearTimeout(timer);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) return null;
        return `data:font/woff2;base64,${buf.toString('base64')}`;
    } catch {
        return null;
    }
}

/**
 * Builds a block of @font-face rules with the woff2 payloads inlined as base64.
 * Returns '' on any failure so the CSS font stacks fall back to system fonts —
 * the document still renders, it just loses the custom faces.
 */
async function buildEmbeddedFontCss(): Promise<string> {
    if (embeddedFontCss !== null) return embeddedFontCss;

    const cssParts: string[] = [];

    for (const family of FONT_FAMILIES) {
        try {
            const css = await fetchText(
                `https://fonts.googleapis.com/css2?family=${family.spec}&display=swap`,
            );
            if (!css) continue;

            // Split into per-face blocks, each preceded by a `/* subset */` comment.
            const blocks = css.split('@font-face').slice(1);
            let precedingComment = '';
            const commentMatches = [...css.matchAll(/\/\*\s*([a-z0-9-]+)\s*\*\//gi)];
            const commentQueue = commentMatches.map((m) => m[1]?.toLowerCase() ?? '');

            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i] ?? '';
                const subset = commentQueue[i] ?? precedingComment;
                precedingComment = subset;
                if (!family.subsets.includes(subset)) continue;

                const urlMatch = block.match(/url\((https:[^)]+\.woff2)\)/);
                if (!urlMatch || !urlMatch[1]) continue;

                const dataUrl = await fetchWoff2AsDataUrl(urlMatch[1]);
                if (!dataUrl) continue;

                const rebuilt = `@font-face${block.replace(urlMatch[0], `url(${dataUrl})`)}`;
                cssParts.push(rebuilt);
            }
        } catch (e) {
            logger.warn({ err: e, family: family.spec }, 'quotation.font_embed_failed');
        }
    }

    embeddedFontCss = cssParts.join('\n');
    return embeddedFontCss;
}

/* ── Cover brand mark: cropped out of the master logo at render time ────── */

let cachedMarkDataUrl: string | null = null;

/**
 * Crops the square "WB" mark out of the full wordmark logo using an off-screen
 * <canvas> inside a scratch Puppeteer page. Scans for the transparent gap that
 * separates the icon from the "webbriks" wordmark text, so it stays correct
 * even if the source logo file is swapped for a different export. Falls back
 * to the full logo (and finally to `null`, which just hides the mark) if
 * anything about the crop fails — a missing decoration must never fail a PDF.
 */
async function extractBrandMark(
    browser: Awaited<ReturnType<typeof puppeteer.launch>>,
    logoDataUrl: string,
): Promise<string | null> {
    if (cachedMarkDataUrl) return cachedMarkDataUrl;
    if (!logoDataUrl || !logoDataUrl.startsWith('data:image')) return null;

    const page = await browser.newPage();
    try {
        const cropped = await page.evaluate(async (src: string) => {
            // Runs inside the Puppeteer (browser) context, not Node — the DOM
            // globals below don't exist in this file's Node/TS lib, so they're
            // reached via `globalThis as any` rather than typed directly.
            const g = globalThis as any;
            const img = new g.Image();
            const loaded = new Promise<boolean>((resolve) => {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
            });
            img.src = src;
            if (!(await loaded)) return null;

            const w = img.naturalWidth;
            const h = img.naturalHeight;
            if (!w || !h) return null;

            const canvas = g.document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.drawImage(img, 0, 0);

            let imageData: any;
            try {
                imageData = ctx.getImageData(0, 0, w, h);
            } catch {
                return null;
            }
            const data = imageData.data;
            const ALPHA_THRESHOLD = 12;

            const colHasPixel = new Array<boolean>(w).fill(false);
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    if (data[(y * w + x) * 4 + 3]! > ALPHA_THRESHOLD) {
                        colHasPixel[x] = true;
                        break;
                    }
                }
            }

            // Find the right edge of the icon: the first sufficiently-wide run of
            // empty columns after content has started marks the gap before the
            // wordmark text.
            const GAP_THRESHOLD = Math.max(8, Math.round(h * 0.03));
            let rightEdge = w - 1;
            let started = false;
            let gapRun = 0;
            for (let x = 0; x < w; x++) {
                if (colHasPixel[x]) {
                    started = true;
                    gapRun = 0;
                    continue;
                }
                if (started) {
                    gapRun++;
                    if (gapRun >= GAP_THRESHOLD) {
                        rightEdge = x - gapRun;
                        break;
                    }
                }
            }
            if (rightEdge < 8) return null;

            let top = h;
            let bottom = -1;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x <= rightEdge; x++) {
                    if (data[(y * w + x) * 4 + 3]! > ALPHA_THRESHOLD) {
                        if (y < top) top = y;
                        if (y > bottom) bottom = y;
                        break;
                    }
                }
            }
            if (top >= bottom) {
                top = 0;
                bottom = h - 1;
            }

            const cropW = rightEdge + 1;
            const cropH = bottom - top + 1;
            const out = g.document.createElement('canvas');
            out.width = cropW;
            out.height = cropH;
            const octx = out.getContext('2d');
            if (!octx) return null;
            octx.drawImage(canvas, 0, top, cropW, cropH, 0, 0, cropW, cropH);
            return out.toDataURL('image/png');
        }, logoDataUrl);

        cachedMarkDataUrl = cropped || logoDataUrl;
        return cachedMarkDataUrl;
    } catch (e) {
        logger.warn({ err: e }, 'quotation.brand_mark_crop_failed');
        return logoDataUrl;
    } finally {
        await page.close().catch(() => {});
    }
}

/* ── Scope tree parsing & counting ────────────────────────────────────────── */

interface ParsedFeatureNode {
    name: string;
    route?: string;
    price?: number;
    priceStr?: string;
    level: number;
    children: ParsedFeatureNode[];
}

/** Parses flat indented scope strings into a structured feature tree. Placeholder
 *  and empty rows are filtered out here so they never reach the layout. */
function parseScopeTree(rawItems: string[]): ParsedFeatureNode[] {
    const parsedList = rawItems
        .map((rawText) => {
            const match = rawText.match(/^(\s*)/);
            const indentStr = match ? match[0] : '';
            const level = Math.min(Math.floor(indentStr.replace(/\t/g, '    ').length / 2), 4);

            let text = normalizeText(rawText.trim().replace(/^[-*•◦▪+]\s*/, '').trim());
            let route = '';
            let priceNum: number | undefined = undefined;
            let priceStr = '';

            const priceMatch = text.match(/\s*-\s*([৳$]?\d[\d,.]*)$/);
            if (priceMatch && priceMatch[1] && priceMatch.index !== undefined) {
                priceStr = priceMatch[1].trim();
                const cleanDigits = priceStr.replace(/[^0-9.]/g, '');
                if (cleanDigits) priceNum = Number(cleanDigits);
                text = text.substring(0, priceMatch.index).trim();
            }

            const routeMatch = text.match(/\s*\(([^)]+)\)$/);
            if (routeMatch && routeMatch[1] && routeMatch.index !== undefined) {
                const potentialRoute = routeMatch[1].trim();
                if (potentialRoute.startsWith('/') || potentialRoute.startsWith('http')) {
                    route = potentialRoute;
                    text = text.substring(0, routeMatch.index).trim();
                }
            }

            return { name: text, route: route || undefined, price: priceNum, priceStr: priceStr || undefined, level };
        })
        // Drop leftover placeholder rows (e.g. a stray "New Feature").
        .filter((item) => !isPlaceholderRow(item.name));

    const nodes: ParsedFeatureNode[] = [];
    const stack: { node: ParsedFeatureNode; level: number }[] = [];

    for (const item of parsedList) {
        const node: ParsedFeatureNode = {
            name: item.name,
            route: item.route,
            price: item.price,
            priceStr: item.priceStr,
            level: item.level,
            children: [],
        };

        while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= item.level) {
            stack.pop();
        }

        const parent = stack[stack.length - 1];
        if (!parent) {
            nodes.push(node);
        } else {
            parent.node.children.push(node);
        }

        stack.push({ node, level: item.level });
    }

    return nodes;
}

/** Counts every descendant of a node (i.e. all deliverables beneath a module). */
function countDescendants(node: ParsedFeatureNode): number {
    let c = 0;
    for (const child of node.children) c += 1 + countDescendants(child);
    return c;
}

/* ── Billing-cycle presentation ───────────────────────────────────────────── */

const BILLING_CYCLE_LABELS: Record<string, string> = {
    'one-time': 'One-time',
    monthly: 'Monthly',
    yearly: 'Yearly',
    'per-image': 'Per image',
    'per-video': 'Per video',
    'per-second': 'Per second',
    'per-10s': 'Per 10 sec',
};

function billingCycleLabel(cycle: unknown): string {
    const key = String(cycle || 'one-time');
    return BILLING_CYCLE_LABELS[key] || key;
}

/* ── Section model ────────────────────────────────────────────────────────── */

interface TechStackModel {
    description: string;
    rows: Array<[string, string[]]>;
}

interface LineItemModel {
    title: string;
    description: string;
    billingCycle: string;
    cycleLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    isUpfront: boolean;
}

interface SectionModel {
    category: string;
    label: string;
    kicker: string;
    scopeDescription: string;
    modules: ParsedFeatureNode[];
    deliverableCount: number;
    techStack: TechStackModel | null;
    basePrice: number;
    /** Every line item, upfront and recurring alike, in authored order. */
    lineItems: LineItemModel[];
    upfrontLineItems: LineItemModel[];
    recurringLineItems: LineItemModel[];
    /** Mirrors calculateTotals() in quotation.service.ts so the printed
     *  breakdown reconciles exactly with the stored grand total. */
    serviceBase: number;
    discountPct: number;
    discountAmount: number;
    taxRatePct: number;
    taxAmount: number;
    serviceTotal: number;
    recurringMonthly: number;
}

function buildTechStack(tech: any): TechStackModel | null {
    if (!tech) return null;
    const pick = (v: any): string[] =>
        (Array.isArray(v) ? v : [])
            .map((x: any) => normalizeText(x))
            .filter((x: string) => x && !isPlaceholderRow(x));

    const rows: Array<[string, string[]]> = (
        [
            ['Frontend', pick(tech.frontend)],
            ['Backend', pick(tech.backend)],
            ['Database', pick(tech.database)],
            ['Tools', pick(tech.tools)],
        ] as Array<[string, string[]]>
    ).filter(([, list]) => list.length > 0);

    const description = normalizeText(tech.description || '');
    if (rows.length === 0 && !description) return null;
    return { description, rows };
}

function buildSections(services: any[]): SectionModel[] {
    const sorted = [...services].sort((a, b) => {
        const oa = SERVICE_RANK_ORDER[a?.category] ?? 99;
        const ob = SERVICE_RANK_ORDER[b?.category] ?? 99;
        return oa - ob;
    });

    return sorted
        .map((service) => {
            const category = String(service?.category || '');
            const rawItems = Array.isArray(service?.scopeItems)
                ? service.scopeItems.map((x: any) => String(x || '').replace(/\s+$/, ''))
                : [];
            const tree = parseScopeTree(rawItems);
            // Keep every authored module — including leaf modules with no
            // children, which are legitimate single-line deliverables.
            const modules = tree;
            const deliverableCount = modules.reduce((sum, m) => sum + countDescendants(m), 0);

            const rawLineItems: any[] = Array.isArray(service?.lineItems) ? service.lineItems : [];
            const lineItems: LineItemModel[] = rawLineItems.map((item) => {
                const billingCycle = String(item?.billingCycle || 'one-time');
                const quantity = typeof item?.quantity === 'number' ? item.quantity : 1;
                const unitPrice = Number(item?.price) || 0;
                return {
                    title: normalizeText(item?.title || 'Line item'),
                    description: normalizeText(item?.description || ''),
                    billingCycle,
                    cycleLabel: billingCycleLabel(billingCycle),
                    quantity,
                    unitPrice,
                    lineTotal: unitPrice * quantity,
                    isUpfront: isUpfrontBillingCycle(billingCycle as any),
                };
            });

            const upfrontLineItems = lineItems.filter((l) => l.isUpfront);
            const recurringLineItems = lineItems.filter((l) => !l.isUpfront);
            const recurringMonthly = recurringLineItems
                .filter((l) => l.billingCycle === 'monthly')
                .reduce((sum, l) => sum + l.lineTotal, 0);

            const basePrice = Number(service?.basePrice) || 0;
            const upfrontLineItemsTotal = upfrontLineItems.reduce((sum, l) => sum + l.lineTotal, 0);
            const serviceBase = basePrice + upfrontLineItemsTotal;
            const discountPct = Number(service?.discount) || 0;
            const discountAmount = (serviceBase * discountPct) / 100;
            const serviceSubtotal = serviceBase - discountAmount;
            const taxRatePct = Number(service?.taxRate) || 0;
            const taxAmount = (serviceSubtotal * taxRatePct) / 100;

            const rawDesc = normalizeText(service?.scopeDescription || '');
            const isLorem = rawDesc.toLowerCase().includes('lorem ipsum');

            return {
                category,
                label: CATEGORY_LABELS[category] || category || 'Service',
                kicker: CATEGORY_KICKERS[category] || 'Service Scope',
                scopeDescription: isLorem ? '' : rawDesc,
                modules,
                deliverableCount,
                techStack: buildTechStack(service?.techStack),
                basePrice,
                lineItems,
                upfrontLineItems,
                recurringLineItems,
                serviceBase,
                discountPct,
                discountAmount,
                taxRatePct,
                taxAmount,
                serviceTotal: serviceSubtotal + taxAmount,
                recurringMonthly,
            } as SectionModel;
        })
        .filter((s) => s.modules.length > 0 || s.basePrice > 0 || s.lineItems.length > 0);
}

/* ── Payment milestone phrasing ──────────────────────────────────────────── */

function milestonePhrase(index: number, total: number): string {
    if (total <= 1) return 'Due in full at project kickoff.';
    if (index === 0) return 'Advance payment required to initiate the project.';
    if (index === total - 1) return 'Remaining balance after final delivery and approval.';
    return 'Due upon reaching the agreed project milestone.';
}

/* ── Print HTML ───────────────────────────────────────────────────────────── */

export function buildPrintHtml(
    q: Record<string, any>,
    ctx: { logoSrc: string; markSrc: string | null; fontCss: string; signatureSrc?: string },
): string {
    const client = q.client || {};
    const details = q.details || {};
    const totals = q.totals || {};
    const currency = q.currency || 'BDT';

    const quotationNo = String(q.quotationNumber || 'DRAFT-001').replace(/^#/, '').trim() || 'DRAFT-001';
    const version = Number(q.version) || 1;
    const issueDate = details?.date
        ? format(new Date(details.date), 'MMMM dd, yyyy')
        : format(new Date(), 'MMMM dd, yyyy');
    const validUntilStr = details?.validUntil
        ? format(new Date(details.validUntil), 'MMMM dd, yyyy')
        : '—';

    const companyName = normalizeText(q.company?.name || DEFAULT_COMPANY.name);
    const companyWebsite = normalizeText(q.company?.website || DEFAULT_COMPANY.website);
    const companyEmail = normalizeText(q.company?.email || DEFAULT_COMPANY.email);
    const companyPhone = normalizeText(q.company?.phone || DEFAULT_COMPANY.phone);
    const companyAddress = normalizeText(q.company?.address || DEFAULT_COMPANY.address);

    const clientContact = normalizeText(client.contactName || '');
    const clientCompany = normalizeText(client.companyName || '');
    const clientAddress = normalizeText(client.address || '');
    const clientEmail = normalizeText(client.email || '');
    const clientPhone = normalizeText(client.phone || '');
    const clientPrimary = clientContact || clientCompany || 'Valued Client';
    const clientSecondary =
        clientCompany && clientCompany.toLowerCase() !== clientPrimary.toLowerCase() ? clientCompany : '';

    const proposalTitle = normalizeText(details?.title || 'Digital Agency Proposal');
    const rawOverview = normalizeText(q.overview || details?.overview || '');
    const overview = rawOverview && !rawOverview.toLowerCase().includes('lorem ipsum') ? rawOverview : '';

    const sections = buildSections(Array.isArray(q.services) ? q.services : []);

    const grandTotalVal = Number(
        totals.grandTotal ?? sections.reduce((s, sec) => s + sec.serviceTotal, 0),
    );
    const subtotalVal = Number(totals.subtotal ?? grandTotalVal);
    const discountVal = Number(totals.discountAmount || 0);
    const taxVal = Number(totals.taxAmount || 0);

    const notIncludedItems = (Array.isArray(q.notIncluded) ? q.notIncluded : [])
        .map((s: any) => normalizeText(s))
        .filter((s: string) => s && !isPlaceholderRow(s));
    const clientRequirements = (Array.isArray(q.clientRequirements) ? q.clientRequirements : [])
        .map((s: any) => normalizeText(s))
        .filter((s: string) => s && !isPlaceholderRow(s));
    const includedSupportItems = (Array.isArray(q.includedSupport) ? q.includedSupport : [])
        .map((s: any) => normalizeText(s))
        .filter((s: string) => s && !isPlaceholderRow(s));
    const keyTermsItems = (Array.isArray(q.keyTerms) ? q.keyTerms : [])
        .map((s: any) => normalizeText(s))
        .filter((s: string) => s && !isPlaceholderRow(s));
    const workflowSteps = (Array.isArray(q.workflow) ? q.workflow : [])
        .map((s: any) => normalizeText(s))
        .filter((s: string) => s && !isPlaceholderRow(s));

    // The quotation model carries no free-form terms array, so the standard
    // contractual terms are composed from the quotation's own real fields
    // (validity date, currency, company and client names). Any terms the
    // document should state that are *not* derivable — exclusions and client
    // obligations — come from notIncluded/clientRequirements and are listed
    // under their own headings rather than being restated here.
    const termsItems: Array<{ title: string; body: string }> = [
        { title: 'Quotation validity', body: `This quotation is valid until ${validUntilStr}. Pricing may be revised after this date.` },
        { title: 'Taxes & currency', body: `All amounts are in ${currency} and exclusive of applicable taxes unless stated otherwise.` },
        { title: 'Scope changes', body: 'Any change in scope may affect the price and timeline, and will be agreed in writing before the work proceeds.' },
        { title: 'Liability', body: `${companyName} is not liable for delays caused by client-side dependencies.` },
        { title: 'Ownership', body: 'Ownership of the final deliverables transfers to the client upon full payment.' },
    ];

    const storedRecurring = (Array.isArray(q.recurringCharges) ? q.recurringCharges : []).map((item: any) => {
        const billingCycle = String(item?.billingCycle || 'monthly');
        const quantity = typeof item?.quantity === 'number' ? item.quantity : 1;
        const unitPrice = Number(item?.price) || 0;
        return {
            title: normalizeText(item?.title || 'Recurring item'),
            description: normalizeText(item?.description || ''),
            billingCycle,
            cycleLabel: billingCycleLabel(billingCycle),
            quantity,
            unitPrice,
            lineTotal: unitPrice * quantity,
            isUpfront: false,
        } as LineItemModel;
    });
    const recurringItems: LineItemModel[] = storedRecurring.length
        ? storedRecurring
        : sections.flatMap((sec) => sec.recurringLineItems);

    const paymentMilestones = Array.isArray(q.paymentMilestones) ? q.paymentMilestones : [];
    const milestonesToUse = paymentMilestones.length
        ? paymentMilestones
        : [
              { label: 'Advance Payment', percentage: 50 },
              { label: 'Final Payment', percentage: 50 },
          ];

    function paragraphs(text: string, cls: string): string {
        return text
            .split(/\n+/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => `<p class="${cls}">${esc(p)}</p>`)
            .join('');
    }

    const clientLines = [clientSecondary, clientAddress, clientEmail, clientPhone].filter(Boolean);
    const companyLines = [companyAddress, companyEmail, companyPhone, companyWebsite].filter(Boolean);

    const metaItems: Array<[string, string]> = [
        ['Quotation', `#${quotationNo}`],
        ...(version > 1 ? ([['Revision', `Version ${version}`]] as Array<[string, string]>) : []),
        ['Issued', issueDate],
        ['Valid Until', validUntilStr],
    ];

    const overviewBody = overview || `${companyName} will design and deliver this engagement for ${clientPrimary}, covering everything from initial scoping through launch and handover.`;

    const coverSectionHtml = `
      <div class="paginate-group">
          <div class="paginate-block">
              <div class="cover-top">
                <img src="${esc(ctx.logoSrc)}" alt="${esc(companyName)}" class="cover-logo" />
                <div class="cover-meta">
                  ${metaItems.map(([label, value]) => `<div class="cover-meta-item"><span class="meta-label">${esc(label)}:</span> <span class="meta-value">${esc(value)}</span></div>`).join('')}
                </div>
              </div>
              <h1 class="cover-title">${esc(proposalTitle)}</h1>
              <div class="parties">
                <div class="party">
                  <div class="party-label">Prepared for</div>
                  <div class="party-name">${esc(clientPrimary)}</div>
                  ${clientLines.map((l) => `<div class="party-line">${esc(l)}</div>`).join('')}
                </div>
                <div class="party">
                  <div class="party-label">Prepared by</div>
                  <div class="party-name">${esc(companyName)}</div>
                  ${companyLines.map((l) => `<div class="party-line">${esc(l)}</div>`).join('')}
                </div>
              </div>
              <div class="cover-rule"></div>
              <div class="editorial">
                <div class="eyebrow">Project Overview</div>
                ${paragraphs(overviewBody, 'editorial-body')}
              </div>
          </div>
      </div>
    `;

    function formatPriceSafe(pText: string): string {
        if (!pText) return '';
        const pNum = Number(pText.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(pNum) && String(pNum) === pText.trim()) {
            return formatMoneyPdf(pNum, currency);
        }
        return pText;
    }

    function renderScopeChildren(nodes: ParsedFeatureNode[], depth: number): string {
        if (!nodes.length) return '';
        return nodes.map((n) => {
            const route = n.route ? `<div class="deliv-route">${esc(n.route)}</div>` : '';
            const priceStr = formatPriceSafe(n.priceStr || '');
            const price = priceStr ? `<div class="deliv-price">${esc(priceStr)}</div>` : '';
            return `<div class="paginate-block">
                <div class="deliv-row depth-${Math.min(depth, 3)}">
                    <div class="deliv-mark">•</div>
                    <div class="deliv-content">
                      <div class="deliv-name">${esc(n.name)}</div>
                      ${route}
                    </div>
                    ${price}
                </div>
            </div>${renderScopeChildren(n.children, depth + 1)}`;
        }).join('');
    }

    function amountCell(item: LineItemModel): string {
        const unitLine = item.quantity !== 1 ? `<div class="unit-note">${item.quantity} × ${formatMoneyPdf(item.unitPrice, currency)}</div>` : '';
        return `${formatMoneyPdf(item.lineTotal, currency)}${unitLine}`;
    }

    function techStackHtml(tech: TechStackModel): string {
        return `<div class="paginate-group">
            <div class="paginate-block">
                <div class="tech-block">
                    <div class="tech-title">Technology Stack</div>
                    ${tech.description ? `<p class="tech-desc">${esc(tech.description)}</p>` : ''}
                    <div class="tech-rows">
                        ${tech.rows.map(([layer, list]) => `
                            <div class="tech-row">
                                <span class="tech-layer">${esc(layer)}</span>
                                <span class="tech-items">${list.join(' · ')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>`;
    }

    const servicesHtml = sections.map((sec, i) => {
        // Every service after the first opens with extra leading space, so the
        // reader can see one service has ended and another has begun instead of
        // the two running together.
        const headerBlock = `
            <div class="paginate-block${i > 0 ? ' scope-group-spaced' : ''}" data-keep-with-next="true">
                <div class="scope-group-header">
                    <div class="scope-group-num">${String(i + 1).padStart(2, '0')}</div>
                    <div class="scope-group-name">${esc(sec.label.toUpperCase())}</div>
                    ${sec.scopeDescription ? paragraphs(sec.scopeDescription, 'scope-group-desc') : ''}
                </div>
                <div class="scope-rule"></div>
            </div>
        `;

        const modulesHtml = sec.modules.map((m, mIndex) => {
            const priceStr = formatPriceSafe(m.priceStr || '');
            const price = priceStr ? `<div class="deliv-price module-price">${esc(priceStr)}</div>` : '';
            
            // If it's the very first module, bundle it with the service header so they stay together
            const isFirst = mIndex === 0;
            const headerInjection = isFirst ? headerBlock : '';

            return `<div class="paginate-group module-group">
                ${headerInjection}
                <div class="paginate-block" data-keep-with-next="true">
                    <div class="module-header-wrap">
                        <div class="deliv-row depth-0">
                            <div class="deliv-content">
                              <div class="module-name">${esc(m.name)}</div>
                            </div>
                            ${price}
                        </div>
                    </div>
                </div>
                ${renderScopeChildren(m.children, 1)}
            </div>`;
        }).join('');

        // A service can legitimately carry no itemised scope — its detail then
        // lives in the description and the investment table. Emit just the
        // header in that case; a filler sentence adds nothing for the reader.
        const emptyState = sec.modules.length === 0 ? `<div class="paginate-group">${headerBlock}</div>` : '';

        let subPricingHtml = '';
        if (sec.lineItems.length > 0) {
            const liHtml = sec.lineItems.map(li => `
                <div class="service-line-item">
                    <div class="li-left">
                        <div class="li-title">${esc(li.title)}</div>
                        ${li.description ? `<div class="li-desc">${esc(li.description)}</div>` : ''}
                    </div>
                    <div class="li-right">
                        ${amountCell(li)}
                        ${li.billingCycle !== 'one-time' ? `<div class="li-cycle">${esc(li.cycleLabel)}</div>` : ''}
                    </div>
                </div>
            `).join('');
            
            subPricingHtml = `
                <div class="paginate-group">
                    <div class="paginate-block">
                        <div class="service-pricing">
                            ${liHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            ${emptyState}
            ${modulesHtml}
            ${subPricingHtml}
            ${sec.techStack ? techStackHtml(sec.techStack) : ''}
        `;
    }).join('');

    const workflowHtml = workflowSteps.length ? `
        <div class="paginate-group">
            <div class="paginate-block" data-keep-with-next="true">
                <h2 class="section-title">Project Workflow</h2>
            </div>
            ${workflowSteps.map((step, i) => `
                <div class="paginate-block${i === workflowSteps.length - 1 ? ' blk-section-end' : ''}">
                    <div class="workflow-row">
                        <span class="workflow-num">${String(i + 1).padStart(2, '0')}</span>
                        <span class="workflow-text">${esc(step)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    ` : '';

    const paymentStagesHtml = `
        <div class="paginate-group">
            <div class="paginate-block">
                <div class="section-container">
                    <h2 class="section-title">Payment Terms</h2>
                    <div class="payment-stages">
                        ${milestonesToUse.map((m: any, i: number) => {
                            const pct = Number(m.percentage) || 0;
                            const note = normalizeText(m.note || '');
                            return `<div class="payment-stage">
                                <div class="stage-num">${String(i + 1).padStart(2, '0')}</div>
                                <div class="stage-pct">${pct}%</div>
                                <div class="stage-label">${esc(normalizeText(m.label || 'Payment').toUpperCase())}</div>
                                <div class="stage-desc">${esc(note || milestonePhrase(i, milestonesToUse.length))}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    const investGroupBlocks = sections.map((sec) => {
        let itemsHtml = '';
        if (sec.basePrice > 0) {
            itemsHtml += `
                <div class="invest-item">
                    <span>Base Package</span>
                    <span>${formatMoneyPdf(sec.basePrice, currency)}</span>
                </div>
            `;
        }
        for (const li of sec.upfrontLineItems) {
            itemsHtml += `
                <div class="invest-item">
                    <span>${esc(li.title)}</span>
                    <span>${amountCell(li)}</span>
                </div>
            `;
        }
        return `
            <div class="paginate-block">
                <div class="invest-group">
                    <div class="invest-group-title">${esc(sec.label.toUpperCase())}</div>
                    ${itemsHtml}
                </div>
            </div>
        `;
    }).join('');

    const summaryRows: Array<[string, string, boolean?]> = [['Subtotal', formatMoneyPdf(subtotalVal, currency)]];
    if (discountVal > 0) summaryRows.push(['Discount', `− ${formatMoneyPdf(discountVal, currency)}`, true]);
    if (taxVal > 0) summaryRows.push(['Tax / VAT', formatMoneyPdf(taxVal, currency)]);

    const investSummaryHtml = `
        <div class="invest-summary">
            ${summaryRows.map(([label, value, neg]) => `
                <div class="invest-summary-row">
                    <span>${esc(label)}</span>
                    <span${neg ? ' class="neg"' : ''}>${esc(value)}</span>
                </div>
            `).join('')}
        </div>
    `;

    // Emitted as several sibling blocks rather than one indivisible unit so the
    // paginator can start the table on a page that has room for part of it,
    // instead of pushing the whole section over and leaving a large gap behind.
    const investmentHtml = `
        <div class="paginate-group">
            <div class="paginate-block" data-keep-with-next="true">
                <h2 class="section-title">Investment Summary</h2>
            </div>
            ${investGroupBlocks}
            <div class="paginate-block blk-section-end">
                <div class="invest-summary-rule"></div>
                ${investSummaryHtml}
                <div class="invest-summary-rule"></div>
                <div class="invest-total">
                    <div class="invest-total-label">Total Investment</div>
                    <div class="invest-total-figure">${formatMoneyPdf(grandTotalVal, currency)}</div>
                </div>
            </div>
        </div>
    `;

    const recurringTotalVal = recurringItems.reduce((acc, curr) => acc + (curr.lineTotal || 0), 0);
    const recurringHtml = recurringItems.length ? `
        <div class="paginate-group">
            <div class="paginate-block" data-keep-with-next="true">
                <h2 class="section-title">Recurring Charges</h2>
            </div>
            ${recurringItems.map((r, i) => `
                <div class="paginate-block">
                    <div class="recurring-item">
                        <div class="r-title">${esc(r.title)}</div>
                        <div class="r-amt">${amountCell(r)} / ${esc(r.cycleLabel.toLowerCase())}</div>
                    </div>
                </div>
            `).join('')}
            <div class="paginate-block blk-section-end">
                <div class="invest-summary-rule"></div>
                <div class="invest-total">
                    <div class="invest-total-label">Total Recurring</div>
                    <div class="invest-total-figure">${formatMoneyPdf(recurringTotalVal, currency)} / mo</div>
                </div>
            </div>
        </div>
    ` : '';

    function listBlock(title: string, items: string[]): string {
        if (!items.length) return '';
        return `
            <div class="paginate-group">
                <div class="paginate-block" data-keep-with-next="true">
                    <div class="list-block-title">${esc(title)}</div>
                </div>
                ${items.map((item, i) => `
                    <div class="paginate-block${i === items.length - 1 ? ' blk-section-end' : ''}">
                        <div class="list-row"><span class="list-mark">•</span><span>${esc(item)}</span></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    const detailsHtml = (includedSupportItems.length || notIncludedItems.length || clientRequirements.length || keyTermsItems.length || termsItems.length) ? `
        ${listBlock('Included Support', includedSupportItems)}
        ${listBlock('Not Included in Price', notIncludedItems)}
        ${listBlock('Client Needs to Provide', clientRequirements)}
        ${listBlock('Key Terms', keyTermsItems)}
        ${termsItems.length ? `
            <div class="paginate-group">
                <div class="paginate-block" data-keep-with-next="true">
                    <div class="list-block-title">Terms &amp; Conditions</div>
                </div>
                ${termsItems.map((t: any, i: number) => `
                    <div class="paginate-block${i === termsItems.length - 1 ? ' blk-section-end' : ''}">
                        <div class="terms-row">
                            <div class="terms-title">${esc(t.title)}</div>
                            <div class="terms-desc">${esc(t.body)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    ` : '';

    const advancePct = milestonesToUse[0]?.percentage ? `${milestonesToUse[0].percentage}%` : 'agreed';
    const nextStepsHtml = `
        <div class="paginate-group">
            <div class="paginate-block">
                <div class="section-container next-steps-container">
                    <h2 class="section-title">Next Steps</h2>
                    <div class="next-steps-list">
                        <div>Confirm quotation</div>
                        <div>Complete ${esc(advancePct)} initial payment</div>
                        <div>Project begins</div>
                    </div>
                    <div class="authorized">
                        <div class="authorized-label">Authorized by</div>
                        ${
                            ctx.signatureSrc
                                ? `<img class="authorized-sig" src="${esc(ctx.signatureSrc)}" alt="" />`
                                : `<div class="authorized-sig-spacer"></div>`
                        }
                        <div class="authorized-line"></div>
                        <div class="authorized-name">${esc(SIGNATORY_NAME)}</div>
                        <div class="authorized-role">${esc(SIGNATORY_ROLE)}, ${esc(companyName)}</div>
                    </div>
                    <div class="closing">
                        <div class="closing-name">${esc(companyName)}</div>
                        <div class="closing-contact">${esc(companyWebsite)} · ${esc(companyEmail)} · ${esc(companyPhone)}</div>
                        <div class="closing-address">${esc(companyAddress)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quotation #${esc(quotationNo)} — ${esc(proposalTitle)}</title>
  <style>
    ${ctx.fontCss}

    :root {
      --ink: #111118;
      --ink-secondary: #5F6070;
      --muted: #8D8E9A;
      --surface: #F7F7FA;
      --border: #E5E7EB;
      --white: #FFFFFF;
      --brand: #4E12D4;
      --brand-soft: #F5F1FF;
      --brand-ink: #160735;
      --brand-line: rgba(78, 18, 212, 0.18);

      --font-sans: 'Inter', system-ui, -apple-system, 'Hind Siliguri', sans-serif;
      --font-mono: 'Geist Mono', ui-monospace, 'JetBrains Mono', monospace;
    }

    /* Print margins are disabled in browser, we use deterministic A4 containers */
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body { background: var(--surface); }
    body {
      font-family: var(--font-sans);
      color: var(--ink-secondary);
      font-size: 10pt;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-font-smoothing: antialiased;
      font-variant-numeric: tabular-nums;
    }

    strong { font-weight: 600; color: var(--ink); }
    em { font-style: normal; }

    /* Deterministic Pagination Styles */
    #source-content { display: none; }
    
    .pdf-page {
        width: 210mm;
        height: 297mm;
        box-sizing: border-box;
        padding: 16mm 16mm 22mm 16mm;
        position: relative;
        page-break-after: always;
        break-after: page;
        background: var(--white);
        overflow: hidden;
    }
    
    .page-content {
        /* Height will naturally flow, limited by JS */
        display: flex;
        flex-direction: column;
        position: relative;
        z-index: 1;
    }

    /* Brand mark behind the content of every page. Kept very faint and
       centred so it reads as stationery rather than an overlay. */
    .page-watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 95mm;
        opacity: 0.035;
        z-index: 0;
        pointer-events: none;
    }
    .page-watermark img { width: 100%; height: auto; display: block; }
    
    .page-footer {
        position: absolute;
        left: 16mm;
        right: 16mm;
        bottom: 8mm; /* safely in 22mm margin */
        display: flex;
        justify-content: space-between;
        font-size: 7pt;
        letter-spacing: 0.04em;
        color: var(--muted);
        border-top: 0.5px solid var(--brand-line);
        padding-top: 3mm;
    }
    /* The running footer carries the project title, which can be long; keep it
       to a single line rather than letting it push into the page content. */
    .page-footer > span {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    /* Original Component Styles (unmodified) */
    .cover-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; margin-bottom: 12mm; }
    .cover-logo { height: 12mm; width: auto; object-fit: contain; display: block; flex-shrink: 0; }
        .cover-title { font-size: 34pt; font-weight: 800; letter-spacing: -0.025em; line-height: 1.1; color: var(--ink); max-width: 165mm; margin-bottom: 9mm; }
    .parties { display: flex; gap: 14mm; margin-bottom: 8mm; }
    .party { flex: 1; }
    .party-label { font-size: 8.5pt; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 1.8mm; }
    .party-name { font-size: 12pt; font-weight: 600; color: var(--ink); margin-bottom: 1.2mm; }
    .party-line { font-size: 10pt; color: var(--ink-secondary); line-height: 1.5; }
    /* Sits beside the logo in the cover header, so the identifying facts of the
       quotation read as a masthead rather than a separate block further down. */
    /* One fact per line, label and value inline, so the masthead reads as a
       short list rather than three stacked columns. */
    .cover-meta { display: flex; flex-direction: column; gap: 1.6mm; text-align: right; padding-top: 1mm; }
    .cover-meta-item { white-space: nowrap; font-size: 9.5pt; }
    .meta-label { font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    .meta-value { font-weight: 600; color: var(--ink); }
    .cover-rule { height: 1.5pt; width: 40mm; background: var(--brand); margin-bottom: 12mm; }

    .editorial { margin-bottom: 16mm; max-width: 160mm; }
    .eyebrow { font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--brand); margin-bottom: 2mm; }
    .editorial-title { font-size: 18pt; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 4mm; }
    .editorial-body { font-size: 10.5pt; color: var(--ink-secondary); line-height: 1.6; }
    .editorial-body + .editorial-body { margin-top: 3mm; }

    .scope-group-header { margin-bottom: 6mm; margin-top: 8mm; }
    .scope-group-header:first-child { margin-top: 0; }
    .scope-group-num { font-size: 28pt; font-weight: 300; color: var(--brand); line-height: 1; margin-bottom: 2mm; }
    .scope-group-name { font-size: 26pt; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); line-height: 1.1; margin-bottom: 3mm; }
    .scope-group-desc { font-size: 11pt; color: var(--ink-secondary); max-width: 152mm; }
    .scope-rule { height: 1pt; background: var(--brand-line); width: 100%; margin-bottom: 6mm; }

    .module-header-wrap { margin-bottom: 3mm; margin-top: 2mm; }
    .deliv-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 2mm; }
    .deliv-row.depth-0 { margin-bottom: 0; align-items: baseline; }
    .module-name { font-size: 12.5pt; font-weight: 700; color: var(--ink); }
    .module-price { font-size: 10.5pt; font-weight: 600; color: var(--brand); }
    .deliv-row.depth-1 { margin-left: 2mm; }
    .deliv-row.depth-2 { margin-left: 6mm; }
    .deliv-row.depth-3 { margin-left: 10mm; }
    .deliv-mark { color: var(--brand); font-size: 12pt; line-height: 1.3; flex: 0 0 10px; margin-top: -1px; }
    .deliv-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5mm; }
    .deliv-name { font-size: 10.5pt; font-weight: 500; color: var(--ink); }
    .deliv-route { font-family: var(--font-mono); font-size: 8pt; color: var(--muted); word-break: break-all; margin-top: 1px; }
    .deliv-price { flex: 0 0 auto; white-space: nowrap; text-align: right; font-size: 10pt; font-weight: 500; color: var(--ink); }

    /* The service's own line items continue straight on from its deliverables —
       no divider or heading, so they read as part of the same service block. */
    .service-pricing { margin-bottom: 4mm; }
    .service-line-item { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2mm; font-size: 10pt; }
    .li-left { flex: 1; padding-right: 4mm; }
    .li-title { color: var(--ink); font-weight: 500; }
    .li-desc { font-size: 9pt; color: var(--muted); margin-top: 0.5mm; }
    .li-right { text-align: right; color: var(--ink); }
    .li-cycle { font-size: 8pt; color: var(--muted); margin-top: 0.5mm; }

    .tech-block { margin-top: 6mm; margin-bottom: 8mm; }
    .tech-title { font-size: 10pt; font-weight: 600; color: var(--ink); margin-bottom: 2mm; text-transform: uppercase; letter-spacing: 0.05em; }
    .tech-desc { font-size: 9.5pt; color: var(--ink-secondary); margin-bottom: 2mm; }
    .tech-rows { display: flex; flex-direction: column; gap: 1mm; }
    .tech-row { display: flex; font-size: 9.5pt; }
    .tech-layer { font-weight: 600; color: var(--ink); width: 25mm; flex-shrink: 0; }
    .tech-items { color: var(--ink-secondary); }

    .section-container { margin-bottom: 12mm; }
    /* Sections are emitted as several sibling blocks so the paginator can split
       them; this replaces the wrapper's bottom margin on the closing block. */
    .blk-section-end { margin-bottom: 12mm; }
    /* Leading space that separates one service block from the previous one.
       Collapsed when the header happens to land at the top of a fresh page,
       where the page margin already provides the separation. */
    .scope-group-spaced { margin-top: 14mm; }
    .page-content > .scope-group-spaced:first-child { margin-top: 0; }
    /* Same idea for the major section headings, so a section never butts up
       against the tail of whatever preceded it. */
    .paginate-block > .section-title { margin-top: 12mm; }
    .page-content > .paginate-block:first-child > .section-title { margin-top: 0; }
    .section-title { font-size: 18pt; font-weight: 700; color: var(--ink); margin-bottom: 5mm; letter-spacing: -0.01em; border-bottom: 1.5pt solid var(--brand); padding-bottom: 2mm; }

    .workflow { display: flex; flex-direction: column; gap: 2.5mm; }
    .workflow-row { display: flex; gap: 4mm; align-items: baseline; font-size: 11pt; }
    .workflow-num { font-size: 10pt; font-weight: 600; color: var(--brand); width: 8mm; }
    .workflow-text { color: var(--ink); font-weight: 500; }

    .payment-stages { display: flex; gap: 6mm; }
    .payment-stage { flex: 1; border-left: 2pt solid var(--brand); padding-left: 4mm; }
    .stage-num { font-size: 9pt; font-weight: 600; color: var(--muted); margin-bottom: 1mm; }
    .stage-pct { font-size: 28pt; font-weight: 800; color: var(--brand); line-height: 1; letter-spacing: -0.02em; }
    .stage-label { font-size: 10pt; font-weight: 600; color: var(--ink); margin: 2mm 0 1mm; text-transform: uppercase; letter-spacing: 0.05em; }
    .stage-desc { font-size: 9.5pt; color: var(--ink-secondary); line-height: 1.4; }

    .invest-list { margin-bottom: 6mm; }
    .invest-group { margin-bottom: 5mm; }
    .invest-group-title { font-size: 11pt; font-weight: 700; color: var(--ink); margin-bottom: 2mm; text-transform: uppercase; letter-spacing: 0.02em; }
    .invest-item { display: flex; justify-content: space-between; font-size: 10.5pt; color: var(--ink-secondary); margin-bottom: 1.5mm; }
    .invest-item span:last-child { color: var(--ink); font-variant-numeric: tabular-nums; }
    .invest-summary-rule { height: 1pt; background: var(--border); margin: 3mm 0; }
    .invest-summary { display: flex; flex-direction: column; gap: 1.5mm; padding: 2mm 0; }
    .invest-summary-row { display: flex; justify-content: space-between; font-size: 11pt; color: var(--ink-secondary); }
    .invest-summary-row span:last-child { color: var(--ink); font-weight: 500; font-variant-numeric: tabular-nums; }
    .invest-summary-row .neg { color: var(--brand) !important; }
    .invest-total { background: var(--brand-soft); padding: 5mm 6mm; display: flex; justify-content: space-between; align-items: baseline; border-radius: 4px; margin-top: 4mm; }
    .invest-total-label { font-size: 11pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--brand); }
    .invest-total-figure { font-size: 22pt; font-weight: 800; color: var(--brand-ink); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }

    .recurring-list { display: flex; flex-direction: column; gap: 2mm; }
    .recurring-item { display: flex; justify-content: space-between; font-size: 10.5pt; border-bottom: 1pt dashed var(--border); padding-bottom: 2mm; }
    .r-title { color: var(--ink); font-weight: 500; }
    .r-amt { color: var(--ink); font-variant-numeric: tabular-nums; }

    .list-block { margin-bottom: 8mm; }
    .list-block-title { font-size: 11pt; font-weight: 600; color: var(--ink); margin-bottom: 3mm; text-transform: uppercase; letter-spacing: 0.05em; }
    .list-row { display: flex; gap: 2.5mm; font-size: 10pt; color: var(--ink-secondary); margin-bottom: 1.5mm; align-items: baseline; }
    .list-mark { color: var(--brand); font-size: 12pt; line-height: 1; }
    
    .terms-block { margin-top: 6mm; }
    .terms-row { margin-bottom: 3mm; }
    .terms-title { font-size: 10.5pt; font-weight: 600; color: var(--ink); margin-bottom: 1mm; }
    .terms-desc { font-size: 10pt; color: var(--ink-secondary); }

    .next-steps-container { margin-top: 4mm; }
    .next-steps-list { display: flex; flex-direction: column; gap: 2mm; margin-bottom: 8mm; }
    .next-steps-list div { font-size: 11pt; font-weight: 500; color: var(--ink); display: flex; gap: 3mm; align-items: baseline; }
    .next-steps-list div::before { content: "→"; color: var(--brand); font-weight: bold; }
    
    /* Authorising signature — the document is machine-generated, so this
       identifies who at the company stands behind the quoted figures. */
    .authorized { margin-top: 12mm; }
    .authorized-label { font-size: 8.5pt; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 3mm; }
    .authorized-sig { display: block; height: 14mm; width: auto; max-width: 60mm; object-fit: contain; object-position: left bottom; margin-bottom: 1.5mm; }
    .authorized-sig-spacer { height: 14mm; }
    .authorized-line { border-bottom: 1pt solid var(--ink); width: 60mm; margin-bottom: 2.5mm; }
    .authorized-name { font-size: 11pt; font-weight: 700; color: var(--ink); }
    .authorized-role { font-size: 9pt; color: var(--ink-secondary); margin-top: 0.5mm; }

    .closing { border-top: 1.5pt solid var(--brand); padding-top: 6mm; margin-top: 12mm; }
    .closing-name { font-size: 12pt; font-weight: 700; color: var(--brand); margin-bottom: 2mm; }
    .closing-contact { font-size: 10pt; color: var(--ink-secondary); margin-bottom: 1mm; }
    .closing-address { font-size: 9pt; color: var(--muted); }

  </style>
</head>
<body>
  <!-- The source content is strictly separated into logical blocks -->
  <div id="source-content">
    ${coverSectionHtml}
    ${servicesHtml}
    ${workflowHtml}
    ${investmentHtml}
    ${recurringHtml}
    ${paymentStagesHtml}
    ${detailsHtml}
    ${nextStepsHtml}
  </div>

  <script>
    // Embedded pagination data
    window.WATERMARK_SRC = ${JSON.stringify(ctx.markSrc || '')};
    // Everything in the running footer except the page number, which the
    // paginator appends once it knows which page it is building.
    window.FOOTER_PREFIX = ${JSON.stringify(`${companyName} | ${proposalTitle} | Confidential`)};
    window.__name = (fn, name) => Object.defineProperty(fn, 'name', { value: name, configurable: true });
  </script>
</body>
</html>`;
}

export function assertRenderable(q: Record<string, any>): void {
    const problems: string[] = [];
    const client = q.client || {};
    const details = q.details || {};

    const email = String(client.email || '').trim();
    const contact = String(client.contactName || '').trim();
    const company = String(client.companyName || '').trim();
    const number = String(q.quotationNumber || '').trim();
    const title = String(details.title || '').trim();

    if (!number) problems.push('quotation number is empty');
    if (!contact && !company) problems.push('client name is empty');
    if (!email) problems.push('client email is empty');
    if (!title) problems.push('project title is empty');

    for (const [field, value] of Object.entries({ email, contact, company, title })) {
        if (field === 'email') continue;
        if (value && PLACEHOLDER_BLOCK_RE.test(value)) {
            problems.push(`${field} still contains placeholder text ("${value}")`);
        }
    }

    if (details.date && details.validUntil) {
        const issued = new Date(details.date).getTime();
        const valid = new Date(details.validUntil).getTime();
        if (Number.isFinite(issued) && Number.isFinite(valid) && valid <= issued) {
            problems.push('"valid until" date is not after the issue date');
        }
    }

    if (problems.length > 0) {
        throw new AppError(
            `Quotation is not ready to export — please fix: ${problems.join('; ')}.`,
            422,
        );
    }
}

let browserSingleton: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowserInstance() {
    if (!browserSingleton || !browserSingleton.connected) {
        browserSingleton = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
            ],
        });
    }
    return browserSingleton;
}

/**
 * Renders a quotation object to PDF bytes. Kept separate from `generatePdf` so
 * the exact production render path (asset loading → HTML → in-browser
 * pagination → print) can be exercised against a fixture without a database.
 */
export async function renderQuotationPdfBuffer(q: Record<string, any>): Promise<Buffer> {
        const companyLogoRemote = ((q as any).company?.logo as string) || DEFAULT_LOGO;

        let logoSrc = null;
        if (companyLogoRemote !== DEFAULT_LOGO) {
            logoSrc = await fetchImageAsDataUrl(companyLogoRemote);
        }
        if (!logoSrc) {
            logoSrc = LOCAL_LOGO_BASE64 || (await fetchImageAsDataUrl(DEFAULT_LOGO)) || FALLBACK_PIXEL_PNG;
        }

        const fontCss = await buildEmbeddedFontCss();

        const browser = await getBrowserInstance();
        const markSrc = await extractBrandMark(browser, logoSrc).catch(() => null);

        const signatureUrl = process.env.COMPANY_SIGNATURE_URL || DEFAULT_SIGNATURE;
        const signatureSrc = (await fetchImageAsDataUrl(signatureUrl)) || '';

        const html = buildPrintHtml(q as Record<string, any>, { logoSrc, markSrc, fontCss, signatureSrc });
        const qn = String((q as any).quotationNumber || '').trim();

        const page = await browser.newPage();
        page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', (err: any) => console.log('PAGE ERROR:', err.toString()));
        try {
            await page.setContent(html, { waitUntil: 'load' });
            await page.evaluateHandle('document.fonts.ready');
            
            // Execute deterministic pagination inside the browser. This function
            // body runs in the browser's DOM context, not Node — the project's
            // tsconfig has no "dom" lib (it's a server package), so `window` and
            // `document` are shadowed here as local `any`-typed bindings rather
            // than left as unresolvable globals.
            await page.evaluate(() => {
                const window: any = (globalThis as any).window;
                const document: any = (globalThis as any).document;

                // Every page carries the brand mark behind its content; built
                // here rather than in the static HTML because the page shells
                // themselves are created by this script.
                const watermarkSrc = window.WATERMARK_SRC || '';
                const watermarkMarkup = watermarkSrc
                    ? '<div class="page-watermark"><img src="' + watermarkSrc + '" alt="" /></div>'
                    : '';
                const footerPrefix = window.FOOTER_PREFIX || '';

                // Dynamically measure the exact safe height available
                const measurer = document.createElement('div');
                measurer.style.width = '210mm';
                measurer.style.height = '297mm';
                measurer.style.padding = '16mm 16mm 22mm 16mm';
                measurer.style.boxSizing = 'border-box';
                measurer.style.position = 'absolute';
                measurer.style.visibility = 'hidden';
                const contentBox = document.createElement('div');
                contentBox.style.height = '100%';
                measurer.appendChild(contentBox);
                document.body.appendChild(measurer);
                
                // Real pixel value calculated by browser
                const maxSafeHeight = contentBox.clientHeight;
                document.body.removeChild(measurer);

                let pageNum = 1;
                let currentContainer = createPage(pageNum);

                const source = document.getElementById('source-content');
                const groups: any[] = Array.from(source.children);

                for (const group of groups) {
                    if (!group.classList.contains('paginate-group')) continue;
                    const blocks: any[] = Array.from(group.children);
                    
                    // Try the group whole first — that keeps small, indivisible
                    // units (a payment grid, a short list) intact. When it does
                    // not fit we fall straight through to block-by-block
                    // placement rather than relocating the entire group to a
                    // fresh page: moving it wholesale is what used to strand a
                    // large blank area at the foot of the previous page.
                    const fits = tryAppendGroup(blocks);

                    if (!fits) {
                        for (let i = 0; i < blocks.length; i++) {
                            let block = blocks[i];
                            let keepGroup = [block];
                            let j = i;
                            
                            // Group blocks with data-keep-with-next
                            while (blocks[j].getAttribute('data-keep-with-next') === 'true' && j + 1 < blocks.length) {
                                j++;
                                keepGroup.push(blocks[j]);
                            }
                            
                            let bFits = tryAppendGroup(keepGroup);
                            
                            if (!bFits) {
                                if (currentContainer.children.length > 0) {
                                    pageNum++;
                                    currentContainer = createPage(pageNum);
                                    bFits = tryAppendGroup(keepGroup);
                                }
                                
                                // If the keep-group STILL fails on a blank page, force append individually
                                if (!bFits) {
                                    for (let k = i; k <= j; k++) {
                                        if (!tryAppendGroup([blocks[k]])) {
                                            if (currentContainer.children.length > 0) {
                                                pageNum++;
                                                currentContainer = createPage(pageNum);
                                            }
                                            tryAppendGroup([blocks[k]], true);
                                        }
                                    }
                                }
                            }
                            i = j;
                        }
                    }
                }

                // Cleanup
                source.remove();

                function createPage(num: number) {
                    const page = document.createElement('div');
                    page.className = 'pdf-page';

                    page.innerHTML = `
                        ${watermarkMarkup}
                        <div class="page-content"></div>
                        <div class="page-footer">
                            <span>${footerPrefix} | Page ${num}</span>
                        </div>
                    `;
                    document.body.appendChild(page);
                    return page.querySelector('.page-content');
                }

                function tryAppendGroup(elements: any[], force = false) {
                    const clones = elements.map((el: any) => el.cloneNode(true));
                    clones.forEach((c: any) => currentContainer.appendChild(c));

                    // Allow 1px tolerance for rounding issues
                    if (force || currentContainer.offsetHeight <= maxSafeHeight + 1) {
                        return true;
                    }

                    clones.forEach((c: any) => currentContainer.removeChild(c));
                    return false;
                }
            });

            await page.emulateMediaType('print');

            // Generate the exact 210x297 DOM nodes as an A4 PDF without any native margins
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true, // Takes the actual A4 DOM sizes
                displayHeaderFooter: false, // We built the footer into the DOM natively
                margin: { top: 0, bottom: 0, left: 0, right: 0 },
            });

            return Buffer.from(pdf);
        } catch (e: unknown) {
            const err = e as { message?: string };
            logger.error({ err: e, quotationNumber: qn }, 'quotation.puppeteer_pdf_failed');
            throw new AppError(err?.message || 'Failed to generate PDF with Puppeteer', 500);
        } finally {
            await page.close().catch(() => {});
        }
}

export class QuotationPuppeteerPdfService {
    static async generatePdf(
        quotationId: string,
    ): Promise<{ buffer: Buffer; filename: string }> {
        const q = await QuotationModel.findById(quotationId)
            .populate('clientId', 'name clientId emails')
            .lean();
        if (!q) throw new AppError('Quotation not found', 404);

        assertRenderable(q as Record<string, any>);

        const buffer = await renderQuotationPdfBuffer(q as Record<string, any>);

        const qn = String((q as any).quotationNumber || '').trim();
        const title = String((q as any).details?.title || '').trim();
        const stem = qn ? (qn.startsWith('#') ? qn : `#${qn}`) : title || 'quotation';
        const filename = `${stem}.pdf`.replace(/[/\\?%*:|"<>]/g, '-');

        return { buffer, filename };
    }
}
