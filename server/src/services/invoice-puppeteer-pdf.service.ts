import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QuotationModel from '../models/quotation.model.js';
import QuotationServiceModel from '../models/quotation-service.model.js';
import OrderModel from '../models/order.model.js';
import ClientModel from '../models/client.model.js';
import ReceiptModel from '../models/receipt.model.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import {
    buildEmbeddedFontCss,
    extractBrandMark,
} from './quotation-puppeteer-pdf.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Shared formatting helpers (kept identical to the receipt/quotation PDFs) ──

/** Matches the Quotation / Receipt puppeteer PDF money formatting exactly. */
function formatMoneyPdf(amount: number | null | undefined, currency?: string | null): string {
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
        .replace(/"/g, '&quot;');
}

function formatDatePdf(raw: unknown): string {
    if (!raw) return '—';
    try {
        return format(new Date(String(raw)), 'PPP');
    } catch {
        return String(raw);
    }
}

const CATEGORY_LABELS: Record<string, string> = {
    'web-development': 'Web Development',
    'photo-editing': 'Photo Editing',
    'marketing': 'Marketing',
    'video-editing': 'Video Editing',
};

const DEFAULT_LOGO =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png';

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
    logger.error({ err: e }, 'invoice.pdf.local_logo_load_failed');
}

const DEFAULT_SIGNATURE =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png';

const FALLBACK_PIXEL_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const DEFAULT_COMPANY = {
    name: 'WebBriks',
    address: '115 Senpara Parbata, Mirpur, Dhaka 1216, Bangladesh.',
    email: 'info@webbriks.com',
    phone: '+8801977201923',
};

const SIGNATORY_NAME = process.env.COMPANY_SIGNATORY_NAME || 'Md. Ashaduzzaman';
const SIGNATORY_ROLE = process.env.COMPANY_SIGNATORY_ROLE || 'Founder & CEO';

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 18_000);
        const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
        clearTimeout(timer);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) return null;
        const ctRaw = (res.headers.get('content-type') || '').split(';')[0] ?? '';
        const ct = ctRaw.trim() || 'image/png';
        const safeCt = /^image\/[a-z0-9.+-]+$/i.test(ct) ? ct : 'image/png';
        return `data:${safeCt};base64,${buf.toString('base64')}`;
    } catch {
        return null;
    }
}

// ─── Normalized invoice shape ────────────────────────────────────────────────

type PaymentState = 'paid' | 'partial' | 'unpaid';

interface InvoiceLine {
    label: string;
    sublabel?: string;
    amount: number;
}

interface InvoiceData {
    invoiceNumber: string;
    quotationNumber: string;
    projectTitle: string;
    issueDate: Date;
    currency: string;
    client: {
        contactName: string;
        companyName?: string;
        address?: string;
        email?: string;
        phone?: string;
    };
    lines: InvoiceLine[];
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
    totalPaid: number;
    balanceDue: number;
    paymentState: PaymentState;
}

interface InvoicePdfContext {
    logoSrc: string;
    signatureSrc: string;
    /** Cropped brand icon for the page watermark (shared with the quotation PDF). */
    markSrc: string;
    /** Inlined @font-face block (Inter / Geist Mono), shared with the quotation PDF. */
    fontCss: string;
}

/** `QTN-2026-0007` → `INV-2026-0007`; otherwise `INV-<given>`; else a dated stub. */
function toInvoiceNumber(quotationNumber?: string | null): string {
    const qn = String(quotationNumber ?? '')
        .trim()
        .replace(/^#/, '');
    if (/^QTN[-\s]/i.test(qn)) return qn.replace(/^QTN/i, 'INV');
    if (qn) return `INV-${qn}`;
    return `INV-${new Date().getFullYear()}-DRAFT`;
}

function lineAmountFromService(svc: Record<string, any>): number {
    const base = Number(svc?.basePrice) || 0;
    const items = Array.isArray(svc?.lineItems) ? svc.lineItems : [];
    const itemsTotal = items.reduce(
        (t: number, li: Record<string, any>) =>
            t + (Number(li?.price) || 0) * (Number(li?.quantity) || 1),
        0,
    );
    return base + itemsTotal;
}

function derivePaymentState(grandTotal: number, totalPaid: number): PaymentState {
    if (grandTotal > 0 && grandTotal - totalPaid <= 0.009) return 'paid';
    if (totalPaid > 0.009) return 'partial';
    return 'unpaid';
}

async function attachReceiptLedger(
    quotationGroupId: string | undefined,
    grandTotal: number,
): Promise<{ totalPaid: number; balanceDue: number; paymentState: PaymentState }> {
    let totalPaid = 0;
    if (quotationGroupId) {
        const receipt = await ReceiptModel.findOne({ quotationGroupId })
            .select('totalPaid status')
            .lean();
        if (receipt && receipt.status !== 'void') {
            totalPaid = Number(receipt.totalPaid) || 0;
        }
    }
    const balanceDue = Math.max(0, grandTotal - totalPaid);
    return { totalPaid, balanceDue, paymentState: derivePaymentState(grandTotal, totalPaid) };
}

// ─── HTML ───────────────────────────────────────────────────────────────────

const PAYMENT_STATE_META: Record<
    PaymentState,
    { label: string; className: string }
> = {
    paid: { label: 'Paid in Full', className: 'is-paid' },
    partial: { label: 'Partially Paid', className: 'is-partial' },
    unpaid: { label: 'Payment Due', className: 'is-unpaid' },
};

export function buildInvoiceHtml(inv: InvoiceData, ctx: InvoicePdfContext): string {
    const c = inv.currency || 'BDT';
    const payUrl = (process.env.PAYMENT_CLIENT_URL || '').trim();
    const stateMeta = PAYMENT_STATE_META[inv.paymentState];
    const paidInFull = inv.balanceDue <= 0.009;

    const lineRows = inv.lines
        .map(
            (l, i) => `
        <tr class="li-row">
          <td class="li-idx">${String(i + 1).padStart(2, '0')}</td>
          <td class="li-main">
            <div class="li-title">${esc(l.label)}</div>
            ${l.sublabel ? `<div class="li-sub">${esc(l.sublabel)}</div>` : ''}
          </td>
          <td class="li-amt">${esc(formatMoneyPdf(l.amount, c))}</td>
        </tr>`,
        )
        .join('');

    const discountRow =
        inv.discountAmount > 0.009
            ? `<tr class="sum-row"><td>Discount</td><td class="sum-amt">&minus;&nbsp;${esc(formatMoneyPdf(inv.discountAmount, c))}</td></tr>`
            : '';
    const taxRow =
        inv.taxAmount > 0.009
            ? `<tr class="sum-row"><td>Tax</td><td class="sum-amt">+&nbsp;${esc(formatMoneyPdf(inv.taxAmount, c))}</td></tr>`
            : '';
    const paidRow =
        inv.totalPaid > 0.009
            ? `<tr class="sum-row is-paid-row"><td>Amount Paid</td><td class="sum-amt">&minus;&nbsp;${esc(formatMoneyPdf(inv.totalPaid, c))}</td></tr>`
            : '';

    const signatureBlock = ctx.signatureSrc
        ? `<img class="sig-img" src="${esc(ctx.signatureSrc)}" alt="" width="188" height="46" />`
        : `<div class="sig-img-spacer" aria-hidden="true"></div>`;

    const watermark = ctx.markSrc
        ? `<div class="page-watermark"><img src="${esc(ctx.markSrc)}" alt="" /></div>`
        : '';

    const payLine = payUrl
        ? `<div class="pay-row"><span class="pay-k">Pay online</span><span class="pay-v"><a href="${esc(payUrl)}">${esc(payUrl.replace(/^https?:\/\//, ''))}</a></span></div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(inv.invoiceNumber)}</title>
  <style>
    ${ctx.fontCss}

    :root {
      --brand:      #4E12D4;
      --brand-mid:  #7c3aed;
      --brand-soft: #f4f0ff;
      --brand-line: rgba(78, 18, 212, 0.16);

      --ink:      #14101f;
      --ink-2:    #3b3550;
      --muted:    #6b6580;
      --faint:    #9a94ac;
      --line:     #ece9f2;
      --surface:  #ffffff;
      --panel:    #faf9fd;

      --ok:   #0f8a5f;
      --ok-bg:#e8f6ef;
      --due:  #b42318;
      --due-bg:#fdeceb;
      --warn: #a15c07;
      --warn-bg:#fdf3e3;

      --font-sans: 'Inter', system-ui, -apple-system, 'Hind Siliguri', sans-serif;
      --font-mono: 'Geist Mono', ui-monospace, 'JetBrains Mono', monospace;
    }

    @page { size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body { background: var(--surface); }
    body {
      font-family: var(--font-sans);
      color: var(--ink-2);
      font-size: 9.5pt;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-font-smoothing: antialiased;
      font-variant-numeric: tabular-nums;
    }
    strong { font-weight: 600; color: var(--ink); }
    a { color: var(--brand); text-decoration: none; }

    /* Brand mark behind every page — same treatment as the quotation PDF. */
    .page-watermark {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 95mm;
      opacity: 0.035;
      z-index: 0;
      pointer-events: none;
    }
    .page-watermark img { width: 100%; height: auto; display: block; }

    .sheet { position: relative; z-index: 1; }

    /* ── Masthead ──────────────────────────────────────────────────────────── */
    .top-rule {
      height: 3px;
      background: linear-gradient(90deg, var(--brand-mid), var(--brand) 55%, #2a0785);
      border-radius: 2px;
      margin-bottom: 6mm;
    }
    .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; }
    .brand-logo { height: 11mm; width: auto; object-fit: contain; object-position: left center; display: block; }
    .doc-id { text-align: right; }
    .doc-word {
      font-size: 20pt; font-weight: 800; letter-spacing: -0.02em;
      color: var(--ink); line-height: 1;
    }
    .doc-no {
      font-family: var(--font-mono); font-size: 8.5pt; font-weight: 500;
      letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted);
      margin-top: 5px;
    }

    /* ── Hero: bill-to + amount due ───────────────────────────────────────── */
    .hero { display: flex; gap: 10mm; margin-top: 7mm; }
    .hero-left { flex: 1.1; }
    .hero-right { flex: 1; }

    .eyebrow {
      font-family: var(--font-mono); font-size: 7.5pt; font-weight: 600;
      letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-mid);
      margin-bottom: 6px;
    }
    .party-name { font-size: 12.5pt; font-weight: 700; color: var(--ink); line-height: 1.3; }
    .party-line { font-size: 9pt; color: var(--muted); line-height: 1.6; margin-top: 2px; }

    .due-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 5mm 5mm 4mm;
    }
    .due-label {
      font-family: var(--font-mono); font-size: 7.5pt; font-weight: 600;
      letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted);
    }
    .due-figure {
      font-family: var(--font-mono); font-weight: 600;
      font-size: 17pt; letter-spacing: -0.01em; line-height: 1.1;
      color: var(--ink); margin-top: 3px;
    }
    .due-card.is-open .due-figure { color: var(--due); }
    .due-card.is-clear .due-figure { color: var(--ok); font-size: 14pt; }

    .status-tag {
      display: inline-block; margin-top: 8px;
      font-family: var(--font-mono); font-size: 7pt; font-weight: 600;
      letter-spacing: 0.14em; text-transform: uppercase;
      padding: 4px 9px; border-radius: 999px;
    }
    .status-tag.is-paid    { color: var(--ok);   background: var(--ok-bg); }
    .status-tag.is-partial { color: var(--warn); background: var(--warn-bg); }
    .status-tag.is-unpaid  { color: var(--due);  background: var(--due-bg); }

    .due-meta { margin-top: 10px; border-top: 1px solid var(--line); padding-top: 8px; }
    .due-meta .m-row { display: flex; justify-content: space-between; font-size: 8.5pt; line-height: 1.7; }
    .due-meta .m-k { color: var(--faint); }
    .due-meta .m-v { color: var(--ink-2); font-weight: 500; font-family: var(--font-mono); }

    /* ── Line items ───────────────────────────────────────────────────────── */
    .section-title {
      margin: 6mm 0 3mm;
      font-size: 8pt; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--ink);
      font-family: var(--font-mono);
    }
    .project-title {
      font-size: 13pt; font-weight: 700; color: var(--ink);
      letter-spacing: -0.01em; margin-bottom: 5mm;
    }

    table.items { width: 100%; border-collapse: collapse; }
    table.items thead th {
      font-family: var(--font-mono); font-size: 7pt; font-weight: 600;
      letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted);
      text-align: left; padding: 0 0 7px; border-bottom: 1.5px solid var(--ink);
    }
    table.items thead th.h-amt { text-align: right; }
    table.items .li-row td { padding: 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
    .li-idx {
      width: 12mm; font-family: var(--font-mono); font-size: 8pt;
      color: var(--faint); padding-top: 8px !important;
    }
    .li-title { font-size: 10pt; font-weight: 600; color: var(--ink); }
    .li-sub { font-size: 8.5pt; color: var(--muted); margin-top: 2px; }
    .li-amt {
      text-align: right; white-space: nowrap; width: 34mm;
      font-family: var(--font-mono); font-size: 10pt; font-weight: 500; color: var(--ink);
      padding-top: 8px !important;
    }

    /* ── Totals ───────────────────────────────────────────────────────────── */
    .totals-wrap { display: flex; justify-content: flex-end; margin-top: 5mm; }
    table.totals { width: 74mm; border-collapse: collapse; }
    table.totals td { padding: 5px 0; font-size: 9pt; }
    table.totals .sum-amt { text-align: right; white-space: nowrap; font-family: var(--font-mono); }
    table.totals .sum-row td { color: var(--muted); }
    table.totals .sum-row.is-paid-row td { color: var(--ok); font-weight: 600; }
    table.totals .grand td {
      color: var(--ink); font-weight: 700; font-size: 10.5pt;
      border-top: 1px solid var(--line); padding-top: 9px;
    }

    .balance-bar {
      margin-top: 5mm; border-radius: 10px; padding: 4mm 6mm;
      display: flex; justify-content: space-between; align-items: baseline;
      page-break-inside: avoid;
    }
    .balance-bar.is-open  { background: var(--due-bg); border: 1px solid rgba(180,35,24,0.22); }
    .balance-bar.is-clear { background: var(--ok-bg); border: 1px solid rgba(15,138,95,0.22); }
    .balance-k {
      font-family: var(--font-mono); font-size: 8pt; font-weight: 600;
      letter-spacing: 0.14em; text-transform: uppercase;
    }
    .balance-bar.is-open .balance-k  { color: var(--due); }
    .balance-bar.is-clear .balance-k { color: var(--ok); }
    .balance-v { font-family: var(--font-mono); font-weight: 700; font-size: 14pt; }
    .balance-bar.is-open .balance-v  { color: var(--due); }
    .balance-bar.is-clear .balance-v { color: var(--ok); }

    /* ── Closing ──────────────────────────────────────────────────────────── */
    .closing { margin-top: 7mm; page-break-inside: avoid; }
    .pay-note {
      margin-top: 6mm;
      border-left: 2px solid var(--brand-line);
      padding: 0.5mm 0 0.5mm 5mm;
      font-size: 8pt; color: var(--muted); line-height: 1.55;
      max-width: 122mm;
    }
    .pay-row { margin-top: 3px; display: flex; gap: 8px; }
    .pay-k {
      font-family: var(--font-mono); font-size: 7pt; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--faint); min-width: 18mm;
    }
    .pay-v a { font-weight: 600; }

    .sign-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8mm; }
    .sig-block { max-width: 70mm; }
    .sig-img { display: block; width: 176px; height: 42px; object-fit: contain; object-position: left bottom; margin-bottom: 4px; }
    .sig-img-spacer { height: 16px; margin-bottom: 4px; }
    .sig-line { border-bottom: 1px solid var(--ink); width: 58mm; margin-bottom: 5px; }
    .sig-name { font-size: 9pt; font-weight: 700; color: var(--ink); }
    .sig-role { font-size: 7.5pt; color: var(--muted); margin-top: 1px; }
    .stamp {
      font-family: var(--font-mono);
      font-size: 7pt; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint);
    }
  </style>
</head>
<body>
  ${watermark}
  <div class="sheet">

    <div class="top-rule"></div>

    <div class="masthead">
      <img class="brand-logo" src="${esc(ctx.logoSrc)}" alt="WebBriks" />
      <div class="doc-id">
        <div class="doc-word">Invoice</div>
        <div class="doc-no">${esc(inv.invoiceNumber)}</div>
      </div>
    </div>

    <div class="hero">
      <div class="hero-left">
        <div class="eyebrow">Billed To</div>
        <div class="party-name">${esc(inv.client.contactName)}</div>
        ${inv.client.companyName ? `<div class="party-line">${esc(inv.client.companyName)}</div>` : ''}
        ${inv.client.address ? `<div class="party-line">${esc(inv.client.address)}</div>` : ''}
        ${inv.client.email ? `<div class="party-line">${esc(inv.client.email)}</div>` : ''}
        ${inv.client.phone ? `<div class="party-line">${esc(inv.client.phone)}</div>` : ''}

        <div class="eyebrow" style="margin-top:7mm;">From</div>
        <div class="party-name" style="font-size:10.5pt;">${esc(DEFAULT_COMPANY.name)}</div>
        <div class="party-line">${esc(DEFAULT_COMPANY.address)}</div>
        <div class="party-line">${esc(DEFAULT_COMPANY.email)} &nbsp;·&nbsp; ${esc(DEFAULT_COMPANY.phone)}</div>
      </div>

      <div class="hero-right">
        <div class="due-card ${paidInFull ? 'is-clear' : 'is-open'}">
          <div class="due-label">${paidInFull ? 'Balance' : 'Amount Due'}</div>
          <div class="due-figure">${paidInFull ? 'Paid in full' : esc(formatMoneyPdf(inv.balanceDue, c))}</div>
          <span class="status-tag ${stateMeta.className}">${esc(stateMeta.label)}</span>
          <div class="due-meta">
            <div class="m-row"><span class="m-k">Issued</span><span class="m-v">${esc(formatDatePdf(inv.issueDate))}</span></div>
            <div class="m-row"><span class="m-k">Quotation</span><span class="m-v">${esc(inv.quotationNumber || '—')}</span></div>
            <div class="m-row"><span class="m-k">Total value</span><span class="m-v">${esc(formatMoneyPdf(inv.grandTotal, c))}</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title">Services</div>
    <div class="project-title">${esc(inv.projectTitle || 'Project')}</div>

    <table class="items">
      <thead>
        <tr><th class="h-idx"></th><th>Description</th><th class="h-amt">Amount</th></tr>
      </thead>
      <tbody>
        ${lineRows || `<tr class="li-row"><td class="li-idx">01</td><td class="li-main"><div class="li-title">Project fee</div></td><td class="li-amt">${esc(formatMoneyPdf(inv.subtotal, c))}</td></tr>`}
      </tbody>
    </table>

    <div class="totals-wrap">
      <table class="totals">
        <tr class="sum-row"><td>Subtotal</td><td class="sum-amt">${esc(formatMoneyPdf(inv.subtotal, c))}</td></tr>
        ${discountRow}
        ${taxRow}
        <tr class="grand"><td>Grand Total</td><td class="sum-amt">${esc(formatMoneyPdf(inv.grandTotal, c))}</td></tr>
        ${paidRow}
      </table>
    </div>

    <div class="balance-bar ${paidInFull ? 'is-clear' : 'is-open'}">
      <span class="balance-k">${paidInFull ? 'Settled' : 'Balance Due'}</span>
      <span class="balance-v">${paidInFull ? esc(formatMoneyPdf(inv.grandTotal, c)) : esc(formatMoneyPdf(inv.balanceDue, c))}</span>
    </div>

    <div class="pay-note">
      This invoice covers the services listed above under quotation
      <strong>${esc(inv.quotationNumber || '—')}</strong>. Any payments already
      recorded are reflected in the balance above.
      ${payLine}
    </div>

    <div class="closing">
      <div class="sign-row">
        <div class="sig-block">
          ${signatureBlock}
          <div class="sig-line"></div>
          <div class="sig-name">${esc(SIGNATORY_NAME)}</div>
          <div class="sig-role">${esc(SIGNATORY_ROLE)}, ${esc(DEFAULT_COMPANY.name)}</div>
        </div>
        <div class="stamp">${esc(inv.invoiceNumber)}</div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

async function renderPdf(
    inv: InvoiceData,
): Promise<{ buffer: Buffer; filename: string }> {
    const logoSrc =
        LOCAL_LOGO_BASE64 || (await fetchImageAsDataUrl(DEFAULT_LOGO)) || FALLBACK_PIXEL_PNG;
    const signatureUrl = process.env.COMPANY_SIGNATURE_URL || DEFAULT_SIGNATURE;
    const signatureSrc = (await fetchImageAsDataUrl(signatureUrl)) || '';
    const fontCss = await buildEmbeddedFontCss().catch(() => '');

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        // Same cropped brand icon the quotation PDF uses for its watermark.
        const markSrc = (await extractBrandMark(browser, logoSrc).catch(() => null)) || '';

        const html = buildInvoiceHtml(inv, { logoSrc, signatureSrc, markSrc, fontCss });
        const page = await browser.newPage();

        // PDF page geometry, in CSS px (1mm = 96/25.4 px). The viewport is set
        // to the printable content box so DOM measurements match the paginated
        // output — see the signature-anchoring step below.
        const MM = 96 / 25.4;
        const MARGIN_TOP_MM = 14;
        const MARGIN_BOTTOM_MM = 20;
        const CONTENT_W = Math.round((210 - 32) * MM);
        const CONTENT_H = (297 - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * MM;
        await page.setViewport({ width: CONTENT_W, height: Math.round(CONTENT_H) });

        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(async () => {
            const g = globalThis as unknown as {
                document: { querySelectorAll: (sel: string) => Iterable<unknown> };
            };
            const images = [...g.document.querySelectorAll('img')] as Array<{
                complete: boolean;
                addEventListener: (t: string, fn: () => void, o?: { once?: boolean }) => void;
            }>;
            await Promise.all(
                images.map((img) =>
                    img.complete
                        ? Promise.resolve()
                        : new Promise<void>((resolve) => {
                              img.addEventListener('load', () => resolve(), { once: true });
                              img.addEventListener('error', () => resolve(), { once: true });
                          }),
                ),
            );
        });

        await page.emulateMediaType('print');

        // Anchor the signature block to the bottom of its page. Without this a
        // spilled `.closing` floats alone at the top of the last page; here we
        // measure where it lands and insert a spacer so it drops just above the
        // running footer. A comfortably-fitting single-page invoice is left as-is.
        await page.evaluate((contentHRaw: number) => {
            const g = globalThis as any;
            const el = g.document.querySelector('.closing');
            if (!el) return;
            // Under-shoot slightly so rounding never pushes the block a page too far.
            const contentH = contentHRaw * 0.985;
            const rect = el.getBoundingClientRect();
            const top = rect.top;
            const h = rect.height;
            if (top + h <= contentH) return; // fits on the first page — leave it
            const posInPage = ((top % contentH) + contentH) % contentH;
            const spaceLeft = contentH - posInPage;
            const CLEAR = 18;
            const spacerH =
                spaceLeft >= h + CLEAR
                    ? spaceLeft - h - CLEAR
                    : spaceLeft + (contentH - h - CLEAR);
            if (spacerH <= 0) return;
            const spacer = g.document.createElement('div');
            spacer.style.height = spacerH + 'px';
            spacer.setAttribute('aria-hidden', 'true');
            el.parentNode.insertBefore(spacer, el);
        }, CONTENT_H);

        // Native running footer — sits at the bottom of every page (incl. a
        // short final page), so a spilled signature never floats alone.
        const footerTemplate = `
          <div style="width:100%;box-sizing:border-box;padding:0 16mm;
                      font-family:-apple-system,'Segoe UI',Roboto,sans-serif;
                      font-size:7pt;color:#9a94ac;
                      display:flex;justify-content:space-between;align-items:center;">
            <span>&copy; ${new Date().getFullYear()} WebBriks LLC &nbsp;&middot;&nbsp; info@webbriks.com</span>
            <span>${esc(inv.invoiceNumber)} &nbsp;&middot;&nbsp; Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>`;

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate,
            margin: { top: '14mm', bottom: '20mm', left: '16mm', right: '16mm' },
        });

        const stem = inv.invoiceNumber || 'invoice';
        const filename = `${stem}.pdf`.replace(/[/\\?%*:|"<>]/g, '-');
        return { buffer: Buffer.from(pdf), filename };
    } catch (e: unknown) {
        const err = e as { message?: string };
        logger.error({ err: e, invoiceNumber: inv.invoiceNumber }, 'invoice.puppeteer_pdf_failed');
        throw new AppError(err?.message || 'Failed to generate invoice PDF', 500);
    } finally {
        await browser?.close().catch(() => {});
    }
}

export class InvoicePuppeteerPdfService {
    /** On-demand invoice PDF built from an accepted quotation's Order snapshot. */
    static async generateFromOrder(
        orderId: string,
    ): Promise<{ buffer: Buffer; filename: string }> {
        const order = await OrderModel.findById(orderId).lean();
        if (!order) throw new AppError('Order not found', 404);

        const snap = (order.quotationSnapshot || {}) as Record<string, any>;
        const services: Record<string, any>[] = Array.isArray(snap.services) ? snap.services : [];

        const lines: InvoiceLine[] = services.map((s) => ({
            label: CATEGORY_LABELS[s?.category] || String(s?.category || 'Service'),
            sublabel: s?.scopeDescription || undefined,
            amount: lineAmountFromService(s),
        }));

        const totals = snap.totals || {
            subtotal: lines.reduce((t, l) => t + l.amount, 0),
            discountAmount: Number(snap.discountAmount) || 0,
            taxAmount: Number(snap.taxAmount) || 0,
            grandTotal:
                Number(snap.grandTotal) ||
                Number(order.totalPrice) ||
                lines.reduce((t, l) => t + l.amount, 0),
        };

        const currency = snap.currency || order.currency || 'BDT';
        const client = await ClientModel.findById(order.clientId).lean();
        const ledger = await attachReceiptLedger(order.quotationGroupId, Number(totals.grandTotal) || 0);

        const inv: InvoiceData = {
            invoiceNumber: toInvoiceNumber(snap.quotationNumber),
            quotationNumber: snap.quotationNumber || '',
            projectTitle: snap.details?.title || snap.templateName || order.orderNumber || 'Project',
            issueDate: new Date(),
            currency,
            client: {
                contactName: client?.name || snap.clientName || 'Client',
                address: client?.address || client?.officeAddress,
                email: client?.emails?.[0] || snap.clientEmail,
                phone: client?.phone,
            },
            lines,
            subtotal: Number(totals.subtotal) || 0,
            discountAmount: Number(totals.discountAmount) || 0,
            taxAmount: Number(totals.taxAmount) || 0,
            grandTotal: Number(totals.grandTotal) || 0,
            ...ledger,
        };

        return renderPdf(inv);
    }

    /** On-demand invoice PDF built directly from a quotation. */
    static async generateFromQuotation(
        quotationId: string,
    ): Promise<{ buffer: Buffer; filename: string }> {
        const q = await QuotationModel.findById(quotationId)
            .populate('clientId', 'name address officeAddress emails phone')
            .lean();
        if (!q) throw new AppError('Quotation not found', 404);

        const svcDocs = await QuotationServiceModel.find({ quotationId: q._id })
            .populate('lineItems')
            .lean();

        const lines: InvoiceLine[] = svcDocs.map((s: Record<string, any>) => ({
            label: CATEGORY_LABELS[s?.category] || String(s?.category || 'Service'),
            sublabel: s?.scopeDescription || undefined,
            amount: lineAmountFromService(s),
        }));

        const totals = (q as Record<string, any>).totals || {
            subtotal: lines.reduce((t, l) => t + l.amount, 0),
            discountAmount: 0,
            taxAmount: 0,
            grandTotal: lines.reduce((t, l) => t + l.amount, 0),
        };

        const currency = (q as Record<string, any>).currency || 'BDT';
        const client = (q as Record<string, any>).clientId as Record<string, any> | null;
        const ledger = await attachReceiptLedger(
            (q as Record<string, any>).quotationGroupId,
            Number(totals.grandTotal) || 0,
        );

        const snapClient = (q as Record<string, any>).client || {};

        const inv: InvoiceData = {
            invoiceNumber: toInvoiceNumber((q as Record<string, any>).quotationNumber),
            quotationNumber: (q as Record<string, any>).quotationNumber || '',
            projectTitle: (q as Record<string, any>).details?.title || 'Project',
            issueDate: new Date(),
            currency,
            client: {
                contactName: client?.name || snapClient.contactName || 'Client',
                companyName: snapClient.companyName,
                address: client?.address || client?.officeAddress || snapClient.address,
                email: client?.emails?.[0] || snapClient.email,
                phone: client?.phone || snapClient.phone,
            },
            lines,
            subtotal: Number(totals.subtotal) || 0,
            discountAmount: Number(totals.discountAmount) || 0,
            taxAmount: Number(totals.taxAmount) || 0,
            grandTotal: Number(totals.grandTotal) || 0,
            ...ledger,
        };

        return renderPdf(inv);
    }
}
