import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import QuotationModel from '../models/quotation.model.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import { isUpfrontBillingCycle } from '../types/quotation.type.js';

const CATEGORY_LABELS: Record<string, string> = {
    'web-development': 'Web Design & Development',
    marketing: 'Marketing',
    'photo-editing': 'Photo Editing',
    'video-editing': 'Video Editing',
};

const CATEGORY_KICKERS: Record<string, string> = {
    'web-development': 'Engineering & Product',
    marketing: 'Growth & Creative',
    'photo-editing': 'Visual Production',
    'video-editing': 'Motion & Post-Production',
};

const BILLING_LABELS: Record<string, string> = {
    'one-time': 'One-Time',
    monthly: 'Monthly',
    yearly: 'Yearly',
    'per-image': 'Per Image',
    'per-video': 'Per Video',
    'per-second': 'Per Second',
    'per-10s': 'Per 10 Seconds',
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

const DEFAULT_LOGO =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png';

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

interface ParsedFeatureNode {
    name: string;
    route?: string;
    price?: number;
    priceStr?: string;
    level: number;
    children: ParsedFeatureNode[];
}

/** Parses flat indented scope strings into a structured feature tree. */
function parseScopeTree(rawItems: string[]): ParsedFeatureNode[] {
    const nodes: ParsedFeatureNode[] = [];

    const parsedList = rawItems.map((rawText) => {
        const match = rawText.match(/^(\s*)/);
        const indentStr = match ? match[0] : '';
        const level = Math.min(Math.floor(indentStr.replace(/\t/g, '    ').length / 2), 4);

        let text = rawText.trim().replace(/^[-*•◦▪+]\s*/, '').trim();
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

        return {
            name: text,
            route: route || undefined,
            price: priceNum,
            priceStr: priceStr || undefined,
            level,
            children: [],
        };
    });

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

/** Renders Grouped Module Cards for Web Development and technical scopes. */
function renderGroupedScopeCards(nodes: ParsedFeatureNode[], currency: string): string {
    if (nodes.length === 0) return '';

    return nodes.map((moduleNode, idx) => {
        const moduleNum = String(idx + 1).padStart(2, '0');
        const hasModulePrice = moduleNode.price && moduleNode.price > 0;
        const modulePriceHtml = hasModulePrice
            ? `<div class="module-price-tag">${formatMoneyPdf(moduleNode.price, currency)}</div>`
            : '';

        const renderChildrenList = (children: ParsedFeatureNode[], depth = 1): string => {
            if (children.length === 0) return '';
            const itemsHtml = children.map((child) => {
                const hasChildPrice = child.price && child.price > 0;
                const childPriceHtml = hasChildPrice
                    ? `<span class="child-price">${formatMoneyPdf(child.price, currency)}</span>`
                    : '';

                const routeHtml = child.route
                    ? `<div class="child-route-tag">
                        <span class="route-icon">↳</span>
                        <code>${esc(child.route)}</code>
                      </div>`
                    : '';

                const nestedHtml = child.children && child.children.length > 0
                    ? renderChildrenList(child.children, depth + 1)
                    : '';

                return `
                  <li class="child-feature-item level-${depth}">
                    <div class="child-feature-main">
                      <div class="child-feature-left">
                        <span class="bullet-dot"></span>
                        <span class="child-feature-name">${esc(child.name)}</span>
                      </div>
                      ${childPriceHtml}
                    </div>
                    ${routeHtml}
                    ${nestedHtml}
                  </li>`;
            }).join('');

            return `<ul class="child-features-list level-${depth}">${itemsHtml}</ul>`;
        };

        const childrenContent = renderChildrenList(moduleNode.children);

        return `
          <div class="module-card">
            <div class="module-card-header">
              <div class="module-header-left">
                <span class="module-num">${moduleNum}</span>
                <h3 class="module-title">${esc(moduleNode.name)}</h3>
              </div>
              ${modulePriceHtml}
            </div>
            ${moduleNode.route ? `<div class="module-route-bar"><code>${esc(moduleNode.route)}</code></div>` : ''}
            ${childrenContent ? `<div class="module-card-body">${childrenContent}</div>` : ''}
          </div>`;
    }).join('');
}

/** Renders Deliverables Cards for Marketing & Creative services. */
function renderDeliverablesScopeCards(nodes: ParsedFeatureNode[], currency: string): string {
    if (nodes.length === 0) return '';

    return nodes.map((categoryNode) => {
        const hasPrice = categoryNode.price && categoryNode.price > 0;
        const priceHtml = hasPrice
            ? `<div class="deliverable-price-badge">${formatMoneyPdf(categoryNode.price, currency)}</div>`
            : '';

        const deliverablesList = categoryNode.children.length > 0 ? categoryNode.children : [];
        const itemsHtml = deliverablesList.map((deliv) => {
            const itemPrice = deliv.price && deliv.price > 0
                ? `<span class="deliv-item-price">${formatMoneyPdf(deliv.price, currency)}</span>`
                : '';
            return `
              <div class="deliverable-item">
                <span class="check-icon">✓</span>
                <span class="deliverable-name">${esc(deliv.name)}</span>
                ${itemPrice}
              </div>`;
        }).join('');

        return `
          <div class="deliverable-card">
            <div class="deliverable-card-header">
              <div class="deliverable-title-box">
                <h3 class="deliverable-category-title">${esc(categoryNode.name)}</h3>
              </div>
              ${priceHtml}
            </div>
            ${itemsHtml ? `
              <div class="deliverable-card-body">
                <div class="deliverables-sublabel">Included Deliverables</div>
                <div class="deliverables-grid">
                  ${itemsHtml}
                </div>
              </div>` : ''}
          </div>`;
    }).join('');
}

export function buildPrintHtml(
    q: Record<string, any>,
    ctx: {
        logoSrc: string;
        signatureSrc: string;
    },
): string {
    const client = q.client || {};
    const details = q.details || {};
    const totals = q.totals || {};
    const services: any[] = Array.isArray(q.services) ? q.services : [];
    const notIncludedRaw = Array.isArray(q.notIncluded) ? q.notIncluded : [];
    const clientReqRaw = Array.isArray(q.clientRequirements) ? q.clientRequirements : [];

    const currency = q.currency || 'BDT';

    const quotationNo = String(q.quotationNumber || 'DRAFT-001').replace(/^#/, '').trim() || 'DRAFT-001';
    const issueDate = details?.date
        ? format(new Date(details.date), 'MMMM dd, yyyy')
        : format(new Date(), 'MMMM dd, yyyy');
    const validUntilStr = details?.validUntil
        ? format(new Date(details.validUntil), 'MMMM dd, yyyy')
        : '—';

    const clientName = client.contactName || client.companyName || 'Valued Client';
    const clientCompany = client.companyName && client.contactName ? client.companyName : '';
    const clientEmail = client.email || '';
    const clientPhone = client.phone || '';
    const proposalTitle = details?.title || 'Digital Agency Proposal';
    const globalOverview = String(q.overview || details?.overview || '').trim();

    const notIncludedItems = notIncludedRaw.length > 0 ? notIncludedRaw : [
        'Domain Registration & Premium Web Hosting (Billed Separately)',
        'Third-party Paid API Licenses, Plugins, or Premium Fonts',
        'Paid Ad Spend for Facebook, Google, or LinkedIn Campaigns',
        'Raw Unedited Studio Footage or Source Design Files',
    ];

    const clientRequirements = clientReqRaw.length > 0 ? clientReqRaw : [
        'High-resolution Brand Logo, Color Palette & Typography Guidelines',
        'Admin Access / Credentials to Hosting, Domain, or CMS Platform',
        'Final Approved Text Content, Copywriting & Product Photography',
        'Dedicated Point of Contact for Prompt Feedback and Approvals',
    ];

    const companyName = q.company?.name || 'WebBriks';
    const companyEmail = q.company?.email || '';
    const companyPhone = q.company?.phone || '';
    const companyWebsite = q.company?.website || '';

    // Sort services in standard rank order
    const SERVICE_RANK_ORDER: Record<string, number> = {
        'web-development': 1,
        marketing: 2,
        'video-editing': 3,
        'photo-editing': 4,
    };

    const sortedServices = [...services].sort((a, b) => {
        const orderA = SERVICE_RANK_ORDER[a.category] ?? 99;
        const orderB = SERVICE_RANK_ORDER[b.category] ?? 99;
        return orderA - orderB;
    });

    let overallUpfrontTotal = 0;
    let overallRecurringMonthly = 0;

    // Render individual service modules
    const modulesHtml = sortedServices.map((service, idx) => {
        const categoryKey = String(service?.category || '');
        const label = CATEGORY_LABELS[categoryKey] || String(service?.category || 'Service');
        const kicker = CATEGORY_KICKERS[categoryKey] || 'Service Scope';
        const isWebDev = categoryKey === 'web-development';
        const isMarketing = categoryKey === 'marketing';

        const rawScopeDesc = String(service?.scopeDescription || '').trim();
        const isLorem = rawScopeDesc.toLowerCase().includes('lorem ipsum');
        const isDuplicateOverview = rawScopeDesc === globalOverview;
        const scopeDescription = (rawScopeDesc && !isLorem && !isDuplicateOverview) ? rawScopeDesc : '';

        const rawItems = Array.isArray(service?.scopeItems)
            ? service.scopeItems.map((x: any) => String(x || '').replace(/\s+$/, '')).filter(Boolean)
            : [];

        const parsedTree = parseScopeTree(rawItems);

        let scopeHtml = '';
        if (isMarketing) {
            scopeHtml = renderDeliverablesScopeCards(parsedTree, currency);
        } else {
            scopeHtml = renderGroupedScopeCards(parsedTree, currency);
        }

        // Tech stack table (web-development only)
        let techHtml = '';
        const tech = service?.techStack;
        if (tech && isWebDev) {
            const rows: Array<[string, string[]]> = (
                [
                    ['Frontend', tech.frontend],
                    ['Backend', tech.backend],
                    ['Database', tech.database],
                    ['Tools', tech.tools],
                ] as Array<[string, unknown]>
            ).filter(([, list]) => Array.isArray(list) && (list as string[]).length > 0) as Array<[string, string[]]>;

            if (rows.length > 0) {
                const techRows = rows.map(([layer, list]) => `
                    <tr>
                      <td class="tech-layer-cell">${esc(layer)}</td>
                      <td class="tech-list-cell">${list.map((t) => `<span class="tech-chip">${esc(t)}</span>`).join('')}</td>
                    </tr>`).join('');

                techHtml = `
                    <div class="tech-stack-card">
                      <div class="card-section-title"><span class="title-tick"></span>Technology Stack</div>
                      <table class="styled-table tech-table">
                        <tbody>${techRows}</tbody>
                      </table>
                    </div>`;
            }
        }

        // Line item pricing breakdown table
        const basePrice = Number(service?.basePrice) || 0;
        const lineItems: any[] = Array.isArray(service?.lineItems) ? service.lineItems : [];
        let serviceUpfrontTotal = basePrice;
        let serviceRecurringTotal = 0;
        const lineRows: string[] = [];

        if (basePrice > 0) {
            lineRows.push(`
              <tr>
                <td class="item-name-cell">Base Project Fee</td>
                <td><span class="billing-badge upfront">One-Time</span></td>
                <td class="num">1</td>
                <td class="num">${formatMoneyPdf(basePrice, currency)}</td>
                <td class="num font-bold">${formatMoneyPdf(basePrice, currency)}</td>
              </tr>`);
        }

        let hasQty = false;
        let hasUnitPrice = false;

        lineItems.forEach((item) => {
            const qty = item.quantity ?? 1;
            if (qty > 1) hasQty = true;
            const itemPrice = Number(item.price) || 0;
            if (itemPrice > 0 && qty > 1) hasUnitPrice = true;
            const lineTotal = itemPrice * qty;

            const upfront = isUpfrontBillingCycle(item.billingCycle || 'one-time');
            if (upfront) {
                serviceUpfrontTotal += lineTotal;
            } else if (item.billingCycle === 'monthly') {
                serviceRecurringTotal += lineTotal;
            }

            lineRows.push(`
              <tr>
                <td class="item-name-cell">
                  <div class="item-title">${esc(item.title)}</div>
                  ${item.description ? `<div class="item-desc">${esc(item.description)}</div>` : ''}
                </td>
                <td><span class="billing-badge ${upfront ? 'upfront' : 'recurring'}">${esc(BILLING_LABELS[item.billingCycle] || item.billingCycle)}</span></td>
                ${hasQty ? `<td class="num">${qty}</td>` : ''}
                ${hasUnitPrice ? `<td class="num">${formatMoneyPdf(itemPrice, currency)}</td>` : ''}
                <td class="num font-bold">${formatMoneyPdf(lineTotal, currency)}</td>
              </tr>`);
        });

        overallUpfrontTotal += serviceUpfrontTotal;
        overallRecurringMonthly += serviceRecurringTotal;

        let pricingHtml = '';
        if (lineRows.length > 0) {
            pricingHtml = `
              <div class="pricing-card">
                <div class="card-section-title"><span class="title-tick"></span>Pricing Breakdown</div>
                <table class="styled-table pricing-table">
                  <thead>
                    <tr>
                      <th>Item &amp; Description</th>
                      <th>Billing</th>
                      ${hasQty ? `<th class="num">Qty</th>` : ''}
                      ${hasUnitPrice ? `<th class="num">Unit Price</th>` : ''}
                      <th class="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${lineRows.join('')}
                  </tbody>
                </table>
              </div>`;
        }

        const sectionNum = String(idx + 1).padStart(2, '0');

        return `
          <div class="service-section">
            <div class="section-header">
              <div class="section-index">${sectionNum}</div>
              <div class="section-heading-wrap">
                <span class="section-kicker">${esc(kicker)}</span>
                <h2 class="section-title">${esc(label)}</h2>
              </div>
            </div>
            ${scopeDescription ? `<p class="section-description">${esc(scopeDescription)}</p>` : ''}
            ${scopeHtml}
            ${techHtml}
            ${pricingHtml}
          </div>`;
    }).join('');

    // Financial Summary calculation
    const grandTotalVal = Number(totals.grandTotal || overallUpfrontTotal);
    const subtotalVal = Number(totals.subtotal || overallUpfrontTotal);
    const discountVal = Number(totals.discountAmount || 0);
    const taxVal = Number(totals.taxAmount || 0);

    const summaryRows = `
        <tr>
          <td class="summary-label">One-Time Project Investment</td>
          <td class="num summary-value">${formatMoneyPdf(subtotalVal, currency)}</td>
        </tr>
        ${discountVal > 0 ? `
        <tr>
          <td class="summary-label text-rose">Applied Discount</td>
          <td class="num summary-value text-rose">− ${formatMoneyPdf(discountVal, currency)}</td>
        </tr>` : ''}
        ${taxVal > 0 ? `
        <tr>
          <td class="summary-label">Tax / VAT</td>
          <td class="num summary-value">${formatMoneyPdf(taxVal, currency)}</td>
        </tr>` : ''}`;

    const investmentSummaryHtml = `
      <div class="financial-summary-card">
        <div class="financial-summary-header">
          <div class="summary-header-left">
            <div class="summary-kicker">Investment</div>
            <h3 class="summary-card-title">Financial Summary</h3>
          </div>
          <span class="currency-tag">${esc(currency)}</span>
        </div>
        <table class="summary-table">
          <tbody>
            ${summaryRows}
          </tbody>
        </table>
        <div class="grand-total-panel">
          <div class="grand-total-left">
            <div class="grand-total-label">Total Initial Investment</div>
            <div class="grand-total-sub">One-time · due per milestone schedule</div>
          </div>
          <div class="grand-total-amount">${formatMoneyPdf(grandTotalVal, currency)}</div>
        </div>
        ${overallRecurringMonthly > 0 ? `
        <div class="recurring-panel">
          <div class="recurring-left">
            <span class="recurring-dot"></span>
            <span class="recurring-text">Recurring Monthly Costs</span>
          </div>
          <div class="recurring-amount">${formatMoneyPdf(overallRecurringMonthly, currency)} <span class="recurring-per">/ mo</span></div>
        </div>` : ''}
      </div>`;

    const notIncludedHtml = notIncludedItems.map((item: string) => `
        <li class="info-list-item">
          <span class="info-icon red">✕</span>
          <span class="info-text">${esc(item)}</span>
        </li>`).join('');

    const clientReqHtml = clientRequirements.map((item: string) => `
        <li class="info-list-item">
          <span class="info-icon indigo">✓</span>
          <span class="info-text">${esc(item)}</span>
        </li>`).join('');

    const paymentMilestones = Array.isArray(q.paymentMilestones) ? q.paymentMilestones : [];
    const defaultMilestones = [
        { label: '50% Upfront Deposit (Project Kickoff)', percentage: 50 },
        { label: '50% Final Delivery & Handover', percentage: 50 },
    ];
    const milestonesToUse = paymentMilestones.length > 0 ? paymentMilestones : defaultMilestones;

    const paymentMilestonesHtml = milestonesToUse.map((m: any) => `
        <li class="info-list-item">
          <span class="info-icon purple">◆</span>
          <span class="info-text">
            <strong>${esc(m.label)}</strong>
            ${m.percentage ? `<span class="milestone-badge">${m.percentage}%</span>` : ''}
          </span>
        </li>`).join('');

    // Company contact line for the hero footer strip.
    const heroContactBits = [companyEmail, companyPhone, companyWebsite]
        .filter(Boolean)
        .map((v) => `<span class="hero-contact-bit">${esc(v)}</span>`)
        .join('<span class="hero-contact-sep">•</span>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quotation #${esc(quotationNo)} - ${esc(proposalTitle)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

    :root {
      --brand: #4e12d4;
      --brand-2: #7b2ff7;
      --accent: #c850fa;
      --brand-soft: rgba(78, 18, 212, 0.06);
      --brand-softer: rgba(78, 18, 212, 0.035);
      --brand-border: rgba(78, 18, 212, 0.16);
      --accent-soft: rgba(200, 80, 250, 0.10);
      --accent-border: rgba(200, 80, 250, 0.22);
      --grad: linear-gradient(120deg, #4e12d4 0%, #7b2ff7 52%, #c850fa 100%);

      --ink: #0b0a1f;
      --slate900: #0f172a;
      --slate800: #1e293b;
      --slate700: #334155;
      --slate600: #475569;
      --slate500: #64748b;
      --slate400: #94a3b8;
      --slate300: #cbd5e1;
      --slate200: #e2e8f0;
      --slate100: #f1f5f9;
      --slate50: #f8fafc;
      --paper-tint: #fbfaff;
      --rose: #e11d48;
      --emerald: #059669;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--slate800);
      background-color: #ffffff;
      font-size: 11px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-font-smoothing: antialiased;
    }

    .container { width: 100%; padding: 0; }

    .mono { font-family: 'JetBrains Mono', monospace; }

    /* ── Masthead ─────────────────────────────────────────── */
    .masthead {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      margin-bottom: 20px;
      position: relative;
    }
    .masthead::after {
      content: '';
      position: absolute;
      left: 0; right: 0; bottom: 0;
      height: 2px;
      background: var(--grad);
      border-radius: 2px;
    }
    .brand-lockup { display: flex; align-items: center; gap: 12px; }
    .logo-img { height: 42px; width: auto; object-fit: contain; }
    .brand-name-block { display: flex; flex-direction: column; }
    .brand-name {
      font-size: 14px; font-weight: 800; color: var(--slate900);
      letter-spacing: -0.01em; line-height: 1.1;
    }
    .brand-tag {
      font-size: 8.5px; font-weight: 700; letter-spacing: 0.16em;
      text-transform: uppercase; color: var(--slate400); margin-top: 2px;
    }
    .meta-box { text-align: right; }
    .official-badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 8.5px; font-weight: 800; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--brand);
      background: var(--brand-soft); border: 1px solid var(--brand-border);
      padding: 3px 10px; border-radius: 9999px; margin-bottom: 7px;
    }
    .badge-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--grad); }
    .qtn-number {
      font-size: 19px; font-weight: 700; color: var(--slate900);
      font-family: 'JetBrains Mono', monospace; letter-spacing: -0.02em;
    }
    .meta-dates { font-size: 10px; color: var(--slate500); margin-top: 5px; }
    .meta-dates strong { color: var(--slate700); font-weight: 600; }
    .valid-until { color: var(--rose) !important; font-weight: 700; }

    /* ── Hero ─────────────────────────────────────────────── */
    .hero {
      position: relative;
      overflow: hidden;
      border-radius: 18px;
      padding: 30px 34px;
      margin-bottom: 26px;
      color: #ffffff;
      background:
        radial-gradient(115% 130% at 100% 0%, rgba(200, 80, 250, 0.28) 0%, rgba(200,80,250,0) 46%),
        radial-gradient(120% 140% at 0% 100%, rgba(78, 18, 212, 0.42) 0%, rgba(78,18,212,0) 52%),
        linear-gradient(135deg, #0b0a1f 0%, #1a1145 58%, #241063 100%);
      box-shadow: 0 18px 40px -14px rgba(15, 10, 45, 0.5);
    }
    .hero-glow {
      position: absolute; top: -60px; right: -40px;
      width: 220px; height: 220px; border-radius: 50%;
      background: radial-gradient(circle, rgba(200,80,250,0.35) 0%, rgba(200,80,250,0) 70%);
    }
    .hero-top {
      display: flex; justify-content: space-between;
      align-items: flex-start; gap: 24px; position: relative;
    }
    .hero-left { flex: 1; min-width: 0; }
    .hero-kicker {
      display: inline-block;
      font-size: 9px; font-weight: 800; letter-spacing: 0.2em;
      text-transform: uppercase;
      background: linear-gradient(90deg, #d8b4fe, #f0abfc);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    .hero-title {
      font-size: 27px; font-weight: 900; line-height: 1.18;
      letter-spacing: -0.025em; color: #ffffff;
      max-width: 380px;
    }
    .hero-underline {
      width: 56px; height: 3px; border-radius: 3px; margin-top: 14px;
      background: linear-gradient(90deg, #c850fa, #7b2ff7);
    }
    .client-card {
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      padding: 16px 18px;
      min-width: 210px;
      max-width: 240px;
    }
    .client-label {
      font-size: 8.5px; font-weight: 800; letter-spacing: 0.16em;
      text-transform: uppercase; color: #c4b5fd; margin-bottom: 8px;
    }
    .client-name { font-size: 15px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em; }
    .client-company { font-size: 11px; color: #cbd5e1; margin-top: 3px; }
    .client-contact {
      font-size: 9.5px; color: #a5b4cf; margin-top: 8px;
      padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.12);
      font-family: 'JetBrains Mono', monospace; word-break: break-all;
    }
    .client-contact div { margin-top: 2px; }
    .hero-footer {
      position: relative;
      margin-top: 22px; padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      display: flex; justify-content: space-between; align-items: center;
      font-size: 9.5px; color: #b9b4d6;
    }
    .hero-contact-strip { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .hero-contact-bit { color: #d6d2ef; font-weight: 500; }
    .hero-contact-sep { color: rgba(255,255,255,0.28); }
    .hero-prepared-by { color: #9d97c2; }
    .hero-prepared-by strong { color: #e6e3f7; font-weight: 700; }

    /* ── Executive Overview ───────────────────────────────── */
    .overview-card {
      position: relative;
      background: linear-gradient(180deg, var(--paper-tint), #ffffff);
      border: 1px solid var(--slate200);
      border-radius: 14px;
      padding: 18px 22px 18px 26px;
      margin-bottom: 30px;
    }
    .overview-card::before {
      content: '';
      position: absolute; left: 0; top: 14px; bottom: 14px;
      width: 4px; border-radius: 4px; background: var(--grad);
    }
    .overview-title {
      font-size: 10px; font-weight: 800; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--brand);
      margin-bottom: 8px; display: flex; align-items: center; gap: 7px;
    }
    .overview-title .quote-mark {
      font-family: 'JetBrains Mono', monospace; font-size: 14px;
      color: var(--accent); line-height: 1;
    }
    .overview-text {
      font-size: 11.5px; color: var(--slate700); line-height: 1.65;
      white-space: pre-line;
    }

    /* ── Section Header ───────────────────────────────────── */
    .service-section { margin-bottom: 34px; page-break-inside: auto; }
    .section-header {
      display: flex; align-items: center; gap: 14px;
      margin-bottom: 16px; padding-bottom: 12px;
      border-bottom: 1px solid var(--slate200);
    }
    .section-index {
      flex-shrink: 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 26px; font-weight: 700; line-height: 1;
      color: transparent;
      background: var(--grad);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .section-heading-wrap { display: flex; flex-direction: column; }
    .section-kicker {
      font-size: 8.5px; font-weight: 800; letter-spacing: 0.16em;
      text-transform: uppercase; color: var(--slate400); margin-bottom: 2px;
    }
    .section-title {
      font-size: 17px; font-weight: 800; color: var(--slate900);
      letter-spacing: -0.015em; line-height: 1.15;
    }
    .section-description {
      font-size: 11.5px; color: var(--slate600);
      margin-bottom: 16px; line-height: 1.65;
    }

    /* ── Module Cards ─────────────────────────────────────── */
    .module-card {
      background: #ffffff;
      border: 1px solid var(--slate200);
      border-radius: 13px;
      overflow: hidden;
      margin-bottom: 13px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      page-break-inside: auto; break-inside: auto;
    }
    .module-card-header {
      page-break-after: avoid; break-after: avoid;
      background: linear-gradient(180deg, #ffffff 0%, var(--slate50) 100%);
      padding: 12px 18px;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--slate200);
    }
    .module-header-left { display: flex; align-items: center; gap: 11px; }
    .module-num {
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border-radius: 7px;
      background: var(--grad); color: #ffffff;
      font-size: 10px; font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      box-shadow: 0 2px 6px -1px rgba(78, 18, 212, 0.4);
    }
    .module-title { font-size: 13.5px; font-weight: 700; color: var(--slate900); letter-spacing: -0.01em; }
    .module-price-tag {
      font-size: 12px; font-weight: 800; color: var(--brand);
      background: var(--brand-soft); border: 1px solid var(--brand-border);
      padding: 4px 11px; border-radius: 9999px;
      font-family: 'JetBrains Mono', monospace;
    }
    .module-route-bar {
      background: var(--slate50);
      padding: 6px 18px; border-bottom: 1px solid var(--slate200);
      font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--slate600);
    }
    .module-card-body { padding: 13px 18px; }

    /* ── Feature Hierarchy ────────────────────────────────── */
    .child-features-list { list-style: none; padding-left: 0; margin: 0; }
    .child-features-list.level-2 {
      border-left: 1.5px solid var(--slate200);
      margin-left: 2.25px; padding-left: 14px;
      margin-top: 5px; margin-bottom: 5px;
    }
    .child-features-list.level-3,
    .child-features-list.level-4 {
      border-left: 1.5px solid var(--slate200);
      margin-left: 1.75px; padding-left: 12px;
      margin-top: 4px; margin-bottom: 4px;
    }
    .child-feature-item {
      list-style: none; position: relative;
      page-break-inside: avoid; break-inside: avoid;
    }
    .child-feature-item.level-1 {
      padding: 8px 0; border-bottom: 1px dashed var(--slate200);
    }
    .child-feature-item.level-1:last-child { border-bottom: none; }
    .child-feature-item.level-2 { padding: 4px 0; }
    .child-feature-item.level-3,
    .child-feature-item.level-4 { padding: 3px 0; }
    .child-feature-main { display: flex; justify-content: space-between; align-items: center; }
    .child-feature-left { display: flex; align-items: center; gap: 9px; }
    .bullet-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--grad); flex-shrink: 0;
    }
    .child-feature-item.level-2 > .child-feature-main .bullet-dot {
      width: 5px; height: 5px; background: transparent; border: 1.2px solid var(--accent);
    }
    .child-feature-item.level-3 > .child-feature-main .bullet-dot,
    .child-feature-item.level-4 > .child-feature-main .bullet-dot {
      width: 4px; height: 4px; background: var(--slate400); border: none;
    }
    .child-feature-item.level-1 > .child-feature-main .child-feature-name {
      font-size: 11.5px; font-weight: 600; color: var(--slate800);
    }
    .child-feature-item.level-2 > .child-feature-main .child-feature-name {
      font-size: 11px; font-weight: 500; color: var(--slate700);
    }
    .child-feature-item.level-3 > .child-feature-main .child-feature-name,
    .child-feature-item.level-4 > .child-feature-main .child-feature-name {
      font-size: 10px; font-weight: 400; color: var(--slate600);
    }
    .child-price {
      font-size: 11px; font-weight: 700; color: var(--slate700);
      font-family: 'JetBrains Mono', monospace;
    }
    .child-route-tag {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 4px; margin-left: 15px;
      font-size: 9.5px; color: var(--slate500);
      font-family: 'JetBrains Mono', monospace;
      background: var(--slate100); padding: 2px 7px;
      border-radius: 5px; width: fit-content; word-break: break-all;
    }
    .child-route-tag .route-icon { color: var(--accent); font-weight: 700; }

    /* ── Deliverable Cards ────────────────────────────────── */
    .deliverable-card {
      background: #ffffff; border: 1px solid var(--slate200);
      border-radius: 13px; overflow: hidden; margin-bottom: 13px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      page-break-inside: auto; break-inside: auto;
    }
    .deliverable-card-header {
      page-break-after: avoid; break-after: avoid;
      padding: 12px 18px;
      background: linear-gradient(180deg, #ffffff 0%, var(--slate50) 100%);
      border-bottom: 1px solid var(--slate200);
      display: flex; justify-content: space-between; align-items: center;
    }
    .deliverable-category-title { font-size: 13px; font-weight: 700; color: var(--slate900); letter-spacing: -0.01em; }
    .deliverable-price-badge {
      font-size: 12px; font-weight: 800; color: var(--brand);
      background: var(--brand-soft); border: 1px solid var(--brand-border);
      padding: 4px 11px; border-radius: 9999px;
      font-family: 'JetBrains Mono', monospace;
    }
    .deliverable-card-body { padding: 14px 18px; }
    .deliverables-sublabel {
      font-size: 8.5px; font-weight: 800; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--slate400); margin-bottom: 11px;
    }
    .deliverables-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .deliverable-item {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; color: var(--slate700);
    }
    .deliverable-name { flex: 1; }
    .deliv-item-price {
      font-family: 'JetBrains Mono', monospace; font-weight: 700;
      font-size: 10.5px; color: var(--slate700);
    }
    .check-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 15px; height: 15px; border-radius: 50%; flex-shrink: 0;
      background: rgba(5, 150, 105, 0.12); color: var(--emerald);
      font-weight: 800; font-size: 9px;
    }

    /* ── Tech Stack ───────────────────────────────────────── */
    .tech-stack-card {
      background: #ffffff; border: 1px solid var(--slate200);
      border-radius: 13px; padding: 14px 18px;
      margin-top: 13px; margin-bottom: 13px;
      page-break-inside: avoid !important; break-inside: avoid !important;
    }
    .card-section-title {
      font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--brand);
      margin-bottom: 11px; display: flex; align-items: center; gap: 7px;
    }
    .title-tick {
      display: inline-block; width: 12px; height: 2px;
      border-radius: 2px; background: var(--grad);
    }
    .styled-table { width: 100%; border-collapse: collapse; }
    .tech-table td { padding: 7px 0; border-bottom: 1px solid var(--slate100); vertical-align: top; }
    .tech-table tr:last-child td { border-bottom: none; }
    .tech-layer-cell { font-weight: 700; color: var(--slate800); width: 110px; font-size: 11px; }
    .tech-chip {
      display: inline-block; background: var(--slate100); color: var(--slate700);
      font-size: 10px; font-weight: 600; padding: 3px 9px;
      border-radius: 7px; margin-right: 5px; margin-bottom: 3px;
      border: 1px solid var(--slate200);
    }

    /* ── Pricing Table ────────────────────────────────────── */
    .pricing-card {
      background: #ffffff; border: 1px solid var(--slate200);
      border-radius: 13px; padding: 14px 18px;
      margin-top: 13px; margin-bottom: 18px;
      page-break-inside: avoid !important; break-inside: avoid !important;
    }
    .pricing-table th {
      text-align: left; font-size: 8.5px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.08em; color: var(--slate500);
      padding: 8px 10px; background: var(--slate50);
      border-bottom: 1px solid var(--slate200);
    }
    .pricing-table th:first-child { border-top-left-radius: 8px; }
    .pricing-table th:last-child { border-top-right-radius: 8px; }
    .pricing-table td { padding: 9px 10px; border-bottom: 1px solid var(--slate100); font-size: 11px; }
    .pricing-table tbody tr:last-child td { border-bottom: none; }
    .pricing-table th.num, .pricing-table td.num {
      text-align: right; font-family: 'JetBrains Mono', monospace;
    }
    .item-title { font-weight: 600; color: var(--slate800); }
    .item-desc { font-size: 10px; color: var(--slate500); margin-top: 2px; }
    .font-bold { font-weight: 800 !important; color: var(--slate900); }
    .billing-badge {
      display: inline-block; padding: 2px 9px; border-radius: 9999px;
      font-size: 8.5px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .billing-badge.upfront { background: var(--brand-soft); color: var(--brand); border: 1px solid var(--brand-border); }
    .billing-badge.recurring { background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent-border); }

    /* ── Financial Summary ────────────────────────────────── */
    .financial-summary-card {
      background: #ffffff;
      border: 1px solid var(--brand-border);
      border-radius: 16px; overflow: hidden;
      margin-bottom: 26px;
      page-break-inside: avoid !important; break-inside: avoid !important;
      box-shadow: 0 8px 24px -10px rgba(78, 18, 212, 0.22);
    }
    .financial-summary-header {
      background: linear-gradient(135deg, var(--brand-softer) 0%, var(--accent-soft) 100%);
      padding: 14px 22px;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--brand-border);
    }
    .summary-kicker {
      font-size: 8.5px; font-weight: 800; letter-spacing: 0.16em;
      text-transform: uppercase; color: var(--accent); margin-bottom: 3px;
    }
    .summary-card-title { font-size: 14px; font-weight: 800; color: var(--slate900); letter-spacing: -0.01em; }
    .currency-tag {
      font-size: 10px; font-weight: 700; color: var(--slate600);
      background: #ffffff; padding: 4px 11px; border-radius: 8px;
      border: 1px solid var(--slate200);
      font-family: 'JetBrains Mono', monospace;
    }
    .summary-table { width: 100%; border-collapse: collapse; }
    .summary-table td { padding: 11px 22px; border-bottom: 1px solid var(--slate100); font-size: 11.5px; }
    .summary-table tr:last-child td { border-bottom: none; }
    .summary-label { font-weight: 600; color: var(--slate600); }
    .summary-value { font-weight: 700; color: var(--slate900); font-family: 'JetBrains Mono', monospace; text-align: right; }
    .text-rose { color: var(--rose) !important; }

    .grand-total-panel {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 22px; color: #ffffff;
      background:
        radial-gradient(120% 180% at 100% 0%, rgba(200,80,250,0.35) 0%, rgba(200,80,250,0) 55%),
        linear-gradient(120deg, #4e12d4 0%, #6d28d9 55%, #7b2ff7 100%);
    }
    .grand-total-label {
      font-size: 12.5px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em;
    }
    .grand-total-sub { font-size: 9px; color: #d8ccff; margin-top: 3px; letter-spacing: 0.02em; }
    .grand-total-amount {
      font-size: 22px; font-weight: 900; color: #ffffff;
      font-family: 'JetBrains Mono', monospace; letter-spacing: -0.02em;
    }
    .recurring-panel {
      display: flex; justify-content: space-between; align-items: center;
      padding: 11px 22px;
      background: var(--accent-soft);
      border-top: 1px solid var(--accent-border);
    }
    .recurring-left { display: flex; align-items: center; gap: 8px; }
    .recurring-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
    .recurring-text { font-size: 11px; font-weight: 700; color: var(--accent); }
    .recurring-amount {
      font-size: 13px; font-weight: 800; color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
    }
    .recurring-per { font-size: 10px; font-weight: 600; }

    /* ── Three Info Cards ─────────────────────────────────── */
    .three-cards-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px;
      margin-bottom: 26px;
      page-break-inside: avoid !important; break-inside: avoid !important;
    }
    .info-card { border-radius: 13px; padding: 16px 15px; }
    .info-card.rose { background: linear-gradient(180deg, #fff5f6, #fff1f2); border: 1px solid #fecdd3; }
    .info-card.indigo { background: linear-gradient(180deg, #f3fdf6, #f0fdf4); border: 1px solid #bbf7d0; }
    .info-card.purple { background: linear-gradient(180deg, var(--paper-tint), var(--brand-soft)); border: 1px solid var(--brand-border); }
    .card-heading {
      font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em;
      text-transform: uppercase; margin-bottom: 11px; padding-bottom: 9px;
      display: flex; align-items: center; gap: 7px;
    }
    .card-heading.rose { color: var(--rose); border-bottom: 1px solid #fecdd3; }
    .card-heading.indigo { color: #16a34a; border-bottom: 1px solid #bbf7d0; }
    .card-heading.purple { color: var(--brand); border-bottom: 1px solid var(--brand-border); }
    .card-heading .head-glyph {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px; border-radius: 5px; font-size: 9px;
    }
    .card-heading.rose .head-glyph { background: rgba(225,29,72,0.12); }
    .card-heading.indigo .head-glyph { background: rgba(22,163,74,0.12); }
    .card-heading.purple .head-glyph { background: var(--brand-soft); }
    .info-list { list-style: none; }
    .info-list-item {
      display: flex; align-items: flex-start; gap: 7px;
      font-size: 10.5px; color: var(--slate700);
      margin-bottom: 8px; line-height: 1.45;
    }
    .info-list-item:last-child { margin-bottom: 0; }
    .info-icon { font-weight: 800; flex-shrink: 0; margin-top: 0.5px; }
    .info-icon.red { color: var(--rose); }
    .info-icon.indigo { color: #16a34a; }
    .info-icon.purple { color: var(--brand); }
    .milestone-badge {
      display: inline-block; font-size: 8.5px; font-weight: 800;
      background: #ffffff; color: var(--brand); border: 1px solid var(--brand-border);
      padding: 1px 7px; border-radius: 5px; margin-left: 5px;
      font-family: 'JetBrains Mono', monospace;
    }

    /* ── Authorization ────────────────────────────────────── */
    .auth-card {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, #0b0a1f 0%, #1a1145 100%);
      color: #ffffff; border-radius: 16px;
      padding: 20px 26px;
      display: flex; justify-content: space-between; align-items: flex-end; gap: 24px;
      page-break-inside: avoid !important; break-inside: avoid !important;
    }
    .auth-glow {
      position: absolute; bottom: -50px; left: -30px;
      width: 180px; height: 180px; border-radius: 50%;
      background: radial-gradient(circle, rgba(78,18,212,0.4) 0%, rgba(78,18,212,0) 70%);
    }
    .auth-left { position: relative; max-width: 320px; }
    .auth-title {
      font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em;
      text-transform: uppercase; color: #c4b5fd;
      margin-bottom: 8px; display: flex; align-items: center; gap: 6px;
    }
    .auth-desc { font-size: 10.5px; color: #cbd5e1; line-height: 1.55; }
    .auth-desc strong { color: #ffffff; font-weight: 700; }
    .auth-right { position: relative; }
    .sig-container { text-align: center; }
    .sig-img { height: 46px; width: auto; object-fit: contain; margin-bottom: 4px; filter: brightness(0) invert(1); opacity: 0.92; }
    .sig-line { width: 180px; border-top: 1.5px solid rgba(255,255,255,0.55); padding-top: 7px; }
    .sig-label {
      font-size: 10px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.06em;
      background: linear-gradient(90deg, #d8b4fe, #f0abfc);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .sig-company-name { font-size: 10px; color: #a5b4cf; margin-top: 1px; }

    /* ── Thank-you strip ──────────────────────────────────── */
    .thankyou-strip {
      text-align: center; margin-top: 20px;
      font-size: 10px; color: var(--slate400); letter-spacing: 0.02em;
    }
    .thankyou-strip strong { color: var(--brand); font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">

    <!-- Masthead -->
    <div class="masthead">
      <div class="brand-lockup">
        <img src="${esc(ctx.logoSrc)}" alt="Company Logo" class="logo-img" />
        <div class="brand-name-block">
          <span class="brand-name">${esc(companyName)}</span>
          <span class="brand-tag">Digital Solutions</span>
        </div>
      </div>
      <div class="meta-box">
        <div class="official-badge"><span class="badge-dot"></span>Official Quotation</div>
        <div class="qtn-number">#${esc(quotationNo)}</div>
        <div class="meta-dates">Issued <strong>${esc(issueDate)}</strong></div>
        <div class="meta-dates">Valid Until <strong class="valid-until">${esc(validUntilStr)}</strong></div>
      </div>
    </div>

    <!-- Hero -->
    <div class="hero">
      <div class="hero-glow"></div>
      <div class="hero-top">
        <div class="hero-left">
          <span class="hero-kicker">Proposal Package</span>
          <h1 class="hero-title">${esc(proposalTitle)}</h1>
          <div class="hero-underline"></div>
        </div>
        <div class="client-card">
          <div class="client-label">Prepared For</div>
          <div class="client-name">${esc(clientName)}</div>
          ${clientCompany ? `<div class="client-company">${esc(clientCompany)}</div>` : ''}
          ${(clientEmail || clientPhone) ? `<div class="client-contact">
            ${clientEmail ? `<div>${esc(clientEmail)}</div>` : ''}
            ${clientPhone ? `<div>${esc(clientPhone)}</div>` : ''}
          </div>` : ''}
        </div>
      </div>
      <div class="hero-footer">
        <div class="hero-contact-strip">${heroContactBits || `<span class="hero-contact-bit">${esc(companyName)}</span>`}</div>
        <div class="hero-prepared-by">Prepared by <strong>${esc(companyName)}</strong></div>
      </div>
    </div>

    <!-- Executive Overview -->
    ${globalOverview ? `
    <div class="overview-card">
      <div class="overview-title"><span class="quote-mark">&ldquo;</span>Executive Summary &amp; Overview</div>
      <div class="overview-text">${esc(globalOverview)}</div>
    </div>` : ''}

    <!-- Service Sections -->
    <div class="sections-container">
      ${modulesHtml}
    </div>

    <!-- Financial Summary -->
    ${investmentSummaryHtml}

    <!-- Three Info Cards -->
    <div class="three-cards-grid">
      <div class="info-card rose">
        <div class="card-heading rose"><span class="head-glyph">✕</span>Not Included in Price</div>
        <ul class="info-list">${notIncludedHtml}</ul>
      </div>
      <div class="info-card indigo">
        <div class="card-heading indigo"><span class="head-glyph">✓</span>Client Needs to Provide</div>
        <ul class="info-list">${clientReqHtml}</ul>
      </div>
      <div class="info-card purple">
        <div class="card-heading purple"><span class="head-glyph">◆</span>Payment Terms &amp; Milestones</div>
        <ul class="info-list">${paymentMilestonesHtml}</ul>
      </div>
    </div>

    <!-- Authorization & Signature -->
    <div class="auth-card">
      <div class="auth-glow"></div>
      <div class="auth-left">
        <div class="auth-title">🛡 Authorization &amp; Validity</div>
        <div class="auth-desc">
          This quotation is valid until <strong>${esc(validUntilStr)}</strong>. Upon acceptance, formal project execution will commence as per the agreed milestone schedule.
        </div>
      </div>
      <div class="auth-right">
        <div class="sig-container">
          ${ctx.signatureSrc ? `<img src="${esc(ctx.signatureSrc)}" alt="Authorized Signature" class="sig-img" />` : '<div style="height: 46px;"></div>'}
          <div class="sig-line">
            <div class="sig-label">Authorized Signature</div>
            <div class="sig-company-name">${esc(companyName)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="thankyou-strip">
      Thank you for the opportunity to partner with you. — <strong>${esc(companyName)}</strong>
    </div>

  </div>
</body>
</html>`;
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

        const signatureUrl = process.env.COMPANY_SIGNATURE_URL || DEFAULT_SIGNATURE;
        const companyLogoRemote = ((q as any).company?.logo as string) || DEFAULT_LOGO;

        let logoSrc = (await fetchImageAsDataUrl(companyLogoRemote)) || (await fetchImageAsDataUrl(DEFAULT_LOGO));
        if (!logoSrc) logoSrc = FALLBACK_PIXEL_PNG;

        let signatureSrc = (await fetchImageAsDataUrl(signatureUrl)) || '';

        const html = buildPrintHtml(q as Record<string, any>, {
            logoSrc,
            signatureSrc,
        });

        const browser = await getBrowserInstance();
        const page = await browser.newPage();
        try {
            await page.setContent(html, { waitUntil: 'load' });
            await page.emulateMediaType('print');

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: '<span></span>',
                footerTemplate: `
                    <div style="font-family: 'Inter', Arial, sans-serif; font-size: 8.5px; color: #64748b; width: 100%; padding: 0 10mm; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; border-top: 1px solid #e2e8f0; padding-top: 5px;">
                        <div>This is a computer-generated quotation document. No signature required.</div>
                        <div style="font-weight: 600;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
                    </div>
                `,
                margin: {
                    top: '12mm',
                    bottom: '22mm',
                    left: '10mm',
                    right: '10mm',
                },
            });

            const qn = String((q as any).quotationNumber || '').trim();
            const title = String((q as any).details?.title || '').trim();
            const stem = qn ? (qn.startsWith('#') ? qn : `#${qn}`) : title || 'quotation';
            const rawName = `${stem}.pdf`;
            const filename = rawName.replace(/[/\\?%*:|"<>]/g, '-');
            return { buffer: Buffer.from(pdf), filename };
        } catch (e: unknown) {
            const err = e as { message?: string };
            logger.error(
                { err: e, quotationId },
                'quotation.puppeteer_pdf_failed',
            );
            throw new AppError(
                err?.message || 'Failed to generate PDF with Puppeteer',
                500,
            );
        } finally {
            await page.close().catch(() => {});
        }
    }
}
