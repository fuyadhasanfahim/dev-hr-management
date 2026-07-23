import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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
 * WebBriks Quotation PDF — "Scope Ledger" edition.
 *
 * Rebuilt per the redesign brief: an engineering scope-of-work document rather
 * than a marketing brochure. Page architecture: full-bleed cover → contents +
 * scope-at-a-glance → executive summary → section dividers → two-column module
 * pages → a dedicated pricing page → a two-column terms page with the
 * authorization block at its foot. A running ledger rail counts deliverables.
 *
 * Typography is self-contained: the three-face system (Bricolage Grotesque /
 * Inter / Geist Mono, plus Hind Siliguri for Bangla) is fetched once, filtered
 * to the latin + bengali subsets, and embedded as base64 @font-face rules so a
 * cold Puppeteer container never falls back to a system font mid-render.
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
        .replace(/ /g, ' ')
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

// Read the local logo as a fallback base64 string
let LOCAL_LOGO_BASE64 = '';
try {
    const localLogoPath = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(localLogoPath)) {
        const fileBuf = fs.readFileSync(localLogoPath);
        LOCAL_LOGO_BASE64 = `data:image/png;base64,${fileBuf.toString('base64')}`;
    }
} catch (e) {
    logger.error({ err: e }, 'Failed to load local logo.png');
}

const DEFAULT_SIGNATURE =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png';

const FALLBACK_PIXEL_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
// subsets are embedded to keep the payload lean.
const FONT_FAMILIES: Array<{ spec: string; subsets: string[] }> = [
    { spec: 'Inter:wght@400;500;600;700', subsets: ['latin'] },
    { spec: 'Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700', subsets: ['latin'] },
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
    const nodes: ParsedFeatureNode[] = [];

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

/* ── Section model ────────────────────────────────────────────────────────── */

interface SectionModel {
    category: string;
    label: string;
    kicker: string;
    scopeDescription: string;
    modules: ParsedFeatureNode[];
    deliverableCount: number;
    techStack?: any;
    basePrice: number;
    lineItems: any[];
    recurringMonthly: number;
    isMarketing: boolean;
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
            // Drop modules that ended up empty AND carry no price of their own.
            const modules = tree.filter(
                (m) => m.children.length > 0 || (m.price && m.price > 0),
            );
            const deliverableCount = modules.reduce((sum, m) => sum + countDescendants(m), 0);

            const lineItems: any[] = Array.isArray(service?.lineItems) ? service.lineItems : [];
            let recurringMonthly = 0;
            for (const item of lineItems) {
                const qty = item.quantity ?? 1;
                const lineTotal = (Number(item.price) || 0) * qty;
                if (!isUpfrontBillingCycle(item.billingCycle || 'one-time') && item.billingCycle === 'monthly') {
                    recurringMonthly += lineTotal;
                }
            }

            const rawDesc = normalizeText(service?.scopeDescription || '');
            const isLorem = rawDesc.toLowerCase().includes('lorem ipsum');

            return {
                category,
                label: CATEGORY_LABELS[category] || category || 'Service',
                kicker: CATEGORY_KICKERS[category] || 'Service Scope',
                scopeDescription: isLorem ? '' : rawDesc,
                modules,
                deliverableCount,
                techStack: service?.techStack,
                basePrice: Number(service?.basePrice) || 0,
                lineItems,
                recurringMonthly,
                isMarketing: category === 'marketing',
            } as SectionModel;
        })
        .filter((s) => s.modules.length > 0 || s.basePrice > 0);
}

/* ── Render helpers ───────────────────────────────────────────────────────── */

function renderDeliverable(node: ParsedFeatureNode, currency: string): string {
    const price =
        node.price && node.price > 0
            ? `<span class="deliv-price">${formatMoneyPdf(node.price, currency)}</span>`
            : '';
    const route = node.route ? `<span class="deliv-route">${esc(node.route)}</span>` : '';
    const nested =
        node.children && node.children.length > 0
            ? `<div class="deliv-sub">${node.children
                  .map(
                      (c) =>
                          `<div class="deliv-sub-item"><span class="deliv-sub-mark"></span><span>${esc(
                              c.name,
                          )}</span></div>`,
                  )
                  .join('')}</div>`
            : '';

    return `<div class="deliv">
      <span class="deliv-mark"></span>
      <span class="deliv-body">
        <span class="deliv-name">${esc(node.name)}${price}</span>
        ${route}
        ${nested}
      </span>
    </div>`;
}

function renderModule(module: ParsedFeatureNode, index: number, currency: string): string {
    const idx = String(index).padStart(2, '0');
    const count = countDescendants(module);
    const priceTag =
        module.price && module.price > 0
            ? `<span class="module-price">${formatMoneyPdf(module.price, currency)}</span>`
            : '';
    const countTag = count > 0 ? `<span class="module-count">${count}</span>` : '';

    const deliverables = module.children.map((c) => renderDeliverable(c, currency)).join('');

    return `<div class="module">
      <div class="module-head">
        <span class="module-idx">${idx}</span>
        <h3 class="module-name">${esc(module.name)}</h3>
        <span class="module-meta">${priceTag}${countTag}</span>
      </div>
      ${deliverables ? `<div class="deliverables">${deliverables}</div>` : ''}
    </div>`;
}

function renderTechStack(tech: any): string {
    if (!tech) return '';
    const rows: Array<[string, string[]]> = (
        [
            ['Frontend', tech.frontend],
            ['Backend', tech.backend],
            ['Database', tech.database],
            ['Tools', tech.tools],
        ] as Array<[string, unknown]>
    ).filter(([, l]) => Array.isArray(l) && (l as string[]).length > 0) as Array<[string, string[]]>;
    if (rows.length === 0) return '';

    const body = rows
        .map(
            ([layer, list]) => `<div class="tech-row">
        <div class="tech-layer">${esc(layer)}</div>
        <div class="tech-chips">${list.map((t) => `<span class="tech-chip">${esc(t)}</span>`).join('')}</div>
      </div>`,
        )
        .join('');

    return `<div class="tech-block">
      <div class="block-eyebrow">Technology Stack</div>
      ${body}
    </div>`;
}

export function buildPrintHtml(
    q: Record<string, any>,
    ctx: { logoSrc: string; signatureSrc: string; fontCss: string },
): string {
    const client = q.client || {};
    const details = q.details || {};
    const totals = q.totals || {};
    const currency = q.currency || 'BDT';

    const quotationNo =
        String(q.quotationNumber || 'DRAFT-001').replace(/^#/, '').trim() || 'DRAFT-001';
    const issueDate = details?.date
        ? format(new Date(details.date), 'MMMM dd, yyyy')
        : format(new Date(), 'MMMM dd, yyyy');
    const validUntilStr = details?.validUntil
        ? format(new Date(details.validUntil), 'MMMM dd, yyyy')
        : '—';

    const companyName = normalizeText(q.company?.name || 'WebBriks');
    const companyWebsite = normalizeText(q.company?.website || '');

    const clientContact = normalizeText(client.contactName || '');
    const clientCompany = normalizeText(client.companyName || '');
    // Dedupe: only show the contact line when it differs from the company name.
    const clientPrimary = clientCompany || clientContact || 'Valued Client';
    const clientSecondary =
        clientContact && clientContact.toLowerCase() !== clientPrimary.toLowerCase()
            ? clientContact
            : '';

    const proposalTitle = normalizeText(details?.title || 'Digital Agency Proposal');
    const rawOverview = normalizeText(q.overview || details?.overview || '');
    const overview =
        rawOverview && !rawOverview.toLowerCase().includes('lorem ipsum') ? rawOverview : '';

    const sections = buildSections(Array.isArray(q.services) ? q.services : []);

    const totalModules = sections.reduce((s, sec) => s + sec.modules.length, 0);
    const totalDeliverables = sections.reduce((s, sec) => s + sec.deliverableCount, 0);
    const totalSections = sections.length;
    const recurringMonthly = sections.reduce((s, sec) => s + sec.recurringMonthly, 0);

    const grandTotalVal = Number(
        totals.grandTotal || sections.reduce((s, sec) => s + sec.basePrice, 0),
    );
    const subtotalVal = Number(
        totals.subtotal || sections.reduce((s, sec) => s + sec.basePrice, 0),
    );
    const discountVal = Number(totals.discountAmount || 0);
    const taxVal = Number(totals.taxAmount || 0);
    const perDeliverable =
        totalDeliverables > 0 && grandTotalVal > 0 ? grandTotalVal / totalDeliverables : 0;

    const notIncludedItems = (Array.isArray(q.notIncluded) ? q.notIncluded : [])
        .map((s: any) => normalizeText(s))
        .filter((s: string) => s && !isPlaceholderRow(s));
    const clientRequirements = (Array.isArray(q.clientRequirements) ? q.clientRequirements : [])
        .map((s: any) => normalizeText(s))
        .filter((s: string) => s && !isPlaceholderRow(s));

    const notIncludedFinal = notIncludedItems.length
        ? notIncludedItems
        : [
              'Domain registration & premium hosting (billed separately)',
              'Third-party paid API licences, plugins, or premium fonts',
              'Paid advertising budget for Meta, Google, or LinkedIn',
              'Raw unedited footage or source design files',
          ];
    const clientReqFinal = clientRequirements.length
        ? clientRequirements
        : [
              'Brand logo, colour palette & typography guidelines',
              'Admin access / credentials for hosting, domain, or CMS',
              'Final approved copy, content & product photography',
              'A dedicated point of contact for feedback and approvals',
          ];

    const paymentMilestones = Array.isArray(q.paymentMilestones) ? q.paymentMilestones : [];
    const milestonesToUse = paymentMilestones.length
        ? paymentMilestones
        : [
              { label: 'Upfront deposit — project kickoff', percentage: 50 },
              { label: 'Final delivery & handover', percentage: 50 },
          ];

    /* ── Page: cover ─────────────────────────────────────────────────────── */
    const metaStrip = `
      <div class="cover-meta">
        <div class="cover-meta-cell">
          <div class="cover-meta-k">Prepared For</div>
          <div class="cover-meta-v">${esc(clientPrimary)}</div>
          ${clientSecondary ? `<div class="cover-meta-sub">Attn: ${esc(clientSecondary)}</div>` : ''}
        </div>
        <div class="cover-meta-cell">
          <div class="cover-meta-k">Issue Date</div>
          <div class="cover-meta-v">${esc(issueDate)}</div>
        </div>
        <div class="cover-meta-cell">
          <div class="cover-meta-k">Valid Until</div>
          <div class="cover-meta-v">${esc(validUntilStr)}</div>
        </div>
      </div>`;

    const coverHtml = `
      <section class="cover">
        <div class="cover-top">
          <img src="${esc(ctx.logoSrc)}" alt="${esc(companyName)}" class="cover-logo" />
          <div class="cover-eyebrow">Official Quotation</div>
        </div>
        <div class="cover-number">#${esc(quotationNo)}</div>
        <div class="cover-mid">
          <div class="cover-kicker">Scope of Work &amp; Investment</div>
          <h1 class="cover-title">${esc(proposalTitle)}</h1>
          <div class="cover-rule"></div>
          ${metaStrip}
        </div>
        <div class="cover-foot">
          <span>${esc(companyName)}</span>
          ${companyWebsite ? `<span>${esc(companyWebsite)}</span>` : ''}
        </div>
      </section>`;

    /* ── Page: contents + scope at a glance ──────────────────────────────── */
    const contentsRows = [
        { name: 'Executive Summary', meta: `${totalSections} section${totalSections === 1 ? '' : 's'}` },
        ...sections.map((sec, i) => ({
            name: `Section ${String(i + 1).padStart(2, '0')} · ${sec.label}`,
            meta: `${sec.deliverableCount} deliverables`,
        })),
        { name: 'Investment', meta: formatMoneyPdf(grandTotalVal, currency) },
        { name: 'Terms & Authorization', meta: `${milestonesToUse.length} milestones` },
    ]
        .map(
            (r) =>
                `<div class="toc-row"><span class="toc-name">${esc(r.name)}</span><span class="toc-dot"></span><span class="toc-meta">${esc(
                    r.meta,
                )}</span></div>`,
        )
        .join('');

    const scopeGlanceGroups = sections
        .map((sec, si) => {
            const rows = sec.modules
                .map((m, mi) => {
                    const idx = String(mi + 1).padStart(2, '0');
                    const count = countDescendants(m);
                    return `<div class="glance-row">
              <span class="glance-idx">${idx}</span>
              <span class="glance-name">${esc(m.name)}</span>
              <span class="glance-count">${count || ''}</span>
            </div>`;
                })
                .join('');
            return `<div class="glance-group">
          <div class="glance-group-head">Section ${String(si + 1).padStart(2, '0')} · ${esc(
              sec.label,
          )}<span class="glance-group-total">${sec.deliverableCount} deliverables</span></div>
          <div class="glance-grid">${rows}</div>
        </div>`;
        })
        .join('');

    const contentsHtml = `
      <section class="sheet break-before">
        <div class="page-title-block">
          <div class="page-eyebrow">Contents</div>
          <h2 class="page-title">What&rsquo;s inside</h2>
        </div>
        <div class="toc">${contentsRows}</div>

        <div class="glance-header">
          <div class="page-eyebrow">Scope at a glance</div>
          <div class="glance-total">
            <span class="glance-total-num">${totalDeliverables}</span>
            <span class="glance-total-lab">deliverables across ${totalModules} modules</span>
          </div>
        </div>
        ${scopeGlanceGroups}
      </section>`;

    /* ── Page: executive summary ─────────────────────────────────────────── */
    const summaryLead = overview
        ? overview
        : `This quotation covers ${totalDeliverables} deliverables across ${totalModules} modules${
              totalSections > 1 ? ` in ${totalSections} sections` : ''
          }, from design through delivery and handover.`;

    const timelineHtml = milestonesToUse.length
        ? `<div class="timeline">
        <div class="block-eyebrow">Delivery Milestones</div>
        ${milestonesToUse
            .map(
                (m: any, i: number) => `<div class="timeline-row">
          <span class="timeline-idx">${String(i + 1).padStart(2, '0')}</span>
          <span class="timeline-label">${esc(normalizeText(m.label))}</span>
          ${m.percentage ? `<span class="timeline-pct">${m.percentage}%</span>` : ''}
        </div>`,
            )
            .join('')}
      </div>`
        : '';

    const summaryHtml = `
      <section class="sheet break-before">
        <div class="page-title-block">
          <div class="page-eyebrow">Executive Summary</div>
          <h2 class="page-title">${esc(proposalTitle)}</h2>
        </div>
        <p class="summary-lead">${esc(summaryLead)}</p>

        <div class="stat-row">
          <div class="stat-cell">
            <div class="stat-num">${totalDeliverables}</div>
            <div class="stat-lab">Deliverables</div>
          </div>
          <div class="stat-cell">
            <div class="stat-num">${totalModules}</div>
            <div class="stat-lab">Modules</div>
          </div>
          <div class="stat-cell">
            <div class="stat-num">${totalSections}</div>
            <div class="stat-lab">Section${totalSections === 1 ? '' : 's'}</div>
          </div>
        </div>

        ${timelineHtml}
      </section>`;

    /* ── Pages: section dividers + modules ───────────────────────────────── */
    const sectionsHtml = sections
        .map((sec, si) => {
            const secNo = String(si + 1).padStart(2, '0');
            const divider = `
        <section class="section-divider">
          <div class="divider-inner">
            <div class="divider-no">Section ${secNo}</div>
            <h2 class="divider-title">${esc(sec.label)}</h2>
            <div class="divider-summary">${esc(sec.kicker)} · ${sec.modules.length} module${
                sec.modules.length === 1 ? '' : 's'
            } · ${sec.deliverableCount} deliverables</div>
          </div>
        </section>`;

            const desc = sec.scopeDescription
                ? `<p class="section-desc">${esc(sec.scopeDescription)}</p>`
                : '';

            const modulesHtml = sec.modules
                .map((m, mi) => renderModule(m, mi + 1, currency))
                .join('');

            const tech = renderTechStack(sec.techStack);

            return `${divider}<div class="section-body">${desc}${modulesHtml}${tech}</div>`;
        })
        .join('');

    /* ── Page: pricing ───────────────────────────────────────────────────── */
    const summaryAdjustments = `
      ${
          discountVal > 0 || taxVal > 0
              ? `<div class="price-adjustments">
        <div class="adj-row"><span>One-time project investment</span><span>${formatMoneyPdf(
            subtotalVal,
            currency,
        )}</span></div>
        ${
            discountVal > 0
                ? `<div class="adj-row adj-neg"><span>Applied discount</span><span>− ${formatMoneyPdf(
                      discountVal,
                      currency,
                  )}</span></div>`
                : ''
        }
        ${
            taxVal > 0
                ? `<div class="adj-row"><span>Tax / VAT</span><span>${formatMoneyPdf(
                      taxVal,
                      currency,
                  )}</span></div>`
                : ''
        }
      </div>`
              : ''
      }`;

    const recurringNote =
        recurringMonthly > 0
            ? `<div class="price-recurring">Plus recurring costs of <strong>${formatMoneyPdf(
                  recurringMonthly,
                  currency,
              )} / month</strong>, billed separately from the one-time total above.</div>`
            : '';

    const milestoneRows = milestonesToUse
        .map(
            (m: any) => `<div class="milestone-row">
        ${m.percentage ? `<span class="milestone-pct">${m.percentage}%</span>` : '<span class="milestone-pct">—</span>'}
        <span class="milestone-label">${esc(normalizeText(m.label))}</span>
      </div>`,
        )
        .join('');

    const pricingHtml = `
      <section class="sheet break-before pricing">
        <div class="page-title-block">
          <div class="page-eyebrow">Investment</div>
          <h2 class="page-title">One-time project investment</h2>
        </div>

        <div class="price-hero">
          <div class="price-figure">${formatMoneyPdf(grandTotalVal, currency)}</div>
          <div class="price-rule"></div>
          <div class="price-ledger">
            <span>${totalDeliverables} deliverables</span>
            <span class="price-ledger-sep">·</span>
            <span>${totalModules} modules</span>
            ${
                perDeliverable > 0
                    ? `<span class="price-ledger-sep">·</span><span class="price-ledger-em">${formatMoneyPdf(
                          Math.round(perDeliverable),
                          currency,
                      )} per deliverable</span>`
                    : ''
            }
          </div>
        </div>

        ${summaryAdjustments}

        <div class="price-milestones">
          <div class="block-eyebrow">Payment Terms</div>
          ${milestoneRows}
        </div>

        ${recurringNote}

        <div class="price-note">
          This one-time price covers the scope defined in this document through delivery and
          handover. Third-party subscriptions, ad budgets, and post-launch changes outside the
          agreed scope are billed separately — see the terms overleaf.
        </div>
      </section>`;

    /* ── Page: terms + authorization ─────────────────────────────────────── */
    const notIncludedHtml = notIncludedFinal
        .map(
            (item: string) =>
                `<div class="terms-item"><span class="terms-mark excl">–</span><span>${esc(item)}</span></div>`,
        )
        .join('');
    const clientReqHtml = clientReqFinal
        .map(
            (item: string) =>
                `<div class="terms-item"><span class="terms-mark incl">+</span><span>${esc(item)}</span></div>`,
        )
        .join('');

    const termsHtml = `
      <section class="sheet break-before terms">
        <div class="page-title-block">
          <div class="page-eyebrow">Terms</div>
          <h2 class="page-title">Scope boundaries</h2>
        </div>

        <div class="terms-cols">
          <div class="terms-col">
            <div class="terms-col-head excl">Not included in price</div>
            ${notIncludedHtml}
          </div>
          <div class="terms-col">
            <div class="terms-col-head incl">Client needs to provide</div>
            ${clientReqHtml}
          </div>
        </div>

        <div class="auth">
          <div class="auth-left">
            <div class="block-eyebrow light">Authorization</div>
            <div class="auth-desc">
              This quotation is valid until <strong>${esc(validUntilStr)}</strong>. On acceptance,
              formal execution begins per the agreed milestone schedule.
            </div>
          </div>
          <div class="auth-right">
            ${
                ctx.signatureSrc
                    ? `<img src="${esc(ctx.signatureSrc)}" alt="Signature" class="auth-sig" />`
                    : '<div class="auth-sig-gap"></div>'
            }
            <div class="auth-sig-line">
              <div class="auth-sig-label">Authorized Signature</div>
              <div class="auth-sig-org">${esc(companyName)}</div>
            </div>
          </div>
        </div>
      </section>`;

    const ledgerRail = `<div class="ledger-rail"><span>#${esc(
        quotationNo,
    )} &nbsp;·&nbsp; ${totalDeliverables} DELIVERABLES</span></div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quotation #${esc(quotationNo)} — ${esc(proposalTitle)}</title>
  <style>
    ${ctx.fontCss}

    :root {
      --ink-900: #101220;
      --ink-700: #2B2F42;
      --ink-500: #5C6275;
      --ink-300: #9AA0B1;
      --paper: #FFFFFF;
      --paper-alt: #F5F5F8;
      --rule: #E4E5EC;
      --rule-strong: #C9CBD6;
      --accent: #4B21D9;
      --accent-deep: #1E1146;
      --accent-tint: #F0ECFE;
      --incl: #14705A;
      --excl: #8E3350;
      --incl-bg: #F1F7F4;
      --excl-bg: #FBF2F5;

      --font-display: 'Bricolage Grotesque', 'Inter Tight', 'Inter', system-ui, sans-serif;
      --font-body: 'Inter', 'Hind Siliguri', system-ui, -apple-system, sans-serif;
      --font-mono: 'Geist Mono', ui-monospace, 'JetBrains Mono', monospace;
    }

    @page { size: A4; margin: 18mm 16mm 16mm; }
    @page :first { margin: 0; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body { background: var(--paper); }
    body {
      font-family: var(--font-body);
      color: var(--ink-700);
      font-size: 9.5pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-font-smoothing: antialiased;
      font-variant-numeric: tabular-nums;
    }

    .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    strong { font-weight: 600; color: var(--ink-900); }

    /* Pagination */
    .break-before { break-before: page; }
    .section-divider { break-before: page; break-inside: avoid; }
    .module-head, .stat-cell, .price-hero, .milestone-row,
    .deliv, .toc-row, .glance-row, .timeline-row, .tech-row { break-inside: avoid; }
    h1, h2, h3, .module-head, .divider-title, .page-title { break-after: avoid; }
    .auth, .terms-col-head, .price-milestones { break-inside: avoid; }
    p, .deliv, .terms-item { orphans: 3; widows: 3; }

    /* ── Ledger rail (repeats on every page; hidden beneath the cover) ── */
    /* Fixed elements position relative to the page CONTENT box in print, so a
       negative offset is what pushes the rail out into the outer paper margin. */
    .ledger-rail {
      position: fixed;
      left: -11mm; top: 0; bottom: 0;
      width: 7mm;
      display: flex; align-items: center; justify-content: center;
      z-index: 1;
    }
    .ledger-rail span {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-family: var(--font-mono);
      font-size: 6pt; font-weight: 500;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-300);
      white-space: nowrap;
    }

    /* ── Cover (full bleed, page 1) ── */
    .cover {
      position: relative;
      z-index: 2;
      width: 210mm; height: 297mm;
      background: linear-gradient(180deg, var(--accent-deep) 0%, #160C36 100%);
      color: #fff;
      padding: 20mm;
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    .cover-top {
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .cover-logo { height: 12mm; width: auto; object-fit: contain; filter: brightness(0) invert(1); }
    .cover-eyebrow {
      font-family: var(--font-mono);
      font-size: 7.5pt; font-weight: 500; letter-spacing: 0.18em;
      text-transform: uppercase; color: var(--ink-300);
    }
    .cover-number {
      font-family: var(--font-mono);
      font-size: 22pt; font-weight: 500; letter-spacing: -0.01em;
      color: #C9BFF2; margin-top: 6mm;
    }
    .cover-mid { margin-top: auto; margin-bottom: auto; }
    .cover-kicker {
      font-family: var(--font-mono);
      font-size: 8pt; font-weight: 500; letter-spacing: 0.16em;
      text-transform: uppercase; color: #A99FD6; margin-bottom: 8mm;
    }
    .cover-title {
      font-family: var(--font-display);
      font-weight: 600; font-size: 46pt; line-height: 0.98;
      letter-spacing: -0.03em; color: #fff;
      max-width: 150mm;
    }
    .cover-rule {
      height: 0.5pt; width: 100%; background: rgba(255,255,255,0.28);
      margin: 12mm 0 7mm;
    }
    .cover-meta { display: flex; gap: 16mm; }
    .cover-meta-k {
      font-family: var(--font-mono);
      font-size: 7pt; font-weight: 500; letter-spacing: 0.14em;
      text-transform: uppercase; color: #A99FD6; margin-bottom: 2mm;
    }
    .cover-meta-v { font-size: 10pt; color: #ECEAF6; font-weight: 500; }
    .cover-meta-sub { font-size: 8pt; color: #A99FD6; margin-top: 1mm; }
    .cover-foot {
      display: flex; justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 7.5pt; letter-spacing: 0.06em; color: var(--ink-300);
    }

    /* ── Generic sheet / page-title ── */
    .sheet { position: relative; }
    .page-title-block { margin-bottom: 8mm; }
    .page-eyebrow {
      font-family: var(--font-mono);
      font-size: 7.5pt; font-weight: 500; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--accent); margin-bottom: 2mm;
    }
    .page-title {
      font-family: var(--font-display);
      font-weight: 600; font-size: 26pt; line-height: 1.02;
      letter-spacing: -0.02em; color: var(--ink-900);
    }
    .block-eyebrow {
      font-family: var(--font-mono);
      font-size: 7.5pt; font-weight: 500; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--accent); margin-bottom: 4mm;
    }
    .block-eyebrow.light { color: #A99FD6; }

    /* ── Contents ── */
    .toc { margin-bottom: 12mm; }
    .toc-row {
      display: flex; align-items: baseline; gap: 3mm;
      padding: 3mm 0; border-bottom: 0.5pt solid var(--rule);
    }
    .toc-name { font-size: 10pt; font-weight: 500; color: var(--ink-900); }
    .toc-dot { flex: 1; }
    .toc-meta {
      font-family: var(--font-mono);
      font-size: 8pt; color: var(--ink-300); letter-spacing: 0.02em;
    }

    /* ── Scope at a glance ── */
    .glance-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      padding-bottom: 3mm; margin-bottom: 5mm;
      border-bottom: 0.5pt solid var(--rule-strong);
    }
    .glance-total { text-align: right; }
    .glance-total-num {
      font-family: var(--font-mono); font-size: 15pt; font-weight: 500;
      color: var(--accent); margin-right: 2mm;
    }
    .glance-total-lab { font-size: 8.5pt; color: var(--ink-500); }
    .glance-group { margin-bottom: 6mm; }
    .glance-group-head {
      font-family: var(--font-display);
      font-size: 11pt; font-weight: 600; color: var(--ink-900);
      margin-bottom: 3mm; padding-bottom: 2mm;
      border-bottom: 0.5pt solid var(--rule);
      display: flex; justify-content: space-between; align-items: baseline;
    }
    .glance-group-total {
      font-family: var(--font-mono); font-size: 7.5pt;
      color: var(--ink-300); font-weight: 400; letter-spacing: 0.04em;
    }
    .glance-grid {
      display: grid; grid-template-columns: 1fr 1fr 1fr;
      column-gap: 8mm; row-gap: 1.6mm;
    }
    .glance-row { display: flex; align-items: baseline; gap: 2mm; font-size: 8.25pt; }
    .glance-idx {
      font-family: var(--font-mono); font-size: 7pt; font-weight: 500;
      color: var(--accent); width: 6mm; flex-shrink: 0;
    }
    .glance-name { flex: 1; color: var(--ink-700); }
    .glance-count {
      font-family: var(--font-mono); font-size: 7pt; color: var(--ink-300);
      flex-shrink: 0;
    }

    /* ── Executive summary ── */
    .summary-lead {
      font-size: 11pt; line-height: 1.6; color: var(--ink-700);
      max-width: 155mm; margin-bottom: 10mm;
    }
    .stat-row { display: flex; gap: 4mm; margin-bottom: 10mm; }
    .stat-cell {
      flex: 1; border: 0.5pt solid var(--rule-strong); border-radius: 3px;
      padding: 6mm 5mm;
    }
    .stat-num {
      font-family: var(--font-mono); font-size: 24pt; font-weight: 500;
      color: var(--ink-900); line-height: 1; letter-spacing: -0.02em;
    }
    .stat-lab {
      font-family: var(--font-mono); font-size: 7.5pt; font-weight: 500;
      letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--ink-500); margin-top: 3mm;
    }
    .timeline { border-top: 0.5pt solid var(--rule-strong); padding-top: 5mm; }
    .timeline-row {
      display: flex; align-items: baseline; gap: 4mm;
      padding: 2.5mm 0; border-bottom: 0.5pt solid var(--rule);
    }
    .timeline-idx {
      font-family: var(--font-mono); font-size: 8pt; color: var(--accent);
      font-weight: 500; width: 7mm;
    }
    .timeline-label { flex: 1; font-size: 9.5pt; color: var(--ink-700); }
    .timeline-pct {
      font-family: var(--font-mono); font-size: 9pt; font-weight: 500;
      color: var(--ink-900);
    }

    /* ── Section divider (half page ink) ── */
    .section-divider {
      width: 100%;
      background: linear-gradient(180deg, var(--accent-deep) 0%, #160C36 100%);
      color: #fff;
      /* pull into the page margins so it reads as a full-width band */
      margin: -18mm -16mm 8mm;
      padding: 26mm 16mm 20mm;
    }
    .divider-no {
      font-family: var(--font-mono); font-size: 8pt; font-weight: 500;
      letter-spacing: 0.16em; text-transform: uppercase; color: #A99FD6;
      margin-bottom: 5mm;
    }
    .divider-title {
      font-family: var(--font-display); font-weight: 600; font-size: 30pt;
      line-height: 1.02; letter-spacing: -0.02em; color: #fff;
    }
    .divider-summary {
      font-family: var(--font-mono); font-size: 8.5pt; color: #C9BFF2;
      letter-spacing: 0.02em; margin-top: 5mm;
    }
    .section-body { }
    .section-desc {
      font-size: 10pt; color: var(--ink-500); margin-bottom: 7mm; max-width: 150mm;
    }

    /* ── Module ── */
    .module { margin-bottom: 7mm; }
    .module-head {
      display: flex; align-items: baseline; gap: 3mm;
      border-top: 0.5pt solid var(--rule-strong);
      padding-top: 2.5mm; margin-bottom: 3mm;
    }
    .module-idx {
      font-family: var(--font-mono); font-size: 9pt; font-weight: 500;
      color: var(--accent); flex-shrink: 0;
    }
    .module-name {
      font-family: var(--font-display); font-weight: 600; font-size: 13pt;
      color: var(--ink-900); letter-spacing: -0.01em; line-height: 1.2; flex: 1;
    }
    .module-meta { display: flex; align-items: baseline; gap: 3mm; flex-shrink: 0; }
    .module-price {
      font-family: var(--font-mono); font-size: 9pt; font-weight: 500;
      color: var(--accent);
    }
    .module-count {
      font-family: var(--font-mono); font-size: 8pt; color: var(--ink-300);
      min-width: 6mm; text-align: right;
    }
    .deliverables {
      display: grid; grid-template-columns: 1fr 1fr;
      column-gap: 8mm; row-gap: 1.6mm;
      padding-left: 6mm;
    }
    .deliv { display: flex; gap: 2.5mm; align-items: baseline; }
    .deliv-mark {
      width: 3px; height: 3px; background: var(--accent); opacity: 0.6;
      flex-shrink: 0; margin-top: 1.6mm; border-radius: 0;
    }
    .deliv-body { flex: 1; }
    .deliv-name { font-size: 8.75pt; color: var(--ink-700); line-height: 1.45; }
    .deliv-price {
      font-family: var(--font-mono); font-size: 8pt; color: var(--accent);
      margin-left: 2mm;
    }
    .deliv-route {
      display: block; font-family: var(--font-mono); font-size: 7pt;
      color: var(--ink-300); margin-top: 0.5mm;
    }
    .deliv-sub { margin-top: 1mm; padding-left: 3mm; }
    .deliv-sub-item {
      display: flex; gap: 2mm; align-items: baseline;
      font-size: 8pt; color: var(--ink-500); line-height: 1.4;
    }
    .deliv-sub-mark {
      width: 2.5px; height: 2.5px; border: 0.5pt solid var(--ink-300);
      flex-shrink: 0; margin-top: 1.4mm;
    }

    /* ── Tech stack ── */
    .tech-block {
      margin-top: 8mm; padding-top: 5mm;
      border-top: 0.5pt solid var(--rule-strong);
    }
    .tech-row {
      display: flex; gap: 5mm; padding: 2mm 0;
      border-bottom: 0.5pt solid var(--rule);
    }
    .tech-row:last-child { border-bottom: none; }
    .tech-layer {
      width: 28mm; flex-shrink: 0; font-weight: 600; font-size: 9pt;
      color: var(--ink-900);
    }
    .tech-chips { flex: 1; }
    .tech-chip {
      display: inline-block; font-size: 8pt; color: var(--ink-700);
      background: var(--paper-alt); border: 0.5pt solid var(--rule);
      padding: 0.6mm 2.4mm; border-radius: 3px; margin: 0 1.5mm 1.5mm 0;
    }

    /* ── Pricing page ── */
    .pricing .price-hero { margin: 4mm 0 8mm; }
    .price-figure {
      font-family: var(--font-mono); font-weight: 500; font-size: 44pt;
      line-height: 1; letter-spacing: -0.02em; color: var(--ink-900);
      white-space: nowrap;
    }
    .price-rule {
      height: 0.5pt; background: var(--rule-strong); margin: 5mm 0 3mm;
    }
    .price-ledger {
      font-family: var(--font-mono); font-size: 9.5pt; color: var(--ink-500);
      letter-spacing: 0.01em;
    }
    .price-ledger-sep { color: var(--ink-300); margin: 0 2mm; }
    .price-ledger-em { color: var(--accent); font-weight: 500; }

    .price-adjustments {
      border: 0.5pt solid var(--rule); border-radius: 3px;
      padding: 2mm 5mm; margin-bottom: 8mm;
    }
    .adj-row {
      display: flex; justify-content: space-between;
      padding: 2.5mm 0; border-bottom: 0.5pt solid var(--rule);
      font-size: 9.5pt; color: var(--ink-700);
    }
    .adj-row:last-child { border-bottom: none; }
    .adj-row span:last-child { font-family: var(--font-mono); font-weight: 500; color: var(--ink-900); }
    .adj-neg span { color: var(--excl) !important; }

    .price-milestones { margin-bottom: 7mm; }
    .milestone-row {
      display: flex; align-items: baseline; gap: 4mm;
      padding: 2.5mm 0; border-bottom: 0.5pt solid var(--rule);
    }
    .milestone-row:last-child { border-bottom: none; }
    .milestone-pct {
      font-family: var(--font-mono); font-size: 11pt; font-weight: 500;
      color: var(--accent); width: 14mm; flex-shrink: 0;
    }
    .milestone-label { font-size: 10pt; color: var(--ink-700); }
    .price-recurring {
      background: var(--accent-tint); border-radius: 3px;
      padding: 4mm 5mm; font-size: 9pt; color: var(--ink-700); margin-bottom: 7mm;
    }
    .price-note {
      font-size: 8.5pt; color: var(--ink-500); line-height: 1.55;
      max-width: 155mm; padding-top: 5mm;
      border-top: 0.5pt solid var(--rule);
    }

    /* ── Terms ── */
    .terms-cols {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10mm;
      margin-bottom: 8mm;
    }
    .terms-col-head {
      font-family: var(--font-mono); font-size: 8pt; font-weight: 500;
      letter-spacing: 0.1em; text-transform: uppercase;
      padding-bottom: 2.5mm; margin-bottom: 3mm;
    }
    .terms-col-head.excl { color: var(--excl); border-top: 0.5pt solid var(--excl); padding-top: 2.5mm; }
    .terms-col-head.incl { color: var(--incl); border-top: 0.5pt solid var(--incl); padding-top: 2.5mm; }
    .terms-item {
      display: flex; gap: 2.5mm; align-items: baseline;
      font-size: 8.25pt; color: var(--ink-700); line-height: 1.3;
      padding: 0.35mm 0;
    }
    .terms-mark { font-family: var(--font-mono); font-weight: 600; flex-shrink: 0; }
    .terms-mark.excl { color: var(--excl); }
    .terms-mark.incl { color: var(--incl); }

    /* ── Authorization (foot of terms) ── */
    .auth {
      background: linear-gradient(180deg, var(--accent-deep) 0%, #160C36 100%);
      color: #fff; border-radius: 3px;
      padding: 6mm 8mm;
      display: flex; justify-content: space-between; align-items: flex-end; gap: 12mm;
    }
    .auth-left { max-width: 95mm; }
    .auth-desc { font-size: 8.5pt; color: #C9BFF2; line-height: 1.5; }
    .auth-desc strong { color: #fff; }
    .auth-sig { height: 11mm; width: auto; object-fit: contain; filter: brightness(0) invert(1); opacity: 0.92; display: block; margin: 0 auto 1mm; }
    .auth-sig-gap { height: 11mm; }
    .auth-sig-line { border-top: 0.5pt solid rgba(255,255,255,0.5); padding-top: 2mm; width: 55mm; text-align: center; }
    .auth-sig-label {
      font-family: var(--font-mono); font-size: 8pt; font-weight: 500;
      letter-spacing: 0.06em; text-transform: uppercase; color: #C9BFF2;
    }
    .auth-sig-org { font-size: 8.5pt; color: #A99FD6; margin-top: 0.5mm; }
  </style>
</head>
<body>
  ${ledgerRail}
  ${coverHtml}
  ${contentsHtml}
  ${summaryHtml}
  ${sectionsHtml}
  ${pricingHtml}
  ${termsHtml}
</body>
</html>`;
}

/* ── Validation gate ──────────────────────────────────────────────────────── */

/** Blocks a render when client-facing identity data is missing or is an obvious
 *  placeholder. Throws AppError(422) with a human-readable list of problems so
 *  the admin fixes the data instead of shipping garbage to a client. */
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

const PT_PER_MM = 2.834645669;

/** Stamps a subtle footer (wordmark + "n / total") onto every page except the
 *  cover, using pdf-lib's built-in Courier so no font embedding is needed. Falls
 *  back to the unstamped buffer rather than failing the whole export. */
export async function stampFooters(buf: Buffer, wordmark: string): Promise<Buffer> {
    try {
        const doc = await PDFDocument.load(buf);
        const font = await doc.embedFont(StandardFonts.Courier);
        const pages = doc.getPages();
        const total = pages.length;
        // Courier is WinAnsi-only; keep the wordmark ASCII-safe.
        const mark = (wordmark.replace(/[^\x20-\x7E]/g, '').trim() || 'WebBriks').toUpperCase();
        const y = 9 * PT_PER_MM;
        const size = 7;
        const gray = rgb(0.6, 0.63, 0.69);
        const ink = rgb(0.17, 0.18, 0.26);

        for (let i = 1; i < pages.length; i++) {
            const p = pages[i]!;
            const { width } = p.getSize();
            p.drawText(mark, { x: 16 * PT_PER_MM, y, size, font, color: gray });

            const cur = String(i + 1);
            const rest = ` / ${total}`;
            const curW = font.widthOfTextAtSize(cur, size);
            const restW = font.widthOfTextAtSize(rest, size);
            const rightX = width - 16 * PT_PER_MM - curW - restW;
            p.drawText(cur, { x: rightX, y, size, font, color: ink });
            p.drawText(rest, { x: rightX + curW, y, size, font, color: gray });
        }

        return Buffer.from(await doc.save());
    } catch (e) {
        logger.warn({ err: e }, 'quotation.footer_stamp_failed');
        return buf;
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

export class QuotationPuppeteerPdfService {
    static async generatePdf(
        quotationId: string,
    ): Promise<{ buffer: Buffer; filename: string }> {
        const q = await QuotationModel.findById(quotationId)
            .populate('clientId', 'name clientId emails')
            .lean();
        if (!q) throw new AppError('Quotation not found', 404);

        // Data hygiene gate — never ship placeholder identity data to a client.
        assertRenderable(q as Record<string, any>);

        const signatureUrl = process.env.COMPANY_SIGNATURE_URL || DEFAULT_SIGNATURE;
        const companyLogoRemote = ((q as any).company?.logo as string) || DEFAULT_LOGO;

        let logoSrc = null;
        if (companyLogoRemote !== DEFAULT_LOGO) {
            logoSrc = await fetchImageAsDataUrl(companyLogoRemote);
        }
        if (!logoSrc) {
            logoSrc = LOCAL_LOGO_BASE64 || (await fetchImageAsDataUrl(DEFAULT_LOGO)) || FALLBACK_PIXEL_PNG;
        }

        const signatureSrc = (await fetchImageAsDataUrl(signatureUrl)) || '';
        const fontCss = await buildEmbeddedFontCss();
        const companyName = String((q as any).company?.name || 'WebBriks').trim();

        const html = buildPrintHtml(q as Record<string, any>, { logoSrc, signatureSrc, fontCss });

        const browser = await getBrowserInstance();
        const page = await browser.newPage();
        try {
            await page.setContent(html, { waitUntil: 'load' });
            // Ensure the embedded faces are parsed before laying out for print.
            await page.evaluateHandle('document.fonts.ready');
            await page.emulateMediaType('print');

            // Header/footer are NOT delegated to Chrome: its templates render in
            // every page's margin, including the full-bleed cover, and cannot be
            // suppressed per page. Instead we render clean pages and stamp the
            // footer with pdf-lib afterwards, skipping the cover.
            const rawPdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
                displayHeaderFooter: false,
            });

            const pdf = await stampFooters(Buffer.from(rawPdf), companyName);

            const qn = String((q as any).quotationNumber || '').trim();
            const title = String((q as any).details?.title || '').trim();
            const stem = qn ? (qn.startsWith('#') ? qn : `#${qn}`) : title || 'quotation';
            const rawName = `${stem}.pdf`;
            const filename = rawName.replace(/[/\\?%*:|"<>]/g, '-');
            return { buffer: Buffer.from(pdf), filename };
        } catch (e: unknown) {
            const err = e as { message?: string };
            logger.error({ err: e, quotationId }, 'quotation.puppeteer_pdf_failed');
            throw new AppError(err?.message || 'Failed to generate PDF with Puppeteer', 500);
        } finally {
            await page.close().catch(() => {});
        }
    }
}
