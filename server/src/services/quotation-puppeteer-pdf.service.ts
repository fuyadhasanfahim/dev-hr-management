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
    'one-time': 'One-time',
    monthly: 'Monthly',
    yearly: 'Yearly',
    'per-image': 'Per image',
    'per-video': 'Per video',
    'per-second': 'Per second',
    'per-10s': 'Per 10 seconds',
};

/** Matches client `QuotationPDF` + `formatMoney` (BDT / ISO / symbol). */
function formatMoneyPdf(
    amount: number | null | undefined,
    currency?: string | null,
): string {
    const n = Number(amount || 0);
    const fractionDigits = 2;
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
        .replace(/>/g, '&gt;')
}

const DEFAULT_LOGO =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png';

const DEFAULT_SIGNATURE =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png';

/** Tiny transparent PNG — last-resort if remote images fail to fetch. */
const FALLBACK_PIXEL_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
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
        const ctRaw =
            (res.headers.get('content-type') || '').split(';')[0] ?? '';
        const ct = ctRaw.trim() || 'image/png';
        const safeCt = /^image\/[a-z0-9.+-]+$/i.test(ct) ? ct : 'image/png';
        return `data:${safeCt};base64,${buf.toString('base64')}`;
    } catch {
        return null;
    }
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
    const recurringCharges: any[] = Array.isArray(q.recurringCharges) ? q.recurringCharges : [];
    const notIncludedRaw = Array.isArray(q.notIncluded) ? q.notIncluded : [];
    const clientReqRaw = Array.isArray(q.clientRequirements)
        ? q.clientRequirements
        : [];

    const currency = q.currency || 'BDT';

    const quotationNo = String(q.quotationNumber || 'DRAFT-001').replace(/^#/, '').trim() || 'DRAFT-001';
    const issueDate = details?.date
        ? format(new Date(details.date), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd');
    const validUntilStr = details?.validUntil
        ? format(new Date(details.validUntil), 'yyyy-MM-dd')
        : '—';
    const clientName = client.contactName || client.companyName || 'Valued Client';
    const clientEmail = client.email || '';
    const proposalTitle = details?.title || 'Multi-Service Agency Proposal';

    const defaultNotIncluded = [
        'Domain Registration & Premium Web Hosting (Billed Separately)',
        'Third-party Paid API Licenses, Plugins, or Premium Fonts',
        'Paid Ad Spend for Facebook, Google, or LinkedIn Campaigns',
        'Raw Unedited Studio Footage or Source Design Files (Unless specified)',
    ];
    const defaultClientRequirements = [
        'High-resolution Brand Logo, Color Palette & Typography Guidelines',
        'Admin Access / Credentials to Hosting, Domain, or CMS Platform',
        'Final Approved Text Content, Copywriting & Product Photography',
        'Dedicated Point of Contact for Prompt Feedback and Approvals',
    ];

    const notIncludedItems =
        notIncludedRaw.length > 0 ? notIncludedRaw : defaultNotIncluded;
    const clientRequirements =
        clientReqRaw.length > 0 ? clientReqRaw : defaultClientRequirements;

    // ── One numbered section per selected service, each with its own scope,
    // tech stack (web-development only), and line-item pricing table. ────────
    interface ServiceModuleResult {
        label: string;
        html: string;
        grandTotal: number;
    }

    function renderServiceModule(service: any, idx: number): ServiceModuleResult {
        const label = CATEGORY_LABELS[service?.category] || String(service?.category || 'Service');
        const scopeDescription = String(service?.scopeDescription || '').trim();
        const rawItems = Array.isArray(service?.scopeItems)
            ? service.scopeItems.map((x: any) => String(x || '').trim()).filter(Boolean)
            : [];
        const scopeItems = rawItems.length > 0
            ? rawItems
            : ['Comprehensive deliverables and feature scope as agreed.'];

        const descHtml = scopeDescription ? `<p class="module-desc">${esc(scopeDescription)}</p>` : '';
        let runningItemIndex = 1;
        const itemsHtml = scopeItems
            .map(
                (item: string) => {
                    const trimmed = String(item || '').trim();
                    if (!trimmed) return '';

                    if (trimmed.startsWith('### ')) {
                        const headingText = trimmed.replace(/^###\s*/, '');
                        return `
              <div class="deliverable-heading" style="margin-top: 14px; margin-bottom: 6px; font-size: 13.5px; font-weight: 800; color: var(--accent); border-bottom: 1.5px solid rgba(78, 18, 212, 0.15); padding-bottom: 4px; page-break-after: avoid; break-after: avoid; width: 100%;">
                ${esc(headingText)}
              </div>`;
                    }

                    // Detect nested sub-features
                    const leadingSpaces = item.match(/^\s*/)?.[0].length || 0;
                    const isSub = leadingSpaces >= 2 || item.startsWith('\t');

                    const cleanText = trimmed.replace(/^[-*•◦▪+]\s*/, '').trim();

                    if (isSub) {
                        return `
              <div class="deliverable-item sub-feature" style="margin-left: 24px; border-left: 2px solid rgba(78, 18, 212, 0.15); padding: 5px 16px; background-color: transparent; border-radius: 0; border-top: none; border-right: none; border-bottom: none; box-shadow: none; display: flex; align-items: center; gap: 8px; margin-top: 2px; margin-bottom: 2px; page-break-inside: avoid; break-inside: avoid; width: 100%;">
                <span class="sub-dot" style="width: 5px; height: 5px; border-radius: 50%; background-color: #4E12D4; flex-shrink: 0; display: inline-block;"></span>
                <span class="deliv-text" style="font-size: 11px; font-weight: 500; color: var(--slate600);">${esc(cleanText)}</span>
              </div>`;
                    }

                    const startsWithBullet = /^[-*•◦▪+]\s*/.test(trimmed);

                    if (startsWithBullet) {
                        return `
              <div class="deliverable-item" style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; background-color: #ffffff; border: 1px solid rgba(226, 232, 240, 0.85); border-radius: 10px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.01); page-break-inside: avoid; break-inside: avoid; width: 100%;">
                <span class="feature-dot" style="width: 7px; height: 7px; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%); flex-shrink: 0; box-shadow: 0 1px 3px rgba(78, 18, 212, 0.3); display: inline-block;"></span>
                <span class="deliv-text" style="font-size: 12px; font-weight: 700; color: var(--slate800);">${esc(cleanText)}</span>
              </div>`;
                    }

                    // Standard numbered item
                    const idxStr = String(runningItemIndex++).padStart(2, '0');
                    return `
              <div class="deliverable-item">
                <span class="deliv-num">${idxStr}</span>
                <span class="deliv-text">${esc(cleanText)}</span>
              </div>`;
                }
            )
            .join('');

        // Technology stack table — only meaningful for web-development.
        let techHtml = '';
        const tech = service?.techStack;
        if (tech) {
            const rows: Array<[string, string[]]> = (
                [
                    ['Frontend', tech.frontend],
                    ['Backend', tech.backend],
                    ['Database', tech.database],
                    ['Tools', tech.tools],
                ] as Array<[string, unknown]>
            ).filter(([, list]) => Array.isArray(list) && (list as string[]).length > 0) as Array<[string, string[]]>;

            if (rows.length > 0) {
                const techDesc = tech.description
                    ? `<p class="module-desc">${esc(tech.description)}</p>`
                    : '';
                const techRows = rows
                    .map(
                        ([layer, list]) => `
                <tr><td style="font-weight:700;color:var(--slate800);white-space:nowrap;">${esc(layer)}</td><td>${list.map((t) => esc(t)).join(', ')}</td></tr>`
                    )
                    .join('');
                techHtml = `
          <div style="margin-top: 14px;">
            <div class="sub-heading">Technology Stack</div>
            ${techDesc}
            <table class="tech-table">
              <thead><tr><th style="width:120px;">Layer</th><th>Technologies</th></tr></thead>
              <tbody>${techRows}</tbody>
            </table>
          </div>`;
            }
        }

        // Line-item investment table — base fee + add-ons, tagged upfront vs recurring.
        const basePrice = Number(service?.basePrice) || 0;
        const lineItems: any[] = Array.isArray(service?.lineItems) ? service.lineItems : [];
        let upfrontTotal = basePrice;
        const lineRows: string[] = [];

        if (basePrice > 0) {
            lineRows.push(`
              <tr>
                <td>Base Project Fee</td>
                <td><span class="billing-tag upfront">One-time</span></td>
                <td class="num">1</td>
                <td class="num">${formatMoneyPdf(basePrice, currency)}</td>
                <td class="num">${formatMoneyPdf(basePrice, currency)}</td>
              </tr>`);
        }

        lineItems.forEach((item) => {
            const qty = item.quantity ?? 1;
            const lineTotal = (Number(item.price) || 0) * qty;
            const upfront = isUpfrontBillingCycle(item.billingCycle || 'one-time');
            if (upfront) upfrontTotal += lineTotal;
            lineRows.push(`
              <tr>
                <td>${esc(item.title)}${item.description ? `<div style="font-size:10.5px;color:var(--slate500);margin-top:2px;">${esc(item.description)}</div>` : ''}</td>
                <td><span class="billing-tag ${upfront ? 'upfront' : 'recurring'}">${esc(BILLING_LABELS[item.billingCycle] || item.billingCycle)}</span></td>
                <td class="num">${qty}</td>
                <td class="num">${formatMoneyPdf(item.price, currency)}</td>
                <td class="num">${formatMoneyPdf(lineTotal, currency)}</td>
              </tr>`);
        });

        const discount = Number(service?.discount) || 0;
        const taxRate = Number(service?.taxRate) || 0;
        const discountAmount = (upfrontTotal * discount) / 100;
        const afterDiscount = upfrontTotal - discountAmount;
        const taxAmount = (afterDiscount * taxRate) / 100;
        const grandTotal = afterDiscount + taxAmount;

        let pricingHtml = '';
        if (lineRows.length > 0) {
            pricingHtml = `
          <div style="margin-top: 14px;">
            <div class="sub-heading">Investment</div>
            <table class="pricing-table">
              <thead><tr><th>Item</th><th>Billing</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr></thead>
              <tbody>
                ${lineRows.join('')}
                ${discount > 0 ? `<tr><td colspan="4" style="text-align:right;color:var(--slate500);">Discount (${discount}%)</td><td class="num">- ${formatMoneyPdf(discountAmount, currency)}</td></tr>` : ''}
                ${taxRate > 0 ? `<tr><td colspan="4" style="text-align:right;color:var(--slate500);">Tax / VAT (${taxRate}%)</td><td class="num">+ ${formatMoneyPdf(taxAmount, currency)}</td></tr>` : ''}
                <tr class="total-row"><td colspan="4" style="text-align:right;">Service Total</td><td class="num">${formatMoneyPdf(grandTotal, currency)}</td></tr>
              </tbody>
            </table>
          </div>`;
        }

        const html = `
        <div class="module-card">
          <div class="module-header">
            <span class="module-title">${idx + 1}. ${esc(label)}</span>
            <span class="module-count">${scopeItems.length} ${scopeItems.length === 1 ? 'Feature' : 'Features'}</span>
          </div>
          ${descHtml}
          <div class="module-body">
            ${itemsHtml}
          </div>
          ${techHtml}
          ${pricingHtml}
        </div>`;

        return { label, html, grandTotal };
    }

    const serviceModules: ServiceModuleResult[] =
        services.length > 0
            ? services.map((s, idx) => renderServiceModule(s, idx))
            : [
                  renderServiceModule(
                      {
                          category: 'web-development',
                          scopeItems: [
                              details?.title || 'Comprehensive Responsive Web Architecture & Design System',
                              'High-converting Landing Page with Modern UI/UX',
                              'Dynamic Backend API & Database Integration',
                              'Speed Optimization (90+ Google PageSpeed Score)',
                          ],
                      },
                      0,
                  ),
              ];

    const modulesHtml = serviceModules.map((m) => m.html).join('');

    // ── Investment & Pricing Summary — per-service subtotal + grand total. ───
    let sectionNum = serviceModules.length;
    sectionNum += 1;
    const investmentSectionNum = sectionNum;
    const summaryRows = serviceModules
        .map(
            (m) => `
        <tr><td>${esc(m.label)}</td><td class="num">${formatMoneyPdf(m.grandTotal, currency)}</td></tr>`
        )
        .join('');
    const grandTotal = Number(totals?.grandTotal ?? 0);
    const investmentSummaryHtml = `
    <div class="sec-heading">
      <span class="sec-dot"></span>
      ${investmentSectionNum}. Investment &amp; Pricing Summary
    </div>
    <table class="summary-table" style="margin-bottom: 24px;">
      <thead><tr><th>Service</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${summaryRows}
        <tr class="total-row"><td>Grand Total Investment</td><td class="num">${formatMoneyPdf(grandTotal, currency)}</td></tr>
      </tbody>
    </table>`;

    // ── Ongoing / Recurring Charges — billed separately from the total above. ─
    let ongoingChargesHtml = '';
    if (recurringCharges.length > 0) {
        sectionNum += 1;
        const ongoingRows = recurringCharges
            .map((item) => {
                const qty = item.quantity ?? 1;
                return `
        <tr><td>${esc(item.title)}${item.description ? `<div style="font-size:10.5px;color:var(--slate500);margin-top:2px;">${esc(item.description)}</div>` : ''}</td><td><span class="billing-tag recurring">${esc(BILLING_LABELS[item.billingCycle] || item.billingCycle)}</span></td><td class="num">${qty}</td><td class="num">${formatMoneyPdf(item.price, currency)}</td></tr>`;
            })
            .join('');
        ongoingChargesHtml = `
    <div class="sec-heading">
      <span class="sec-dot pink"></span>
      ${sectionNum}. Ongoing / Recurring Charges (Billed Separately)
    </div>
    <div class="ongoing-box">
      <div class="ongoing-box-note">These charges are billed on an ongoing basis (not part of the one-time investment above) and start once the corresponding service is live.</div>
      <table class="pricing-table">
        <thead><tr><th>Item</th><th>Billing</th><th class="num">Qty</th><th class="num">Rate</th></tr></thead>
        <tbody>${ongoingRows}</tbody>
      </table>
    </div>`;
    }

    const notIncludedSectionNum = sectionNum + 1;
    const clientReqSectionNum = sectionNum + 2;
    const paymentSectionNum = sectionNum + 3;

    const notIncludedHtml = notIncludedItems
        .map(
            (item) => `
        <li class="info-item">
          <span class="icon-pink">✕</span>
          <span class="info-text">${esc(item)}</span>
        </li>`
        )
        .join('');

    const clientReqHtml = clientRequirements
        .map(
            (item) => `
        <li class="info-item">
          <span class="icon-indigo">●</span>
          <span class="info-text">${esc(item)}</span>
        </li>`
        )
        .join('');

    const paymentMilestonesRaw =
        Array.isArray(q.paymentMilestones) && q.paymentMilestones.length > 0
            ? q.paymentMilestones
            : [
                  { label: '30% Upfront Payment', percentage: 30 },
                  { label: '40% Midway Progress Milestone', percentage: 40 },
                  { label: '30% Final Delivery & Handover', percentage: 30 },
              ];

    const paymentMilestonesHtml = paymentMilestonesRaw
        .map(
            (m: any) => `
        <li class="info-item" style="justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <span class="icon-purple">✔</span>
            <span class="info-text">${esc(m.label)}</span>
          </div>
          ${Number(m.percentage) > 0 ? `<strong style="font-family: monospace, system-ui; color: var(--accent); font-size: 11.5px;">${Number(m.percentage)}%</strong>` : ''}
        </li>`
        )
        .join('');

    const companyName = String(q.company?.name || 'WebBriks').trim();
    const companyAddress = String(q.company?.address || '').trim();
    const companyEmail = String(q.company?.email || '').trim();
    const companyPhone = String(q.company?.phone || '').trim();
    const companyWebsite = String(q.company?.website || 'webbriks.com').trim();
    const coverMessageRaw = String(q.overview || '').trim();
    const coverMessage =
        coverMessageRaw ||
        `Dear ${clientName},\n\nThank you for taking the time to review our proposal and for sharing your requirements with us. We are pleased to present this quotation covering the complete scope of work discussed.\n\nPlease find the detailed breakdown of deliverables, pricing, and terms on the following pages.`;
    const coverMessageHtml = coverMessage
        .split(/\n{2,}/)
        .map((para) => `<p>${esc(para).replace(/\n/g, '<br/>')}</p>`)
        .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(proposalTitle)}</title>
  <style>
    :root {
      --primary: #1E0078;
      --accent: #4E12D4;
      --pink: #C850FA;
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
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: var(--slate800);
      background: #fff;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      width: 100%;
      max-width: 100%;
      padding: 4px 4px 0 4px;
      display: flex;
      flex-direction: column;
    }
    .cover-page {
      page-break-after: always;
      break-after: page;
    }
    .cover-message {
      margin-top: 8px;
      padding: 28px 30px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(30, 0, 120, 0.03) 0%, rgba(200, 80, 250, 0.02) 100%);
      border: 1px solid rgba(78, 18, 212, 0.14);
    }
    .cover-message p {
      font-size: 12.5px;
      color: var(--slate700);
      line-height: 1.85;
      margin-bottom: 14px;
    }
    .cover-message p:last-child {
      margin-bottom: 0;
    }
    .cover-signoff {
      margin-top: 22px;
      padding-top: 18px;
      border-top: 1px solid rgba(78, 18, 212, 0.12);
      font-size: 12px;
      color: var(--slate600);
    }
    .cover-signoff-company {
      font-weight: 800;
      color: var(--primary);
      margin-top: 2px;
      font-size: 13px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--slate200);
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .logo-img {
      height: 48px;
      width: auto;
      max-width: 160px;
      object-fit: contain;
      object-position: left center;
      display: block;
    }
    .company-title {
      font-size: 20px;
      font-weight: 900;
      color: var(--primary);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      line-height: 1.1;
      margin-bottom: 4px;
    }
    .company-sub {
      font-size: 11px;
      color: var(--slate500);
      font-weight: 500;
    }
    .header-right {
      text-align: right;
    }
    .quote-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      background-color: rgba(78, 18, 212, 0.08);
      color: var(--accent);
      border: 1px solid rgba(78, 18, 212, 0.2);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 6px;
    }
    .quote-number {
      font-size: 18px;
      font-weight: 900;
      color: var(--primary);
      font-family: monospace, system-ui;
      margin-bottom: 3px;
    }
    .quote-meta {
      font-size: 11.5px;
      color: var(--slate500);
      line-height: 1.5;
    }
    .quote-meta strong {
      color: var(--slate800);
      font-weight: 600;
    }
    .quote-meta strong.pink-text {
      color: var(--pink);
    }
    .proposal-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, rgba(30, 0, 120, 0.04) 0%, rgba(200, 80, 250, 0.03) 100%);
      border: 1px solid rgba(78, 18, 212, 0.18);
      border-radius: 18px;
      padding: 24px;
      margin-bottom: 28px;
      box-shadow: 0 4px 16px rgba(30, 0, 120, 0.04);
      page-break-inside: avoid;
    }
    .proposal-left {
      flex: 1;
      padding-right: 24px;
    }
    .label-muted {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--slate400);
      margin-bottom: 4px;
    }
    .proposal-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--primary);
      line-height: 1.25;
      margin-bottom: 12px;
    }
    .badges-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .scope-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      box-shadow: 0 2px 4px rgba(30, 0, 120, 0.15);
    }
    .proposal-right {
      width: 280px;
      flex-shrink: 0;
      border-left: 1.5px solid rgba(78, 18, 212, 0.15);
      padding-left: 24px;
    }
    .label-purple {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent);
      margin-bottom: 4px;
    }
    .client-name {
      font-size: 15px;
      font-weight: 800;
      color: var(--slate900);
      line-height: 1.3;
    }
    .client-email {
      font-size: 11.5px;
      color: var(--slate500);
      font-weight: 500;
      margin-top: 2px;
    }
    .total-divider {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(226, 232, 240, 0.8);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-label {
      font-size: 11.5px;
      font-weight: 700;
      color: var(--primary);
    }
    .total-amount {
      font-size: 16px;
      font-weight: 800;
      color: var(--primary);
      font-family: monospace, system-ui;
    }
    .sec-heading {
      font-size: 13.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--primary);
      border-bottom: 1.5px solid var(--slate200);
      padding-bottom: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .sec-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent) 0%, var(--pink) 100%);
      box-shadow: 0 0 6px rgba(78, 18, 212, 0.25);
    }
    .sec-dot.pink { background: var(--pink); }
    .sec-dot.indigo { background: var(--primary); }
    .module-card {
      margin-bottom: 24px;
    }
    .module-header {
      background: linear-gradient(90deg, rgba(78, 18, 212, 0.08) 0%, rgba(200, 80, 250, 0.04) 100%);
      border: 1px solid rgba(78, 18, 212, 0.22);
      border-radius: 12px;
      padding: 13px 20px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-after: avoid;
      break-after: avoid;
      box-shadow: 0 2px 6px rgba(78, 18, 212, 0.04);
    }
    .module-title {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .module-count {
      font-size: 10.5px;
      font-weight: 800;
      color: var(--accent);
      background-color: #ffffff;
      border: 1px solid rgba(78, 18, 212, 0.25);
      padding: 3px 12px;
      border-radius: 9999px;
      box-shadow: 0 1px 3px rgba(78, 18, 212, 0.08);
    }
    .module-desc {
      font-size: 11.5px;
      color: var(--slate600);
      line-height: 1.6;
      margin: 2px 2px 12px 2px;
    }
    .module-body {
      background: transparent;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .deliverable-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 13px 20px;
      background-color: #ffffff;
      border: 1px solid rgba(226, 232, 240, 0.85);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.02);
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .deliverable-item:last-child {
      border: 1px solid rgba(226, 232, 240, 0.85);
    }
    .deliv-num {
      width: 24px;
      height: 24px;
      border-radius: 7px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      font-family: monospace, system-ui;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
      box-shadow: 0 2px 4px rgba(78, 18, 212, 0.2);
    }
    .deliv-text {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--slate800);
      line-height: 1.55;
      padding-top: 2px;
    }
    .three-col-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 8px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .info-card {
      padding: 16px;
      border-radius: 16px;
    }
    .info-card.col-pink {
      background-color: rgba(200, 80, 250, 0.04);
      border: 1px solid rgba(200, 80, 250, 0.2);
    }
    .info-card.col-indigo {
      background-color: rgba(30, 0, 120, 0.04);
      border: 1px solid rgba(30, 0, 120, 0.2);
    }
    .info-card.col-purple {
      background-color: rgba(78, 18, 212, 0.04);
      border: 1px solid rgba(78, 18, 212, 0.2);
    }
    .info-card .sec-heading {
      border-bottom: none;
      padding-bottom: 0;
      margin-bottom: 14px;
      font-size: 11.5px;
    }
    .sec-heading.col-pink-title { color: var(--pink); }
    .sec-heading.col-indigo-title { color: var(--primary); }
    .sec-heading.col-purple-title { color: var(--accent); }
    .info-list {
      list-style: none;
    }
    .info-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 11px;
      font-weight: 600;
      color: var(--slate700);
      line-height: 1.45;
    }
    .info-item:last-child {
      margin-bottom: 0;
    }
    .icon-pink { color: var(--pink); font-weight: 800; flex-shrink: 0; margin-top: 1px; }
    .icon-indigo { color: var(--primary); font-weight: 800; flex-shrink: 0; margin-top: 1px; }
    .icon-purple { color: var(--accent); font-weight: 800; flex-shrink: 0; margin-top: 1px; }
    .auth-row {
      border-top: 1px solid var(--slate200);
      padding-top: 24px;
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
    }
    .auth-left {
      max-width: 480px;
    }
    .auth-heading {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--slate400);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .auth-text {
      font-size: 11.5px;
      color: var(--slate600);
      line-height: 1.55;
    }
    .auth-right {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .sig-box {
      height: 48px;
      margin-bottom: 8px;
    }
    .sig-img {
      height: 48px;
      width: auto;
      max-width: 180px;
      object-fit: contain;
      object-position: right bottom;
      display: block;
    }
    .sig-line-box {
      width: 180px;
      border-top: 1px solid var(--slate800);
      padding-top: 6px;
      text-align: left;
    }
    .sig-title {
      font-size: 11px;
      font-weight: 800;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .sig-company {
      font-size: 10.5px;
      color: var(--slate500);
      margin-top: 1px;
    }
    .footer-spacer {
      flex-grow: 1;
    }
    .doc-footer {
      width: 100%;
      padding-top: 14px;
      padding-bottom: 8px;
      border-top: 1px solid var(--slate100);
      font-size: 11px;
      color: var(--slate500);
      font-weight: 600;
      background: #fff;
    }
    .doc-footer a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 700;
    }
    .footer-cols {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      width: 100%;
    }
    .footer-col {
      flex: 1;
      font-size: 10.5px;
      color: var(--slate500);
      line-height: 1.6;
    }
    .footer-col-title {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--primary);
      margin-bottom: 3px;
    }
    .sub-heading {
      font-size: 10.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent);
      margin-bottom: 8px;
    }
    .tech-table, .pricing-table, .summary-table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    .tech-table th, .pricing-table th, .summary-table th {
      text-align: left;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--slate500);
      padding: 7px 10px;
      border-bottom: 1.5px solid var(--slate200);
    }
    .tech-table td, .pricing-table td, .summary-table td {
      font-size: 11.5px;
      color: var(--slate700);
      padding: 8px 10px;
      border-bottom: 1px solid var(--slate100);
      vertical-align: top;
    }
    .pricing-table th.num, .pricing-table td.num,
    .summary-table th.num, .summary-table td.num {
      text-align: right;
      font-family: monospace, system-ui;
    }
    .pricing-table td.num, .summary-table td.num {
      font-weight: 700;
      color: var(--slate800);
    }
    .pricing-table tr.total-row td, .summary-table tr.total-row td {
      font-weight: 800;
      color: var(--primary);
      border-top: 1.5px solid var(--slate200);
      border-bottom: none;
    }
    .billing-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .billing-tag.upfront { background: rgba(78, 18, 212, 0.08); color: var(--accent); }
    .billing-tag.recurring { background: rgba(200, 80, 250, 0.12); color: var(--pink); }
    .ongoing-box {
      margin: 0 0 24px 0;
      padding: 16px 18px;
      border-radius: 14px;
      background: rgba(200, 80, 250, 0.03);
      border: 1px dashed rgba(200, 80, 250, 0.35);
      page-break-inside: avoid;
    }
    .ongoing-box-note {
      font-size: 10.5px;
      color: var(--slate500);
      margin-bottom: 10px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="cover-page">
      <div class="header-row">
        <div class="header-left">
          <img src="${esc(ctx.logoSrc)}" alt="WebBriks" class="logo-img" />
        </div>
        <div class="header-right">
          <div class="quote-badge">OFFICIAL QUOTATION</div>
          <div class="quote-number">#${esc(quotationNo)}</div>
          <div class="quote-meta">Issue Date: <strong>${esc(issueDate)}</strong></div>
          <div class="quote-meta">Valid Until: <strong class="pink-text">${esc(validUntilStr)}</strong></div>
        </div>
      </div>

      <div class="proposal-card">
        <div class="proposal-left">
          <div class="label-muted">PROPOSAL PACKAGE TITLE</div>
          <h1 class="proposal-title" style="margin-bottom: 0;">${esc(proposalTitle)}</h1>
        </div>
        <div class="proposal-right">
          <div class="label-purple">PREPARED FOR</div>
          <div class="client-name">${esc(clientName)}</div>
          ${clientEmail ? `<div class="client-email">${esc(clientEmail)}</div>` : ''}
        </div>
      </div>

      <div class="cover-message">
        ${coverMessageHtml}
        <div class="cover-signoff">
          <div>Warm regards,</div>
          <div class="cover-signoff-company">${esc(companyName)}</div>
        </div>
      </div>
    </div>

    <div style="margin-bottom: 24px;">
      ${modulesHtml}
    </div>

    ${investmentSummaryHtml}
    ${ongoingChargesHtml}

    <div class="three-col-grid">
      <div class="info-card col-pink">
        <div class="sec-heading col-pink-title">
          <span class="sec-dot pink"></span>
          ${notIncludedSectionNum}. Not Included in Price
        </div>
        <ul class="info-list">
          ${notIncludedHtml}
        </ul>
      </div>
      <div class="info-card col-indigo">
        <div class="sec-heading col-indigo-title">
          <span class="sec-dot indigo"></span>
          ${clientReqSectionNum}. Client Needs to Provide
        </div>
        <ul class="info-list">
          ${clientReqHtml}
        </ul>
      </div>
      <div class="info-card col-purple">
        <div class="sec-heading col-purple-title">
          <span class="sec-dot" style="background: var(--accent);"></span>
          ${paymentSectionNum}. Payment Milestones
        </div>
        <ul class="info-list">
          ${paymentMilestonesHtml}
        </ul>
      </div>
    </div>

    <div class="auth-row">
      <div class="auth-left">
        <div class="auth-heading">
          <span>🛡️</span> AUTHORIZATION STATUS
        </div>
        <div class="auth-text">
          This quotation is valid for 14 days from the date of issue. Upon acceptance, a formal contract or project milestone invoice will be issued.
        </div>
      </div>
      <div class="auth-right">
        <div class="sig-box">
          ${ctx.signatureSrc ? `<img src="${esc(ctx.signatureSrc)}" alt="Authorized Signature" class="sig-img" />` : `<div style="height: 48px;"></div>`}
        </div>
        <div class="sig-line-box">
          <div class="sig-title">Authorized Signature</div>
          <div class="sig-company">Founder &amp; CEO, WebBriks</div>
        </div>
      </div>
    </div>

    <div class="footer-spacer"></div>
    <footer class="doc-footer">
      <div class="footer-cols">
        <div class="footer-col">
          <div class="footer-col-title">${esc(companyName)}</div>
          ${companyAddress ? `<div>${esc(companyAddress)}</div>` : ''}
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Contact</div>
          ${companyEmail ? `<div>${esc(companyEmail)}</div>` : ''}
          ${companyPhone ? `<div>${esc(companyPhone)}</div>` : ''}
        </div>
        <div class="footer-col" style="text-align: right;">
          <div class="footer-col-title">Web</div>
          <div><a href="https://${esc(companyWebsite.replace(/^https?:\/\//, ''))}">${esc(companyWebsite)}</a></div>
          <div>&copy; ${new Date().getFullYear()} ${esc(companyName)}. All rights reserved.</div>
        </div>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

export class QuotationPuppeteerPdfService {
    static async generatePdf(
        quotationId: string,
    ): Promise<{ buffer: Buffer; filename: string }> {
        const q = await QuotationModel.findById(quotationId)
            .populate('clientId', 'name clientId emails')
            .lean();
        if (!q) throw new AppError('Quotation not found', 404);

        const signatureUrl =
            process.env.COMPANY_SIGNATURE_URL || DEFAULT_SIGNATURE;
        const companyLogoRemote =
            ((q as any).company?.logo as string) || DEFAULT_LOGO;

        let logoSrc =
            (await fetchImageAsDataUrl(companyLogoRemote)) ||
            (await fetchImageAsDataUrl(DEFAULT_LOGO));
        if (!logoSrc) logoSrc = FALLBACK_PIXEL_PNG;

        let signatureSrc = (await fetchImageAsDataUrl(signatureUrl)) || '';

        const html = buildPrintHtml(q as Record<string, any>, {
            logoSrc,
            signatureSrc,
        });

        let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                ],
            });
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'load' });
            await page.evaluate(async () => {
                const g = globalThis as unknown as {
                    document: {
                        querySelectorAll: (sel: string) => Iterable<unknown>;
                    };
                };
                const images = [
                    ...g.document.querySelectorAll('img'),
                ] as Array<{
                    complete: boolean;
                    addEventListener: (
                        type: string,
                        fn: () => void,
                        opts?: { once?: boolean },
                    ) => void;
                }>;
                await Promise.all(
                    images.map((img) =>
                        img.complete
                            ? Promise.resolve()
                            : new Promise<void>((resolve) => {
                                  img.addEventListener(
                                      'load',
                                      () => resolve(),
                                      { once: true },
                                  );
                                  img.addEventListener(
                                      'error',
                                      () => resolve(),
                                      { once: true },
                                  );
                              }),
                    ),
                );
            });

            await page.emulateMediaType('print');
            await page.evaluate(() => {
                const g = globalThis as any;
                const doc = g.document;
                const container = doc.querySelector('.container');
                const coverPage = doc.querySelector('.cover-page');
                const spacer = doc.querySelector('.footer-spacer');
                const footer = doc.querySelector('.doc-footer');
                if (container && spacer && footer) {
                    // A4 printable height = (297mm - 12mm top - 14mm bottom) = 271mm
                    const pageHeightPx = (271 / 25.4) * 96;

                    // Temporarily collapse spacer to measure real content height
                    spacer.style.height = '0px';

                    const totalHeight = container.scrollHeight;
                    const coverHeight = coverPage
                        ? coverPage.getBoundingClientRect().height
                        : 0;
                    // The cover page has a forced page-break-after, so it always
                    // consumes whole printed page(s) regardless of its own height.
                    const coverPages = coverPage
                        ? Math.max(1, Math.ceil(coverHeight / pageHeightPx))
                        : 0;
                    const restHeight = Math.max(0, totalHeight - coverHeight);
                    const footerHeight = footer.getBoundingClientRect().height;

                    const restPages =
                        restHeight > 0 ? Math.ceil(restHeight / pageHeightPx) : 0;
                    const totalPages = Math.max(1, coverPages + restPages);
                    const lastPageBottom = totalPages * pageHeightPx;

                    // Height already consumed once the flowing (non-cover) content ends.
                    const consumedUpToContentEnd = coverPages * pageHeightPx + restHeight;

                    // Space remaining on last page minus footer height
                    const remaining = lastPageBottom - consumedUpToContentEnd - footerHeight;

                    if (remaining > 0) {
                        spacer.style.height = `${remaining}px`;
                    } else {
                        spacer.style.height = '0px';
                    }
                }
            });

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '12mm',
                    bottom: '14mm',
                    left: '10mm',
                    right: '10mm',
                },
            });
            const qn = String((q as any).quotationNumber || '').trim();
            const title = String((q as any).details?.title || '').trim();
            const stem = qn
                ? qn.startsWith('#')
                    ? qn
                    : `#${qn}`
                : title || 'quotation';
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
            await browser?.close().catch(() => {});
        }
    }
}
