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

const PAYMENT_STATE_META: Record<PaymentState, { label: string; className: string }> = {
    paid: { label: 'Paid in Full', className: 'pill-paid' },
    partial: { label: 'Partially Paid', className: 'pill-partial' },
    unpaid: { label: 'Payment Due', className: 'pill-unpaid' },
};

export function buildInvoiceHtml(inv: InvoiceData, ctx: InvoicePdfContext): string {
    const c = inv.currency || 'BDT';
    const payUrl = (process.env.PAYMENT_CLIENT_URL || '').trim();
    const stateMeta = PAYMENT_STATE_META[inv.paymentState];

    const lineRows = inv.lines
        .map(
            (l) => `
        <tr class="li-row">
          <td>
            <div class="li-title">${esc(l.label)}</div>
            ${l.sublabel ? `<div class="li-sub">${esc(l.sublabel)}</div>` : ''}
          </td>
          <td class="li-amt">${formatMoneyPdf(l.amount, c)}</td>
        </tr>`,
        )
        .join('');

    const discountRow =
        inv.discountAmount > 0.009
            ? `<tr class="sum-row"><td>Discount</td><td class="sum-amt">− ${formatMoneyPdf(inv.discountAmount, c)}</td></tr>`
            : '';
    const taxRow =
        inv.taxAmount > 0.009
            ? `<tr class="sum-row"><td>Tax</td><td class="sum-amt">+ ${formatMoneyPdf(inv.taxAmount, c)}</td></tr>`
            : '';

    const paidRow =
        inv.totalPaid > 0.009
            ? `<tr class="sum-row sum-paid"><td>Amount Paid</td><td class="sum-amt">− ${formatMoneyPdf(inv.totalPaid, c)}</td></tr>`
            : '';

    const signatureBlock = ctx.signatureSrc
        ? `<img class="sig-img" src="${esc(ctx.signatureSrc)}" alt="" width="200" height="48" />`
        : `<div class="sig-img-spacer" aria-hidden="true"></div>`;

    const payLine = payUrl
        ? `<div class="pay-line">Pay securely online at <a href="${esc(payUrl)}">${esc(payUrl.replace(/^https?:\/\//, ''))}</a></div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(inv.invoiceNumber)}</title>
  <style>
    :root {
      --violet-light: #A855F7;
      --violet-deep: #4F46E5;
      --accent-mid: #7c3aed;
      --slate900: #0f172a;
      --slate700: #334155;
      --slate500: #64748b;
      --slate300: #cbd5e1;
      --slate100: #f1f5f9;
      --slate50: #f8fafc;
      --ok: #059669;
      --due: #b91c1c;
      --warn: #b45309;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13.5px;
      line-height: 1.62;
      color: var(--slate700);
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-variant-numeric: tabular-nums;
    }

    /* Faint centred brand mark — reads as stationery, repeats on every page. */
    .page-watermark {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 120mm;
      opacity: 0.045;
      z-index: 0;
      pointer-events: none;
    }
    .page-watermark img { width: 100%; height: auto; display: block; }

    .page-pad { position: relative; z-index: 1; padding: 0 3mm; }

    .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .logo-box { width: 152px; height: 52px; display: flex; align-items: center; justify-content: flex-start; flex-shrink: 0; }
    .logo-box img { display: block; width: 148px; height: 48px; object-fit: contain; object-position: left center; }
    .header-right { text-align: right; }
    .h-title {
      font-size: 30px; font-weight: 800; letter-spacing: 0.08em;
      background: linear-gradient(180deg, var(--violet-light), var(--violet-deep));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text; color: var(--violet-deep);
    }
    .title-accent { height: 3px; width: 54px; margin: 8px 0 10px auto; border-radius: 2px; background: linear-gradient(90deg, var(--violet-light), var(--violet-deep)); }
    .meta { font-size: 11.5px; color: var(--slate500); margin-bottom: 4px; line-height: 1.5; }
    .meta strong { color: var(--slate900); font-weight: 700; }

    .status-pill {
      display: inline-block; margin-top: 6px;
      font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
      padding: 5px 12px; border-radius: 999px;
    }
    .pill-paid { color: #065f46; background: #d1fae5; border: 1px solid #6ee7b7; }
    .pill-partial { color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; }
    .pill-unpaid { color: #991b1b; background: #fee2e2; border: 1px solid #fca5a5; }

    .divider { height: 1px; background: var(--slate100); margin: 18px 0 20px; }

    .billing { display: flex; justify-content: space-between; margin-bottom: 22px; }
    .bill-col { width: 48%; }
    .bill-col.r { text-align: right; }
    .lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent-mid); margin-bottom: 9px; }
    .bill-name { font-size: 13.5px; font-weight: 700; color: var(--slate900); margin-bottom: 5px; line-height: 1.35; }
    .bill-txt { font-size: 12px; color: var(--slate500); line-height: 1.58; margin-bottom: 4px; }

    .sec {
      font-size: 14.5px; font-weight: 800; color: var(--slate900);
      letter-spacing: 0.1em; text-transform: uppercase; margin: 24px 0 11px;
      page-break-after: avoid; break-after: avoid-page;
    }
    .card { border: 1px solid var(--slate100); border-radius: 10px; overflow: hidden; background: #fff; }

    table.li-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    table.li-table thead th {
      text-align: left; padding: 13px 17px;
      background: linear-gradient(90deg, var(--violet-light), var(--violet-deep));
      color: #fff; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border: none;
    }
    table.li-table thead th.th-amt { text-align: right; }
    table.li-table .li-row td { padding: 13px 17px; border-top: 1px solid var(--slate100); vertical-align: top; }
    .li-title { font-weight: 700; color: var(--slate900); }
    .li-sub { font-size: 11px; color: var(--slate500); margin-top: 2px; }
    .li-amt { text-align: right; white-space: nowrap; font-weight: 600; color: var(--slate900); }

    .totals { margin-top: 14px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
    table.sum-table { width: 62%; border-collapse: collapse; font-size: 12.5px; }
    table.sum-table td { padding: 8px 4px; }
    table.sum-table .sum-amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    table.sum-table .sum-row td { color: var(--slate500); border-top: 1px solid var(--slate100); }
    table.sum-table .sum-row.sum-paid td { color: var(--ok); font-weight: 700; }
    table.sum-table .row-grand td {
      font-weight: 800; font-size: 15px; color: var(--slate900);
      border-top: 1.5px solid var(--slate300); padding-top: 12px;
    }
    table.sum-table .row-due td {
      font-weight: 800; font-size: 17px;
      padding-top: 12px; border-top: 1.5px solid var(--slate300);
    }
    .row-due.due-open td { color: var(--due); }
    .row-due.due-clear td { color: var(--ok); }

    .pay-note {
      margin-top: 20px; padding: 13px 16px; border-radius: 9px;
      background: var(--slate50); border: 1px solid var(--slate100);
      font-size: 11.5px; color: var(--slate500); line-height: 1.6;
    }
    .pay-note .pay-line { margin-top: 4px; }
    .pay-note a { color: var(--violet-deep); text-decoration: none; font-weight: 700; }

    .pdf-tail { margin-top: 30px; }
    .sig-wrap { margin-top: 10px; page-break-inside: avoid; max-width: 320px; }
    .sig-img { display: block; width: 200px; height: 48px; object-fit: contain; object-position: left bottom; margin-bottom: 6px; }
    .sig-img-spacer { height: 40px; margin-bottom: 6px; }
    .sig-line { border-bottom: 1px solid var(--slate900); margin-bottom: 8px; width: 100%; max-width: 260px; }
    .sig-name { font-size: 13px; font-weight: 800; color: var(--slate900); line-height: 1.35; }
    .sig-role { font-size: 11.5px; color: var(--slate500); margin-top: 5px; }

    .doc-footer {
      margin-top: 30px; padding-top: 14px;
      border-top: 1px solid var(--slate300); text-align: center;
      page-break-inside: avoid;
    }
    .doc-footer-main { font-size: 10.5px; font-weight: 600; color: #334155; line-height: 1.5; }
    .doc-footer a { color: #4F46E5; text-decoration: none; }
  </style>
</head>
<body>
  <div class="page-watermark"><img src="${esc(ctx.logoSrc)}" alt="" /></div>

  <div class="page-pad">
    <div class="header-row">
      <div class="logo-box">
        <img src="${esc(ctx.logoSrc)}" alt="WebBriks" width="148" height="48" />
      </div>
      <div class="header-right">
        <div class="h-title">INVOICE</div>
        <div class="title-accent"></div>
        <div class="meta">Invoice&nbsp;#: <strong>${esc(inv.invoiceNumber)}</strong></div>
        <div class="meta">Issued: <strong>${esc(formatDatePdf(inv.issueDate))}</strong></div>
        <div class="meta">Quotation: <strong>${esc(inv.quotationNumber || '—')}</strong></div>
        <div class="status-pill ${stateMeta.className}">${esc(stateMeta.label)}</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="billing">
      <div class="bill-col">
        <div class="lbl">From</div>
        <div class="bill-name">${esc(DEFAULT_COMPANY.name)}</div>
        <div class="bill-txt">${esc(DEFAULT_COMPANY.address)}</div>
        <div class="bill-txt">${esc(DEFAULT_COMPANY.email)}</div>
        <div class="bill-txt">${esc(DEFAULT_COMPANY.phone)}</div>
      </div>
      <div class="bill-col r">
        <div class="lbl">Bill To</div>
        <div class="bill-name">${esc(inv.client.contactName)}</div>
        ${inv.client.companyName ? `<div class="bill-txt">${esc(inv.client.companyName)}</div>` : ''}
        ${inv.client.address ? `<div class="bill-txt">${esc(inv.client.address)}</div>` : ''}
        ${inv.client.email ? `<div class="bill-txt">${esc(inv.client.email)}</div>` : ''}
        ${inv.client.phone ? `<div class="bill-txt">${esc(inv.client.phone)}</div>` : ''}
      </div>
    </div>

    <div class="sec">${esc(inv.projectTitle || 'Project')}</div>

    <div class="card">
      <table class="li-table">
        <thead>
          <tr><th>Service</th><th class="th-amt">Amount</th></tr>
        </thead>
        <tbody>
          ${lineRows || `<tr class="li-row"><td>Project fee</td><td class="li-amt">${formatMoneyPdf(inv.subtotal, c)}</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="totals">
      <table class="sum-table">
        <tr class="sum-row"><td>Subtotal</td><td class="sum-amt">${formatMoneyPdf(inv.subtotal, c)}</td></tr>
        ${discountRow}
        ${taxRow}
        <tr class="row-grand"><td>Grand Total</td><td class="sum-amt">${formatMoneyPdf(inv.grandTotal, c)}</td></tr>
        ${paidRow}
        <tr class="row-due ${inv.balanceDue <= 0.009 ? 'due-clear' : 'due-open'}">
          <td>${inv.balanceDue <= 0.009 ? 'Balance' : 'Balance Due'}</td>
          <td class="sum-amt">${inv.balanceDue <= 0.009 ? 'PAID IN FULL' : formatMoneyPdf(inv.balanceDue, c)}</td>
        </tr>
      </table>
    </div>

    <div class="pay-note">
      This invoice covers the services listed above under quotation
      <strong>${esc(inv.quotationNumber || '—')}</strong>. Payments already recorded are
      reflected in the balance.${payLine}
    </div>

    <div class="pdf-tail">
      <div class="sig-wrap">
        ${signatureBlock}
        <div class="sig-line"></div>
        <div class="sig-name">${esc(SIGNATORY_NAME)}</div>
        <div class="sig-role">${esc(SIGNATORY_ROLE)}, ${esc(DEFAULT_COMPANY.name)}</div>
      </div>

      <footer class="doc-footer">
        <div class="doc-footer-main">
          &copy; ${new Date().getFullYear()} <a href="https://webbriks.com">WebBriks</a>. All rights reserved. &bull;
          <a href="mailto:info@webbriks.com">info@webbriks.com</a> &bull;
          <a href="https://webbriks.com">https://webbriks.com</a>
        </div>
      </footer>
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

    const html = buildInvoiceHtml(inv, { logoSrc, signatureSrc });

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage();
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

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '12mm', bottom: '14mm', left: '10mm', right: '10mm' },
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
