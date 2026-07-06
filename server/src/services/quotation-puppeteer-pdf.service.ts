import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import QuotationModel from '../models/quotation.model.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';

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
    const pricing = q.pricing || {};
    const phases = Array.isArray(q.phases) ? q.phases : [];
    const additionalServices = Array.isArray(q.additionalServices)
        ? q.additionalServices
        : [];
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
    const finalAmount = Number(totals?.grandTotal ?? pricing?.basePrice ?? 0);

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

    interface ScopeModule {
        label: string;
        badgeText: string;
        items: string[];
    }
    const scopes: ScopeModule[] = [];

    if (phases.length > 0) {
        phases.forEach((p: any) => {
            const title = String(p.title || 'Service Module').trim();
            const titleLower = title.toLowerCase();
            let badgeText = 'WEB DEV';
            if (titleLower.includes('market') || titleLower.includes('seo'))
                badgeText = 'MARKETING';
            else if (
                titleLower.includes('video') ||
                titleLower.includes('motion')
            )
                badgeText = 'VIDEO EDITING';
            else if (
                titleLower.includes('photo') ||
                titleLower.includes('retouch')
            )
                badgeText = 'PHOTO EDITING';
            else if (
                titleLower.includes('web') ||
                titleLower.includes('dev') ||
                titleLower.includes('design')
            )
                badgeText = 'WEB DEV';
            else badgeText = title.substring(0, 14).toUpperCase();

            const items = Array.isArray(p.items)
                ? p.items.map((x: any) => String(x || '').trim()).filter(Boolean)
                : [];
            if (items.length === 0 && p.description) {
                items.push(String(p.description).trim());
            }

            scopes.push({
                label: title,
                badgeText,
                items:
                    items.length > 0
                        ? items
                        : ['Comprehensive deliverables and feature scope as agreed.'],
            });
        });
    }

    if (additionalServices.length > 0) {
        scopes.push({
            label: 'Additional Add-on Services & Enhancements',
            badgeText: 'ADD-ONS',
            items: additionalServices.map((s: any) => {
                const qty = s.quantity ?? 1;
                const cycle =
                    s.billingCycle && s.billingCycle !== 'one-time'
                        ? ` (${s.billingCycle})`
                        : '';
                const desc = s.description ? ` — ${s.description}` : '';
                return `${s.title}${cycle}${desc} [Qty: ${qty} @ ${formatMoneyPdf(s.price, currency)}]`;
            }),
        });
    }

    if (scopes.length === 0) {
        scopes.push({
            label: 'Web Design & Development Scope',
            badgeText: 'WEB DEV',
            items: [
                details?.title || 'Comprehensive Responsive Web Architecture & Design System',
                'High-converting Landing Page with Modern UI/UX',
                'Dynamic Backend API & Database Integration',
                'Speed Optimization (90+ Google PageSpeed Score)',
            ],
        });
    }

    const uniqueBadges = Array.from(new Set(scopes.map((s) => s.badgeText)));

    const badgesHtml = uniqueBadges
        .map(
            (badge) => `<span class="scope-badge">${esc(badge)}</span>`
        )
        .join('');

    const modulesHtml = scopes
        .map((scope, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const itemsHtml = scope.items
                .map(
                    (item, itemIdx) => `
              <div class="deliverable-item">
                <span class="deliv-num">${String(itemIdx + 1).padStart(2, '0')}</span>
                <span class="deliv-text">${esc(item)}</span>
              </div>`
                )
                .join('');
            return `
        <div class="module-card">
          <div class="module-header">
            <span class="module-title">${letter}. ${esc(scope.label)}</span>
            <span class="module-count">${scope.items.length} Deliverables</span>
          </div>
          <div class="module-body">
            ${itemsHtml}
          </div>
        </div>`;
        })
        .join('');

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

    const overviewHtml = q.overview
        ? `
      <div class="sec-heading"><span class="sec-dot"></span> Executive Overview</div>
      <div class="module-card" style="padding: 16px 20px; font-size: 12.5px; color: #334155; line-height: 1.6; margin-bottom: 24px;">
        ${esc(q.overview).replace(/\n/g, '<br/>')}
      </div>`
        : '';

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
      display: flex;
      justify-content: center;
      align-items: center;
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
  </style>
</head>
<body>
  <div class="container">
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
        <h1 class="proposal-title">${esc(proposalTitle)}</h1>
        <div class="badges-wrap">
          ${badgesHtml}
        </div>
      </div>
      <div class="proposal-right">
        <div class="label-purple">PREPARED FOR</div>
        <div class="client-name">${esc(clientName)}</div>
        ${clientEmail ? `<div class="client-email">${esc(clientEmail)}</div>` : ''}
        <div class="total-divider">
          <span class="total-label">Grand Total Investment:</span>
          <span class="total-amount">${formatMoneyPdf(finalAmount, currency)}</span>
        </div>
      </div>
    </div>

    ${overviewHtml}

    <div class="sec-heading">
      <span class="sec-dot"></span>
      1. Services &amp; Deliverables Scope (${scopes.length} Modules)
    </div>
    <div style="margin-bottom: 24px;">
      ${modulesHtml}
    </div>

    <div class="three-col-grid">
      <div class="info-card col-pink">
        <div class="sec-heading col-pink-title">
          <span class="sec-dot pink"></span>
          2. Not Included in Price
        </div>
        <ul class="info-list">
          ${notIncludedHtml}
        </ul>
      </div>
      <div class="info-card col-indigo">
        <div class="sec-heading col-indigo-title">
          <span class="sec-dot indigo"></span>
          3. Client Needs to Provide
        </div>
        <ul class="info-list">
          ${clientReqHtml}
        </ul>
      </div>
      <div class="info-card col-purple">
        <div class="sec-heading col-purple-title">
          <span class="sec-dot" style="background: var(--accent);"></span>
          4. Payment Milestones
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
      <div>
        &copy; ${new Date().getFullYear()} <a href="https://webbriks.com">WebBriks</a>. All rights reserved.
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
                const spacer = doc.querySelector('.footer-spacer');
                const footer = doc.querySelector('.doc-footer');
                if (container && spacer && footer) {
                    // A4 printable height = (297mm - 12mm top - 14mm bottom) = 271mm
                    const pageHeightPx = (271 / 25.4) * 96;

                    // Temporarily collapse spacer to measure real content height
                    spacer.style.height = '0px';

                    const contentHeight = container.scrollHeight;
                    const footerHeight = footer.getBoundingClientRect().height;
                    const totalPages = Math.ceil(contentHeight / pageHeightPx);
                    const lastPageBottom = totalPages * pageHeightPx;

                    // Space remaining on last page minus footer height
                    const remaining = lastPageBottom - contentHeight - footerHeight;

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
