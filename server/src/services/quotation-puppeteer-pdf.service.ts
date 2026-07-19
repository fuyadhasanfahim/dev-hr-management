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
                        <span class="route-icon">⚡</span>
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

function buildPrintHtml(
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
        const isWebDev = categoryKey === 'web-development';
        const isMarketing = categoryKey === 'marketing';

        const rawScopeDesc = String(service?.scopeDescription || '').trim();
        const isLorem = rawScopeDesc.toLowerCase().includes('lorem ipsum');
        const isDuplicateOverview = rawScopeDesc === globalOverview;
        const scopeDescription = (rawScopeDesc && !isLorem && !isDuplicateOverview) ? rawScopeDesc : '';

        const rawItems = Array.isArray(service?.scopeItems)
            ? service.scopeItems.map((x: any) => String(x || '').trim()).filter(Boolean)
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
                      <div class="card-section-title">Technology Stack</div>
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
                <div class="card-section-title">Pricing Breakdown</div>
                <table class="styled-table pricing-table">
                  <thead>
                    <tr>
                      <th>Item & Description</th>
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
              <span class="section-badge">SECTION ${sectionNum}</span>
              <h2 class="section-title">${esc(label)}</h2>
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

    const investmentSummaryHtml = `
      <div class="financial-summary-card">
        <div class="financial-summary-header">
          <h3 class="summary-card-title">Financial Investment Summary</h3>
          <span class="currency-tag">${esc(currency)}</span>
        </div>
        <table class="summary-table">
          <tbody>
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
            </tr>` : ''}
            <tr class="grand-total-row">
              <td class="summary-label grand-label">Total Initial Investment</td>
              <td class="num summary-value grand-value">${formatMoneyPdf(grandTotalVal, currency)}</td>
            </tr>
            ${overallRecurringMonthly > 0 ? `
            <tr class="recurring-row">
              <td class="summary-label recurring-label">Recurring Monthly Costs</td>
              <td class="num summary-value recurring-value">${formatMoneyPdf(overallRecurringMonthly, currency)} / mo</td>
            </tr>` : ''}
          </tbody>
        </table>
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

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quotation #${esc(quotationNo)} - ${esc(proposalTitle)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
      --primary: #4e12d4;
      --primary-light: rgba(78, 18, 212, 0.05);
      --primary-border: rgba(78, 18, 212, 0.18);
      --accent: #c850fa;
      --slate900: #0f172a;
      --slate800: #1e293b;
      --slate700: #334155;
      --slate600: #475569;
      --slate500: #64748b;
      --slate400: #94a3b8;
      --slate200: #e2e8f0;
      --slate100: #f1f5f9;
      --slate50: #f8fafc;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--slate800);
      background-color: #ffffff;
      font-size: 11px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
    }

    .container {
      width: 100%;
      padding: 0;
    }

    /* First Page Cover Header */
    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 2px solid var(--slate100);
      margin-bottom: 24px;
    }
    .logo-img {
      height: 40px;
      width: auto;
      object-fit: contain;
    }
    .meta-box {
      text-align: right;
    }
    .official-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--primary);
      background: var(--primary-light);
      border: 1px solid var(--primary-border);
      padding: 3px 10px;
      border-radius: 9999px;
      margin-bottom: 6px;
    }
    .qtn-number {
      font-size: 18px;
      font-weight: 800;
      color: var(--slate900);
      font-family: 'JetBrains Mono', monospace;
    }
    .meta-dates {
      font-size: 10.5px;
      color: var(--slate500);
      margin-top: 4px;
    }
    .valid-until {
      color: #e11d48;
      font-weight: 600;
    }

    /* Main Proposal Card */
    .proposal-card {
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      color: #ffffff;
      border-radius: 16px;
      padding: 24px 28px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.2);
    }
    .proposal-title-label {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 6px;
    }
    .proposal-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      line-height: 1.25;
    }
    .client-card-box {
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 14px 18px;
      min-width: 220px;
      text-align: right;
    }
    .client-label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #93c5fd;
      margin-bottom: 4px;
    }
    .client-name {
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
    }
    .client-company {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 2px;
    }
    .client-email {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Executive Overview Block */
    .overview-card {
      background-color: var(--slate50);
      border: 1px solid var(--slate200);
      border-left: 4px solid var(--primary);
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 28px;
    }
    .overview-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--primary);
      margin-bottom: 6px;
    }
    .overview-text {
      font-size: 11.5px;
      color: var(--slate700);
      line-height: 1.6;
      white-space: pre-line;
    }

    /* Section Styling */
    .service-section {
      margin-bottom: 32px;
      page-break-inside: auto;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      border-bottom: 2px solid var(--slate100);
      padding-bottom: 8px;
    }
    .section-badge {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: var(--primary);
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--slate900);
      letter-spacing: -0.01em;
    }
    .section-description {
      font-size: 11.5px;
      color: var(--slate600);
      margin-bottom: 16px;
      line-height: 1.6;
    }

    /* Level 1 Grouped Module Cards */
    .module-card {
      background: #ffffff;
      border: 1px solid var(--slate200);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 14px;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.02);
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .module-card-header {
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--slate200);
    }
    .module-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .module-num {
      display: flex;
      align-items: center;
      justify-content: center;
      size: 22px;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: var(--primary);
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
    }
    .module-title {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--slate900);
    }
    .module-price-tag {
      font-size: 12px;
      font-weight: 800;
      color: var(--primary);
      background: var(--primary-light);
      border: 1px solid var(--primary-border);
      padding: 3px 10px;
      border-radius: 9999px;
      font-family: 'JetBrains Mono', monospace;
    }
    .module-route-bar {
      background: var(--slate50);
      padding: 6px 18px;
      border-bottom: 1px solid var(--slate200);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--slate600);
    }
    .module-card-body {
      padding: 12px 18px;
    }

    /* Child Features Hierarchy */
    .child-features-list {
      list-style: none;
    }
    .child-feature-item {
      padding: 7px 0;
      border-bottom: 1px border-dashed var(--slate100);
    }
    .child-feature-item:last-child {
      border-bottom: none;
    }
    .child-feature-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .child-feature-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bullet-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--accent);
      flex-shrink: 0;
    }
    .child-feature-name {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--slate800);
    }
    .child-price {
      font-size: 11px;
      font-weight: 700;
      color: var(--slate700);
      font-family: 'JetBrains Mono', monospace;
    }
    .child-route-tag {
      margin-top: 3px;
      margin-left: 13px;
      font-size: 9.5px;
      color: var(--slate500);
      font-family: 'JetBrains Mono', monospace;
      background: var(--slate100);
      padding: 2px 6px;
      border-radius: 4px;
      width: fit-content;
      word-break: break-all;
    }

    /* Deliverable Cards (Marketing / Creative) */
    .deliverable-card {
      background: #ffffff;
      border: 1px solid var(--slate200);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 14px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .deliverable-card-header {
      padding: 12px 18px;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom: 1px solid var(--slate200);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .deliverable-category-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--slate900);
    }
    .deliverable-price-badge {
      font-size: 12px;
      font-weight: 800;
      color: var(--primary);
      background: var(--primary-light);
      border: 1px solid var(--primary-border);
      padding: 3px 10px;
      border-radius: 9999px;
      font-family: 'JetBrains Mono', monospace;
    }
    .deliverable-card-body {
      padding: 14px 18px;
    }
    .deliverables-sublabel {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--slate400);
      margin-bottom: 10px;
    }
    .deliverables-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .deliverable-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--slate700);
    }
    .check-icon {
      color: #10b981;
      font-weight: 800;
      font-size: 12px;
    }

    /* Technology Stack Card */
    .tech-stack-card {
      background: #ffffff;
      border: 1px solid var(--slate200);
      border-radius: 12px;
      padding: 14px 18px;
      margin-top: 14px;
      margin-bottom: 14px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .card-section-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--primary);
      margin-bottom: 10px;
    }
    .styled-table {
      width: 100%;
      border-collapse: collapse;
    }
    .tech-table td {
      padding: 6px 0;
      border-bottom: 1px solid var(--slate100);
    }
    .tech-table tr:last-child td { border-bottom: none; }
    .tech-layer-cell {
      font-weight: 700;
      color: var(--slate800);
      width: 120px;
    }
    .tech-chip {
      display: inline-block;
      background: var(--slate100);
      color: var(--slate700);
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      margin-right: 4px;
      margin-bottom: 2px;
    }

    /* Pricing Table */
    .pricing-card {
      background: #ffffff;
      border: 1px solid var(--slate200);
      border-radius: 12px;
      padding: 14px 18px;
      margin-top: 14px;
      margin-bottom: 18px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .pricing-table th {
      text-align: left;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--slate500);
      padding: 8px 10px;
      background: var(--slate50);
      border-bottom: 1px solid var(--slate200);
    }
    .pricing-table td {
      padding: 9px 10px;
      border-bottom: 1px solid var(--slate100);
      font-size: 11px;
    }
    .pricing-table tr:last-child td { border-bottom: none; }
    .pricing-table th.num, .pricing-table td.num {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
    }
    .billing-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .billing-badge.upfront { background: rgba(78, 18, 212, 0.08); color: var(--primary); }
    .billing-badge.recurring { background: rgba(200, 80, 250, 0.12); color: var(--accent); }

    /* Financial Summary Card */
    .financial-summary-card {
      background: #ffffff;
      border: 2px solid var(--primary-border);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 24px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      box-shadow: 0 4px 12px rgba(78, 18, 212, 0.05);
    }
    .financial-summary-header {
      background: linear-gradient(135deg, rgba(30,0,120,0.06) 0%, rgba(78,18,212,0.04) 100%);
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid var(--primary-border);
    }
    .summary-card-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--primary);
    }
    .currency-tag {
      font-size: 10px;
      font-weight: 700;
      color: var(--slate600);
      background: #ffffff;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid var(--slate200);
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
    }
    .summary-table td {
      padding: 10px 20px;
      border-bottom: 1px solid var(--slate100);
      font-size: 11.5px;
    }
    .summary-label { font-weight: 600; color: var(--slate700); }
    .summary-value { font-weight: 700; color: var(--slate900); font-family: 'JetBrains Mono', monospace; }
    .grand-total-row td {
      background: var(--primary-light);
      border-top: 1.5px solid var(--primary-border);
      border-bottom: none;
    }
    .grand-label { font-size: 12.5px; font-weight: 800; color: var(--primary); }
    .grand-value { font-size: 15px; font-weight: 800; color: var(--primary); }
    .recurring-row td {
      background: rgba(200, 80, 250, 0.05);
      border-top: 1px solid rgba(200, 80, 250, 0.15);
    }
    .recurring-label { font-weight: 700; color: var(--accent); }
    .recurring-value { font-size: 13px; font-weight: 800; color: var(--accent); }

    /* Three Executive Cards Grid */
    .three-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 24px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .info-card {
      border-radius: 12px;
      padding: 16px;
    }
    .info-card.rose { background: #fff1f2; border: 1px solid #fecdd3; }
    .info-card.indigo { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .info-card.purple { background: var(--primary-light); border: 1px solid var(--primary-border); }
    
    .card-heading {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-heading.rose { color: #e11d48; }
    .card-heading.indigo { color: #16a34a; }
    .card-heading.purple { color: var(--primary); }

    .info-list { list-style: none; }
    .info-list-item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 10.5px;
      color: var(--slate700);
      margin-bottom: 6px;
    }
    .info-list-item:last-child { margin-bottom: 0; }
    .info-icon { font-weight: 800; flex-shrink: 0; }
    .info-icon.red { color: #e11d48; }
    .info-icon.indigo { color: #16a34a; }
    .info-icon.purple { color: var(--primary); }
    .milestone-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 800;
      background: #ffffff;
      color: var(--primary);
      border: 1px solid var(--primary-border);
      padding: 1px 6px;
      border-radius: 4px;
      margin-left: 4px;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Authorization Block */
    .auth-card {
      background: #ffffff;
      border: 1px solid var(--slate200);
      border-radius: 12px;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .auth-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--slate400);
      margin-bottom: 6px;
    }
    .auth-desc {
      font-size: 11px;
      color: var(--slate600);
      max-width: 320px;
      line-height: 1.5;
    }
    .sig-container {
      text-align: center;
    }
    .sig-img {
      height: 44px;
      width: auto;
      object-fit: contain;
      margin-bottom: 4px;
    }
    .sig-line {
      width: 170px;
      border-top: 1.5px solid var(--slate800);
      padding-top: 6px;
    }
    .sig-label {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: var(--primary);
    }
    .sig-company-name {
      font-size: 10px;
      color: var(--slate500);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Cover Header -->
    <div class="cover-header">
      <div class="logo-box">
        <img src="${esc(ctx.logoSrc)}" alt="Company Logo" class="logo-img" />
      </div>
      <div class="meta-box">
        <div class="official-badge">OFFICIAL QUOTATION</div>
        <div class="qtn-number">#${esc(quotationNo)}</div>
        <div class="meta-dates">Issue Date: <strong>${esc(issueDate)}</strong></div>
        <div class="meta-dates">Valid Until: <strong class="valid-until">${esc(validUntilStr)}</strong></div>
      </div>
    </div>

    <!-- Main Proposal Box -->
    <div class="proposal-card">
      <div class="proposal-left">
        <div class="proposal-title-label">PROPOSAL PACKAGE</div>
        <h1 class="proposal-title">${esc(proposalTitle)}</h1>
      </div>
      <div class="client-card-box">
        <div class="client-label">PREPARED FOR</div>
        <div class="client-name">${esc(clientName)}</div>
        ${clientCompany ? `<div class="client-company">${esc(clientCompany)}</div>` : ''}
        ${clientEmail ? `<div class="client-email">${esc(clientEmail)}</div>` : ''}
      </div>
    </div>

    <!-- Executive Overview Block -->
    ${globalOverview ? `
    <div class="overview-card">
      <div class="overview-title">Executive Summary & Overview</div>
      <div class="overview-text">${esc(globalOverview)}</div>
    </div>` : ''}

    <!-- Dynamic Service Sections -->
    <div class="sections-container">
      ${modulesHtml}
    </div>

    <!-- Dynamic Financial Investment Summary -->
    ${investmentSummaryHtml}

    <!-- Three Executive Information Cards -->
    <div class="three-cards-grid">
      <div class="info-card rose">
        <div class="card-heading rose">✕ Not Included in Price</div>
        <ul class="info-list">${notIncludedHtml}</ul>
      </div>
      <div class="info-card indigo">
        <div class="card-heading indigo">✓ Client Needs to Provide</div>
        <ul class="info-list">${clientReqHtml}</ul>
      </div>
      <div class="info-card purple">
        <div class="card-heading purple">◆ Payment Terms & Milestones</div>
        <ul class="info-list">${paymentMilestonesHtml}</ul>
      </div>
    </div>

    <!-- Authorization & Signatures Block -->
    <div class="auth-card">
      <div class="auth-left">
        <div class="auth-title">🛡️ Authorization Status</div>
        <div class="auth-desc">
          This quotation document is valid until ${esc(validUntilStr)}. Upon acceptance, formal project execution will commence as per agreed milestones.
        </div>
      </div>
      <div class="auth-right">
        <div class="sig-container">
          ${ctx.signatureSrc ? `<img src="${esc(ctx.signatureSrc)}" alt="Authorized Signature" class="sig-img" />` : '<div style="height: 44px;"></div>'}
          <div class="sig-line">
            <div class="sig-label">Authorized Signature</div>
            <div class="sig-company-name">${esc(companyName)}</div>
          </div>
        </div>
      </div>
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
