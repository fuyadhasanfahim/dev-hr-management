import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ReceiptModel from '../models/receipt.model.js';
import ReceiptPaymentModel from '../models/receipt-payment.model.js';
import ClientModel from '../models/client.model.js';
import QuotationModel from '../models/quotation.model.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Matches the Quotation puppeteer PDF's money formatting exactly. */
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
    logger.error('Failed to load local logo.png', e);
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

const PAYMENT_TYPE_LABELS: Record<string, string> = {
    full: 'Full Payment',
    partial: 'Partial Payment',
    milestone: 'Milestone Payment',
};

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

interface ReceiptPdfContext {
    logoSrc: string;
    signatureSrc: string;
    client: {
        contactName: string;
        companyName?: string;
        address?: string;
        email?: string;
        phone?: string;
    };
    totalPaidBefore: number;
    remaining: number;
}

function buildPrintHtml(r: Record<string, any>, ctx: ReceiptPdfContext): string {
    const currency = r.currency || 'BDT';
    const isVoid = r.status === 'void';

    const grandTotal = ctx.totalPaidBefore + (isVoid ? 0 : r.amount) + ctx.remaining;
    const paymentDate = formatDatePdf(r.paymentDate);
    const paymentTypeLabel = PAYMENT_TYPE_LABELS[r.paymentType] || 'Payment';

    const typeRow = `<tr class="pr-tr"><td>Payment Type</td><td class="pr-num">${esc(paymentTypeLabel)}</td></tr>`;
    const stageRow = r.milestoneLabel
        ? `<tr class="pr-tr"><td>Payment Stage</td><td class="pr-num">${esc(r.milestoneLabel)}</td></tr>`
        : '';
    const methodRow = r.method
        ? `<tr class="pr-tr"><td>Payment Method</td><td class="pr-num">${esc(r.method)}</td></tr>`
        : '';
    const noteRow = r.note
        ? `<tr class="pr-tr"><td>Note</td><td class="pr-num">${esc(r.note)}</td></tr>`
        : '';

    const remainingRowLabel = ctx.remaining <= 0.009 ? 'Status' : 'Remaining Balance';
    const remainingRowValue =
        ctx.remaining <= 0.009 ? 'PAID IN FULL' : formatMoneyPdf(ctx.remaining, currency);

    const voidBanner = isVoid
        ? `<div class="void-banner">This receipt has been voided${r.voidReason ? ` — ${esc(r.voidReason)}` : ''}. It is kept for record purposes only and does not count toward the paid balance.</div>`
        : '';

    const signatureBlock = ctx.signatureSrc
        ? `<img class="sig-img" src="${esc(ctx.signatureSrc)}" alt="" width="200" height="48" />`
        : `<div class="sig-img-spacer" aria-hidden="true"></div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(r.receiptNumber)}</title>
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
    }
    * { box-sizing: border-box; margin: 0; }
    html, body { height: 100%; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13.5px;
      line-height: 1.62;
      color: var(--slate700);
      background: #fff;
    }
    .page-pad {
      padding: 0 3mm;
    }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .logo-box { width: 152px; height: 52px; display: flex; align-items: center; justify-content: flex-start; flex-shrink: 0; }
    .logo-box img { display: block; width: 148px; height: 48px; object-fit: contain; object-position: left center; }
    .header-right { text-align: right; }
    .h-title {
      font-size: 28px; font-weight: 800; letter-spacing: 0.08em;
      background: linear-gradient(180deg, var(--violet-light), var(--violet-deep));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text; color: var(--violet-deep);
    }
    .title-accent { height: 3px; width: 50px; margin: 8px 0 10px auto; border-radius: 2px; background: linear-gradient(90deg, var(--violet-light), var(--violet-deep)); }
    .meta { font-size: 11.5px; color: var(--slate500); margin-bottom: 4px; line-height: 1.5; }
    .meta strong { color: var(--slate900); font-weight: 700; }
    .divider { height: 1px; background: var(--slate100); margin: 18px 0 20px; }
    .billing { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .bill-col { width: 48%; }
    .bill-col.r { text-align: right; }
    .lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent-mid); margin-bottom: 9px; }
    .bill-name { font-size: 13.5px; font-weight: 700; color: var(--slate900); margin-bottom: 5px; line-height: 1.35; }
    .bill-txt { font-size: 12px; color: var(--slate500); line-height: 1.58; margin-bottom: 4px; }
    .sec {
      font-size: 14.5px; font-weight: 800; color: var(--slate900);
      letter-spacing: 0.1em; text-transform: uppercase; margin-top: 24px; margin-bottom: 11px;
      page-break-after: avoid; break-after: avoid-page;
    }
    .card { border: 1px solid var(--slate100); border-radius: 8px; padding: 14px 16px; background: #fff; margin-bottom: 8px; }
    table.price-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.price-table thead th.pricing-h {
      text-align: left; padding: 13px 17px;
      background: linear-gradient(90deg, var(--violet-light), var(--violet-deep));
      color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 0.07em; line-height: 1.35; border: none;
    }
    table.price-table .pr-tr td { padding: 11px 16px; border-top: 1px solid var(--slate100); vertical-align: baseline; line-height: 1.45; }
    table.price-table .pr-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    table.price-table .pr-tr.pr-this-payment td {
      font-weight: 800; color: #059669; background: rgba(5, 150, 105, 0.06);
    }
    table.price-table .pr-tr.pr-total td {
      font-weight: 800; font-size: 16px; color: var(--slate900);
      background: rgba(248, 250, 252, 0.95); padding-top: 14px; padding-bottom: 14px;
    }
    .void-banner {
      margin: 8px 0 18px; padding: 12px 16px; border-radius: 8px; font-size: 12px; font-weight: 700;
      color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca;
    }
    .pdf-tail { margin-top: 28px; padding-top: 28px; }
    .sig-wrap { margin-top: 28px; page-break-inside: avoid; max-width: 320px; }
    .sig-img { display: block; width: 200px; height: 48px; object-fit: contain; object-position: left bottom; margin-bottom: 6px; }
    .sig-img-spacer { height: 40px; margin-bottom: 6px; }
    .sig-line { border-bottom: 1px solid var(--slate900); margin-bottom: 8px; width: 100%; max-width: 260px; }
    .sig-name { font-size: 13px; font-weight: 800; color: var(--slate900); line-height: 1.35; }
    .sig-role { font-size: 11.5px; color: var(--slate500); margin-top: 5px; line-height: 1.5; }
    .doc-footer {
      margin-top: 32px; padding-top: 14px;
      border-top: 1px solid var(--slate300); text-align: center;
      page-break-inside: avoid;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .doc-footer-main { font-size: 10.5px; font-weight: 600; color: #334155; line-height: 1.5; }
    .doc-footer a { color: #4F46E5; text-decoration: none; }
  </style>
</head>
<body>
<div class="page-pad">

  <div class="header-row">
    <div class="logo-box">
      <img src="${esc(ctx.logoSrc)}" alt="WebBriks" width="148" height="48" />
    </div>
    <div class="header-right">
      <div class="h-title">RECEIPT</div>
      <div class="title-accent"></div>
      <div class="meta">Ref: <strong>${esc(r.receiptNumber)}</strong></div>
      <div class="meta">Date: <strong>${esc(paymentDate)}</strong></div>
      <div class="meta">Quotation: <strong>${esc(r.quotationNumber || '—')}</strong></div>
    </div>
  </div>

  <div class="divider"></div>

  ${voidBanner}

  <div class="billing">
    <div class="bill-col">
      <div class="lbl">Received By</div>
      <div class="bill-name">${esc(DEFAULT_COMPANY.name)}</div>
      <div class="bill-txt">${esc(DEFAULT_COMPANY.address)}</div>
      <div class="bill-txt">${esc(DEFAULT_COMPANY.email)}</div>
      <div class="bill-txt">${esc(DEFAULT_COMPANY.phone)}</div>
    </div>
    <div class="bill-col r">
      <div class="lbl">Received From</div>
      <div class="bill-name">${esc(ctx.client.contactName)}</div>
      ${ctx.client.companyName ? `<div class="bill-txt">${esc(ctx.client.companyName)}</div>` : ''}
      ${ctx.client.address ? `<div class="bill-txt">${esc(ctx.client.address)}</div>` : ''}
      ${ctx.client.email ? `<div class="bill-txt">${esc(ctx.client.email)}</div>` : ''}
      ${ctx.client.phone ? `<div class="bill-txt">${esc(ctx.client.phone)}</div>` : ''}
    </div>
  </div>

  <div class="sec">Payment Summary</div>
  <div class="card" style="padding:0;">
    <table class="price-table">
      <thead>
        <tr><th colspan="2" class="pricing-h pricing-th">Payment Details</th></tr>
      </thead>
      <tbody>
        <tr class="pr-tr"><td>Total Contract Value</td><td class="pr-num">${formatMoneyPdf(grandTotal, currency)}</td></tr>
        <tr class="pr-tr"><td>Previously Paid</td><td class="pr-num">${formatMoneyPdf(ctx.totalPaidBefore, currency)}</td></tr>
        ${typeRow}
        ${stageRow}
        ${methodRow}
        ${noteRow}
        <tr class="pr-tr pr-this-payment"><td>${isVoid ? 'This Payment (Voided)' : 'This Payment'}</td><td class="pr-num">${formatMoneyPdf(r.amount, currency)}</td></tr>
        <tr class="pr-tr pr-total"><td>${remainingRowLabel}</td><td class="pr-num">${remainingRowValue}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="pdf-tail">
  <div class="sig-wrap">
    ${signatureBlock}
    <div class="sig-line"></div>
    <div class="sig-name">Md. Ashaduzzaman</div>
    <div class="sig-role">Founder &amp; CEO, ${esc(DEFAULT_COMPANY.name)}</div>
  </div>

  <footer class="doc-footer">
    <div class="doc-footer-main">
      &copy; ${new Date().getFullYear()} <a href="https://webbriks.com">WebBriks</a>. All rights reserved. &bull; <a href="mailto:info@webbriks.com">info@webbriks.com</a> &bull; <a href="https://webbriks.com">https://webbriks.com</a>
    </div>
  </footer>
  </div>

</div>
</body>
</html>`;
}

export class ReceiptPuppeteerPdfService {
    /**
     * Generates the PDF for a single payment transaction on this Receipt ledger.
     * Defaults to the most recently recorded payment when `paymentId` is omitted
     * (e.g. right after a new payment is added).
     */
    static async generatePdf(
        receiptId: string,
        paymentId?: string,
    ): Promise<{ buffer: Buffer; filename: string }> {
        const receipt = await ReceiptModel.findById(receiptId).lean();
        if (!receipt) throw new AppError('Receipt not found', 404);

        const client = await ClientModel.findById(receipt.clientId).lean();
        const quotation = await QuotationModel.findById(receipt.quotationId).lean();
        const grandTotal = quotation?.totals?.grandTotal || 0;

        // The ledger can hold many payments — resolve the one this PDF represents.
        const payments = await ReceiptPaymentModel.find({
            receiptId: receipt._id,
            status: 'recorded',
        })
            // Same-day payments share an identical paymentDate — tie-break on
            // createdAt (true insertion order) so "most recent" is deterministic.
            .sort({ paymentDate: 1, createdAt: 1 })
            .lean();

        const paymentIndex = paymentId
            ? payments.findIndex((p) => p._id.toString() === paymentId)
            : payments.length - 1;

        if (paymentIndex === -1) throw new AppError('Payment not found on this receipt', 404);
        const payment = payments[paymentIndex];
        if (!payment) throw new AppError('No payments have been recorded on this receipt yet', 404);

        const totalPaidBefore = payments
            .slice(0, paymentIndex)
            .reduce((sum, p) => sum + p.amount, 0);
        const paidThroughThisPayment = totalPaidBefore + payment.amount;
        const remaining = Math.max(0, grandTotal - paidThroughThisPayment);

        // `payments` only includes status: 'recorded' entries, so this PDF always
        // represents a live payment — void status here reflects the whole receipt.
        const receiptForHtml = {
            receiptNumber: receipt.receiptNumber,
            quotationNumber: receipt.quotationNumber,
            currency: receipt.currency,
            status: receipt.status,
            voidReason: receipt.voidReason,
            amount: payment.amount,
            paymentType: payment.paymentType,
            milestoneLabel: payment.milestoneLabel,
            method: payment.method,
            note: payment.note,
            paymentDate: payment.paymentDate,
        };

        const signatureUrl = process.env.COMPANY_SIGNATURE_URL || DEFAULT_SIGNATURE;
        let logoSrc =
            LOCAL_LOGO_BASE64 || (await fetchImageAsDataUrl(DEFAULT_LOGO)) || FALLBACK_PIXEL_PNG;
        const signatureSrc = (await fetchImageAsDataUrl(signatureUrl)) || '';

        const html = buildPrintHtml(receiptForHtml, {
            logoSrc,
            signatureSrc,
            client: {
                contactName: client?.name || receipt.clientName,
                address: client?.address || client?.officeAddress,
                email: client?.emails?.[0],
                phone: client?.phone,
            },
            totalPaidBefore,
            remaining,
        });

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
                    addEventListener: (type: string, fn: () => void, opts?: { once?: boolean }) => void;
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

            const rn = String(receipt.receiptNumber || '').trim();
            const stem = rn ? (rn.startsWith('#') ? rn : `#${rn}`) : 'receipt';
            // Disambiguate the filename when a ledger holds more than one payment.
            const suffix = payments.length > 1 ? `-P${paymentIndex + 1}` : '';
            const filename = `${stem}${suffix}.pdf`.replace(/[/\\?%*:|"<>]/g, '-');
            return { buffer: Buffer.from(pdf), filename };
        } catch (e: unknown) {
            const err = e as { message?: string };
            logger.error({ err: e, receiptId }, 'receipt.puppeteer_pdf_failed');
            throw new AppError(err?.message || 'Failed to generate PDF with Puppeteer', 500);
        } finally {
            await browser?.close().catch(() => {});
        }
    }
}
