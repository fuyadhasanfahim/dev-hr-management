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
import {
    buildEmbeddedFontCss,
    extractBrandMark,
} from './quotation-puppeteer-pdf.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Matches the Invoice / Quotation puppeteer PDF's money formatting exactly. */
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

const DEFAULT_SIGNATURE =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png';

const FALLBACK_PIXEL_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const DEFAULT_COMPANY = {
    name: 'WEB BRIKS LLC',
    country: 'United States',
    ein: 'Federal Tax ID (EIN): 30-1421814',
    vat: 'VAT ID: Not Applicable — U.S. Entity',
};

const SIGNATORY_NAME = process.env.COMPANY_SIGNATORY_NAME || 'Md. Ashaduzzaman';
const SIGNATORY_ROLE = process.env.COMPANY_SIGNATORY_ROLE || 'Founder & CEO';

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
    /** Cropped brand icon for the page watermark (shared with the invoice/quotation PDFs). */
    markSrc: string;
    /** Inlined @font-face block (Inter / Geist Mono), shared with the invoice/quotation PDFs. */
    fontCss: string;
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
    const paidInFull = ctx.remaining <= 0.009;

    const typeRow = `<tr><td>Payment Type</td><td class="amt">${esc(paymentTypeLabel)}</td></tr>`;
    const stageRow = r.milestoneLabel
        ? `<tr><td>Payment Stage</td><td class="amt">${esc(r.milestoneLabel)}</td></tr>`
        : '';
    const methodRow = r.method
        ? `<tr><td>Payment Method</td><td class="amt">${esc(r.method)}</td></tr>`
        : '';
    const noteRow = r.note
        ? `<tr><td>Note</td><td class="amt">${esc(r.note)}</td></tr>`
        : '';

    const voidBanner = isVoid
        ? `<div class="void-banner">This receipt has been voided${r.voidReason ? ` — ${esc(r.voidReason)}` : ''}. It is kept for record purposes only and does not count toward the paid balance.</div>`
        : '';

    const signatureBlock = ctx.signatureSrc
        ? `<img class="sig-img" src="${esc(ctx.signatureSrc)}" alt="" width="188" height="46" />`
        : `<div class="sig-img-spacer" aria-hidden="true"></div>`;

    const watermark = ctx.markSrc
        ? `<div class="page-watermark"><img src="${esc(ctx.markSrc)}" alt="" /></div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(r.receiptNumber)}</title>
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
      font-size: 9pt;
      line-height: 1.44;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      -webkit-font-smoothing: antialiased;
      font-variant-numeric: tabular-nums;
    }
    strong { font-weight: 600; color: var(--ink); }
    a { color: var(--brand); text-decoration: none; }

    /* Brand mark behind every page — same treatment as the invoice/quotation PDFs. */
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
    .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; }
    .brand-logo { height: 11mm; width: auto; object-fit: contain; object-position: left center; display: block; }
    .doc-id { text-align: right; }
    .doc-word {
      font-size: 17pt; font-weight: 800; letter-spacing: -0.02em;
      color: var(--ink); line-height: 1;
    }
    .doc-no {
      font-family: var(--font-mono); font-size: 8.5pt; font-weight: 500;
      letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted);
      margin-top: 5px;
    }
    .doc-meta {
      font-family: var(--font-mono); font-size: 8pt; color: var(--faint);
      line-height: 1.7; margin-top: 7px;
    }
    .doc-meta span { display: block; }
    .doc-meta b { color: var(--ink-2); font-weight: 500; }

    .status-tag {
      display: inline-block; margin-top: 9px;
      font-family: var(--font-mono); font-size: 7pt; font-weight: 600;
      letter-spacing: 0.14em; text-transform: uppercase;
      padding: 4px 9px; border-radius: 999px;
    }
    .status-tag.is-paid    { color: var(--ok);   background: var(--ok-bg); }
    .status-tag.is-unpaid  { color: var(--due);  background: var(--due-bg); }

    /* ── Hero: received by / received from ───────────────────────────────── */
    .hero { display: flex; gap: 8mm; margin-top: 5mm; align-items: stretch; }
    .hero-col {
      flex: 1;
      background: var(--panel); border: 1px solid var(--line);
      border-radius: 10px; padding: 4mm 4.5mm;
    }
    .eyebrow {
      font-family: var(--font-mono); font-size: 7.5pt; font-weight: 600;
      letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-mid);
      margin-bottom: 6px;
    }
    .party-name { font-size: 11.5pt; font-weight: 700; color: var(--ink); line-height: 1.3; }
    .party-line { font-size: 8.5pt; color: var(--muted); line-height: 1.5; margin-top: 1px; }

    .void-banner {
      margin-top: 4mm; border-radius: 10px; padding: 3mm 4.5mm;
      background: var(--due-bg); border: 1px solid rgba(180,35,24,0.22);
      font-size: 8pt; font-weight: 600; color: var(--due); line-height: 1.5;
      page-break-inside: avoid;
    }

    /* ── Payment summary ──────────────────────────────────────────────────── */
    .section-title {
      margin: 5mm 0 2.5mm;
      font-size: 8pt; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--ink);
      font-family: var(--font-mono);
    }
    .project-title {
      font-size: 12pt; font-weight: 700; color: var(--ink);
      letter-spacing: -0.01em; margin-bottom: 3.5mm;
    }

    table.pay-details { width: 100%; border-collapse: collapse; }
    table.pay-details td { padding: 6.5px 0; font-size: 9pt; border-bottom: 1px solid var(--line); vertical-align: baseline; }
    table.pay-details td:first-child { color: var(--muted); }
    table.pay-details tr:last-child td { border-bottom: none; }
    table.pay-details td.amt {
      text-align: right; white-space: nowrap;
      font-family: var(--font-mono); font-weight: 500; color: var(--ink);
    }

    /* ── Totals ───────────────────────────────────────────────────────────── */
    .totals-wrap { display: flex; justify-content: flex-end; margin-top: 3.5mm; }
    table.totals { width: 74mm; border-collapse: collapse; }
    table.totals td { padding: 4px 0; font-size: 9pt; }
    table.totals .sum-amt { text-align: right; white-space: nowrap; font-family: var(--font-mono); }
    table.totals .grand td {
      color: var(--ink); font-weight: 700; font-size: 10.5pt;
    }

    .balance-bar {
      margin-top: 4mm;
      border-radius: 14px; padding: 5mm 7mm;
      background: linear-gradient(135deg, #F7F3FF 0%, #ECE3FC 100%);
      display: flex; align-items: center; justify-content: space-between; gap: 6mm;
      page-break-inside: avoid;
    }
    .balance-info { display: flex; flex-direction: column; gap: 3px; }
    .balance-k {
      font-family: var(--font-mono); font-size: 7.5pt; font-weight: 700;
      letter-spacing: 0.16em; text-transform: uppercase; color: var(--brand-mid);
    }
    .balance-v { font-family: var(--font-mono); font-weight: 800; font-size: 16pt; color: #2E1065; }

    /* ── Closing ──────────────────────────────────────────────────────────── */
    .closing { margin-top: 5mm; page-break-inside: avoid; }
    .sign-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 5mm; }
    .sig-block { max-width: 70mm; }
    .sig-img { display: block; width: 176px; height: 42px; object-fit: contain; object-position: left bottom; margin-bottom: 4px; }
    .sig-img-spacer { height: 16px; margin-bottom: 4px; }
    .sig-line { border-bottom: 1px solid var(--ink); width: 58mm; margin-bottom: 5px; }
    .sig-name { font-size: 9pt; font-weight: 700; color: var(--ink); }
    .sig-role { font-size: 7.5pt; color: var(--muted); margin-top: 1px; }
  </style>
</head>
<body>
  ${watermark}
  <div class="sheet">

    <div class="masthead">
      <img class="brand-logo" src="${esc(ctx.logoSrc)}" alt="WebBriks" />
      <div class="doc-id">
        <div class="doc-word">Receipt</div>
        <div class="doc-no">${esc(r.receiptNumber)}</div>
        <div class="doc-meta">
          <span>Date <b>${esc(paymentDate)}</b></span>
          <span>Quotation <b>${esc(r.quotationNumber || '—')}</b></span>
        </div>
        <span class="status-tag ${isVoid ? 'is-unpaid' : 'is-paid'}">${isVoid ? 'Voided' : 'Payment Recorded'}</span>
      </div>
    </div>

    <div class="hero">
      <div class="hero-col">
        <div class="eyebrow">Received By</div>
        <div class="party-name">${esc(DEFAULT_COMPANY.name)}</div>
        <div class="party-line">${esc(DEFAULT_COMPANY.country)}</div>
        <div class="party-line">${esc(DEFAULT_COMPANY.ein)}</div>
        <div class="party-line">${esc(DEFAULT_COMPANY.vat)}</div>
      </div>

      <div class="hero-col">
        <div class="eyebrow">Received From</div>
        <div class="party-name">${esc(ctx.client.contactName)}</div>
        ${ctx.client.companyName ? `<div class="party-line">${esc(ctx.client.companyName)}</div>` : ''}
        ${ctx.client.address ? `<div class="party-line">${esc(ctx.client.address)}</div>` : ''}
        ${ctx.client.email ? `<div class="party-line">${esc(ctx.client.email)}</div>` : ''}
        ${ctx.client.phone ? `<div class="party-line">${esc(ctx.client.phone)}</div>` : ''}
      </div>
    </div>

    ${voidBanner}

    <div class="section-title">Payment Summary</div>
    <div class="project-title">Quotation ${esc(r.quotationNumber || '—')}</div>

    <table class="pay-details">
      <tr><td>Total Contract Value</td><td class="amt">${esc(formatMoneyPdf(grandTotal, currency))}</td></tr>
      <tr><td>Previously Paid</td><td class="amt">${esc(formatMoneyPdf(ctx.totalPaidBefore, currency))}</td></tr>
      ${typeRow}
      ${stageRow}
      ${methodRow}
      ${noteRow}
    </table>

    <div class="totals-wrap">
      <table class="totals">
        <tr class="grand"><td>${isVoid ? 'This Payment (Voided)' : 'This Payment'}</td><td class="sum-amt">${esc(formatMoneyPdf(r.amount, currency))}</td></tr>
      </table>
    </div>

    <div class="balance-bar">
      <div class="balance-info">
        <span class="balance-k">${paidInFull ? 'Paid in Full' : 'Remaining Balance'}</span>
        <span class="balance-v">${paidInFull ? esc(formatMoneyPdf(grandTotal, currency)) : esc(formatMoneyPdf(ctx.remaining, currency))}</span>
      </div>
    </div>

    <div class="closing">
      <div class="sign-row">
        <div class="sig-block">
          ${signatureBlock}
          <div class="sig-line"></div>
          <div class="sig-name">${esc(SIGNATORY_NAME)}</div>
          <div class="sig-role">${esc(SIGNATORY_ROLE)}, ${esc(DEFAULT_COMPANY.name)}</div>
        </div>
      </div>
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
        const logoSrc =
            LOCAL_LOGO_BASE64 || (await fetchImageAsDataUrl(DEFAULT_LOGO)) || FALLBACK_PIXEL_PNG;
        const signatureSrc = (await fetchImageAsDataUrl(signatureUrl)) || '';
        const fontCss = await buildEmbeddedFontCss().catch(() => '');

        let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            });

            // Same cropped brand icon the invoice/quotation PDFs use for their watermark.
            const markSrc = (await extractBrandMark(browser, logoSrc).catch(() => null)) || '';

            const html = buildPrintHtml(receiptForHtml, {
                logoSrc,
                signatureSrc,
                markSrc,
                fontCss,
                client: {
                    contactName: client?.name || receipt.clientName,
                    address: client?.address || client?.officeAddress,
                    email: client?.emails?.[0],
                    phone: client?.phone,
                },
                totalPaidBefore,
                remaining,
            });

            const page = await browser.newPage();

            // PDF page geometry, in CSS px (1mm = 96/25.4 px) — same as the invoice PDF,
            // so the two documents read as one consistent system.
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

            await page.emulateMediaType('print');

            // Anchor the signature block to the bottom of its page, just above the
            // running footer — same treatment as the invoice PDF.
            await page.evaluate((contentHRaw: number) => {
                const g = globalThis as any;
                const el = g.document.querySelector('.closing');
                if (!el) return;
                const contentH = contentHRaw * 0.985;
                const rect = el.getBoundingClientRect();
                const top = rect.top;
                const h = rect.height;
                const posInPage = ((top % contentH) + contentH) % contentH;
                const spaceLeft = contentH - posInPage;
                const CLEAR = 24;
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

            const footerTemplate = `
              <div style="width:100%;box-sizing:border-box;padding:8px 16mm 0;
                          border-top:1px solid #e2ddef;
                          font-family:-apple-system,'Segoe UI',Roboto,sans-serif;
                          font-size:7pt;color:#9a94ac;
                          display:flex;justify-content:space-between;align-items:center;">
                <span>&copy; ${new Date().getFullYear()} WebBriks &nbsp;&middot;&nbsp; This receipt was generated automatically by the WebBriks system.</span>
                <span>${esc(receipt.receiptNumber)} &nbsp;&middot;&nbsp; Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
              </div>`;

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: '<div></div>',
                footerTemplate,
                margin: { top: '14mm', bottom: '20mm', left: '16mm', right: '16mm' },
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
