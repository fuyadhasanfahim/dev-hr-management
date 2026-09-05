import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';
import { COMPANY_LOGO_URL, COMPANY_SOCIAL_LINKS } from '../constants/company.js';

/**
 * A deliberately simple, standalone "payment confirmation" receipt for
 * online (Stripe/PayPal) payments — logo, service info, payment id, date,
 * social links. Kept separate from receipt-puppeteer-pdf.service.ts (the
 * fuller staff-facing receipt used for manually-recorded payments and the
 * client-facing receipt email) rather than extending it, per instruction.
 */

function esc(s: unknown): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Matches the other PDFs' money formatting (Tk prefix for BDT, else Intl currency). */
export function formatMoneyPdf(amount: number, currency: string): string {
    const n = Number(amount || 0);
    const BDT_TOKENS = new Set(['BDT', 'BDT.', '৳', 'Tk', 'TK', 'tk']);
    if (BDT_TOKENS.has(currency)) {
        return `Tk ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (/^[A-Za-z]{3}$/.test(currency)) {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency.toUpperCase(),
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(n);
        } catch {
            /* fall through */
        }
    }
    return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface OnlinePaymentReceiptData {
    clientName: string;
    projectTitle: string;
    quotationNumber?: string;
    amount: number;
    currency: string;
    /** Gateway transaction reference — Stripe PaymentIntent id / PayPal capture id. */
    paymentId: string;
    via: 'stripe' | 'paypal';
    paymentDate: Date;
}

function buildHtml(data: OnlinePaymentReceiptData): string {
    const viaLabel = data.via === 'stripe' ? 'Card (Stripe)' : 'PayPal';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Payment Receipt ${esc(data.paymentId)}</title>
  <style>
    :root {
      --brand: #4E12D4;
      --ink: #14101f;
      --muted: #6b6580;
      --line: #ece9f2;
      --ok: #0f8a5f;
      --ok-bg: #e8f6ef;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--ink);
      font-size: 10pt;
      padding: 20mm;
    }
    .logo { height: 12mm; width: auto; display: block; margin-bottom: 10mm; }
    .badge {
      display: inline-block; padding: 4px 12px; border-radius: 999px;
      background: var(--ok-bg); color: var(--ok); font-weight: 700;
      font-size: 8pt; letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: 6mm;
    }
    h1 { font-size: 18pt; margin-bottom: 2mm; }
    .sub { color: var(--muted); margin-bottom: 10mm; }
    table.receipt { width: 100%; border-collapse: collapse; margin-bottom: 10mm; }
    table.receipt td { padding: 4mm 0; border-bottom: 1px solid var(--line); vertical-align: top; }
    table.receipt td:first-child { color: var(--muted); width: 40%; }
    table.receipt td:last-child { text-align: right; font-weight: 600; }
    .amount-row td { font-size: 14pt; font-weight: 800; color: var(--brand); }
    .footer { margin-top: 14mm; padding-top: 6mm; border-top: 1px solid var(--line); color: var(--muted); font-size: 8.5pt; }
    .footer a { color: var(--brand); text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <img class="logo" src="${esc(COMPANY_LOGO_URL)}" alt="Web Briks" />
  <div class="badge">Payment Confirmed</div>
  <h1>Thank you, ${esc(data.clientName)}</h1>
  <div class="sub">This confirms your payment for ${esc(data.projectTitle)}.</div>

  <table class="receipt">
    <tr><td>Client</td><td>${esc(data.clientName)}</td></tr>
    <tr><td>${data.quotationNumber ? 'Quotation' : 'Project'}</td><td>${esc(data.quotationNumber || data.projectTitle)}</td></tr>
    <tr><td>Payment ID</td><td>${esc(data.paymentId)}</td></tr>
    <tr><td>Payment Method</td><td>${esc(viaLabel)}</td></tr>
    <tr><td>Date</td><td>${esc(format(data.paymentDate, 'PPP'))}</td></tr>
    <tr class="amount-row"><td>Amount Paid</td><td>${esc(formatMoneyPdf(data.amount, data.currency))}</td></tr>
  </table>

  <div class="footer">
    &copy; ${new Date().getFullYear()} Web Briks LLC &nbsp;&middot;&nbsp;
    <a href="${esc(COMPANY_SOCIAL_LINKS.facebook)}">Facebook</a> &nbsp;&middot;&nbsp;
    <a href="${esc(COMPANY_SOCIAL_LINKS.linkedin)}">LinkedIn</a> &nbsp;&middot;&nbsp;
    <a href="${esc(COMPANY_SOCIAL_LINKS.instagram)}">Instagram</a>
  </div>
</body>
</html>`;
}

export class OnlinePaymentReceiptPdfService {
    static async generate(data: OnlinePaymentReceiptData): Promise<{ buffer: Buffer; filename: string }> {
        let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            });
            const page = await browser.newPage();
            await page.setContent(buildHtml(data), { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0', bottom: '0', left: '0', right: '0' },
            });
            const filename = `Receipt-${data.paymentId}.pdf`.replace(/[/\\?%*:|"<>]/g, '-');
            return { buffer: Buffer.from(pdf), filename };
        } catch (e: unknown) {
            const err = e as { message?: string };
            logger.error({ err: e, paymentId: data.paymentId }, 'online_payment_receipt.pdf_failed');
            throw new AppError(err?.message || 'Failed to generate payment receipt PDF', 500);
        } finally {
            await browser?.close().catch(() => {});
        }
    }
}

export default OnlinePaymentReceiptPdfService;
