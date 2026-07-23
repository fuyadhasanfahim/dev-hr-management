import axios from 'axios';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import envConfig from '../config/env.config.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/** Tiny transparent PNG — last-resort if the remote logo fails to fetch. */
const FALLBACK_PIXEL_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15_000);
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

function esc(s: unknown): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

interface PricingRow {
    item: string;
    qty: number;
    unitPrice: number;
}

interface StructuredDoc {
    title: string;
    clientName: string;
    clientEmail: string;
    overview: string;
    sections: { heading: string; items: string[] }[];
    currency: string;
    pricing: PricingRow[];
    notes: string[];
}

const RESPONSE_SCHEMA_HINT = `Respond ONLY with valid minified JSON (no markdown, no code fences) matching exactly this shape:
{"title":"string","clientName":"string","clientEmail":"string","overview":"string","sections":[{"heading":"string","items":["string"]}],"currency":"string","pricing":[{"item":"string","qty":1,"unitPrice":0}],"notes":["string"]}`;

const SYSTEM_PROMPT = `You are a document formatter for a digital agency called WebBriks. You take raw, unformatted text pasted by a staff member and turn it into a clean, structured business proposal/quotation document.

Rules:
- "title": a short, professional document title inferred from the content.
- "clientName" / "clientEmail": only include if clearly present in the text; otherwise use empty strings.
- "overview": a short 2-4 sentence cover message/summary written in a professional tone, based on the pasted content.
- "sections": group the content logically. Each section has a "heading" and a list of concise bullet "items" (split long paragraphs into individual bullet points). Create as many sections as make sense (at least 1).
- "currency" and "pricing": ONLY populate if the pasted text actually mentions prices/costs/amounts. Never invent numbers. If no pricing is mentioned, use an empty "pricing" array and currency "".
- "notes": short optional closing remarks or terms if present in the text, else empty array.
- Do not fabricate client information, prices, or facts not present or reasonably inferable from the input text.

${RESPONSE_SCHEMA_HINT}`;

async function structureWithOpenAI(rawText: string): Promise<StructuredDoc> {
    const apiKey = envConfig.openai_api_key;
    if (!apiKey) {
        throw new AppError('OPENAI_API_KEY environment variable is not set', 500);
    }

    let content: string;
    try {
        const res = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                temperature: 0.3,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: rawText },
                ],
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 45_000,
            },
        );
        content = res.data?.choices?.[0]?.message?.content;
    } catch (e: unknown) {
        const err = e as {
            response?: { status?: number; data?: { error?: { code?: string; message?: string } } };
            message?: string;
        };
        logger.error({ err: err?.response?.data || err?.message }, 'test_pdf.openai_call_failed');

        const status = err?.response?.status;
        const code = err?.response?.data?.error?.code;
        if (status === 429 && code === 'insufficient_quota') {
            throw new AppError(
                'OpenAI account has no available quota. Add billing/credits at platform.openai.com, or use a different API key.',
                502,
            );
        }
        if (status === 401) {
            throw new AppError('OpenAI API key is invalid or revoked. Check OPENAI_API_KEY in server/.env.', 502);
        }
        if (status === 429) {
            throw new AppError('OpenAI rate limit hit. Wait a moment and try again.', 502);
        }
        throw new AppError(
            err?.response?.data?.error?.message || 'Failed to reach OpenAI to structure the content',
            502,
        );
    }

    if (!content) {
        throw new AppError('OpenAI returned an empty response', 502);
    }

    let parsed: Partial<StructuredDoc>;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new AppError('OpenAI returned invalid JSON', 502);
    }

    return {
        title: String(parsed.title || 'Untitled Document').trim(),
        clientName: String(parsed.clientName || '').trim(),
        clientEmail: String(parsed.clientEmail || '').trim(),
        overview: String(parsed.overview || '').trim(),
        sections: Array.isArray(parsed.sections)
            ? parsed.sections
                  .map((s) => ({
                      heading: String(s?.heading || '').trim(),
                      items: Array.isArray(s?.items)
                          ? s.items.map((i) => String(i || '').trim()).filter(Boolean)
                          : [],
                  }))
                  .filter((s) => s.heading || s.items.length > 0)
            : [],
        currency: String(parsed.currency || '').trim(),
        pricing: Array.isArray(parsed.pricing)
            ? parsed.pricing
                  .map((p) => ({
                      item: String(p?.item || '').trim(),
                      qty: Number(p?.qty) || 1,
                      unitPrice: Number(p?.unitPrice) || 0,
                  }))
                  .filter((p) => p.item)
            : [],
        notes: Array.isArray(parsed.notes)
            ? parsed.notes.map((n) => String(n || '').trim()).filter(Boolean)
            : [],
    };
}

function formatMoney(amount: number, currency: string): string {
    const cur = currency?.trim() || '$';
    if (/^[A-Za-z]{3}$/.test(cur)) {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: cur.toUpperCase(),
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(amount);
        } catch {
            /* fall through */
        }
    }
    return `${cur} ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function buildHtml(doc: StructuredDoc, logoSrc: string): string {
    const sectionsHtml = doc.sections
        .map(
            (s, idx) => `
        <div class="module-card">
          <div class="module-header">
            <span class="module-title">${idx + 1}. ${esc(s.heading || 'Section')}</span>
          </div>
          <div class="module-body">
            ${s.items
                .map(
                    (item, itemIdx) => `
              <div class="deliverable-item">
                <span class="deliv-num">${String(itemIdx + 1).padStart(2, '0')}</span>
                <span class="deliv-text">${esc(item)}</span>
              </div>`,
                )
                .join('')}
          </div>
        </div>`,
        )
        .join('');

    let pricingHtml = '';
    if (doc.pricing.length > 0) {
        const grandTotal = doc.pricing.reduce((sum, r) => sum + r.qty * r.unitPrice, 0);
        const rows = doc.pricing
            .map(
                (r) => `
        <tr>
          <td>${esc(r.item)}</td>
          <td class="num">${r.qty}</td>
          <td class="num">${formatMoney(r.unitPrice, doc.currency)}</td>
          <td class="num">${formatMoney(r.qty * r.unitPrice, doc.currency)}</td>
        </tr>`,
            )
            .join('');
        pricingHtml = `
        <div class="sec-heading"><span class="sec-dot"></span>Pricing</div>
        <table class="pricing-table" style="margin-bottom: 24px;">
          <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${rows}
            <tr class="total-row"><td colspan="3" style="text-align:right;">Grand Total</td><td class="num">${formatMoney(grandTotal, doc.currency)}</td></tr>
          </tbody>
        </table>`;
    }

    const notesHtml = doc.notes.length
        ? `<ul class="info-list">${doc.notes.map((n) => `<li class="info-item"><span class="icon-indigo">●</span><span class="info-text">${esc(n)}</span></li>`).join('')}</ul>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(doc.title)}</title>
<style>
  :root {
    --primary: #1E0078;
    --accent: #4E12D4;
    --pink: #C850FA;
    --slate900: #0f172a; --slate800: #1e293b; --slate700: #334155;
    --slate600: #475569; --slate500: #64748b; --slate400: #94a3b8;
    --slate300: #cbd5e1; --slate200: #e2e8f0; --slate100: #f1f5f9; --slate50: #f8fafc;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px; line-height: 1.5; color: var(--slate800); background: #fff;
    -webkit-font-smoothing: antialiased;
  }
  .container { width: 100%; padding: 4px; }
  .header-row {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 1px solid var(--slate200); padding-bottom: 24px; margin-bottom: 24px;
  }
  .logo-img { height: 48px; width: auto; max-width: 160px; object-fit: contain; object-position: left center; display: block; }
  .quote-badge {
    display: inline-block; padding: 4px 10px; border-radius: 6px;
    background-color: rgba(78, 18, 212, 0.08); color: var(--accent);
    border: 1px solid rgba(78, 18, 212, 0.2); font-size: 11px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;
  }
  .quote-meta { font-size: 11.5px; color: var(--slate500); text-align: right; }
  .proposal-card {
    background: linear-gradient(135deg, rgba(30, 0, 120, 0.04) 0%, rgba(200, 80, 250, 0.03) 100%);
    border: 1px solid rgba(78, 18, 212, 0.18); border-radius: 18px; padding: 24px; margin-bottom: 28px;
  }
  .label-muted { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--slate400); margin-bottom: 4px; }
  .proposal-title { font-size: 22px; font-weight: 800; color: var(--primary); line-height: 1.25; margin-bottom: 10px; }
  .client-name { font-size: 13.5px; font-weight: 700; color: var(--slate900); }
  .client-email { font-size: 11.5px; color: var(--slate500); }
  .cover-message p { font-size: 12.5px; color: var(--slate700); line-height: 1.85; margin-top: 10px; }
  .sec-heading {
    font-size: 13.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--primary); border-bottom: 1.5px solid var(--slate200); padding-bottom: 8px;
    margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
  }
  .sec-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, var(--accent) 0%, var(--pink) 100%); }
  .module-card { margin-bottom: 24px; page-break-inside: avoid; }
  .module-header {
    background: linear-gradient(90deg, rgba(78, 18, 212, 0.08) 0%, rgba(200, 80, 250, 0.04) 100%);
    border: 1px solid rgba(78, 18, 212, 0.22); border-radius: 12px; padding: 13px 20px; margin-bottom: 10px;
  }
  .module-title { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: var(--primary); }
  .module-body { display: flex; flex-direction: column; gap: 8px; }
  .deliverable-item {
    display: flex; align-items: flex-start; gap: 14px; padding: 13px 20px; background: #fff;
    border: 1px solid rgba(226, 232, 240, 0.85); border-radius: 12px; page-break-inside: avoid;
  }
  .deliv-num {
    width: 24px; height: 24px; border-radius: 7px; background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%);
    color: #fff; font-size: 11px; font-weight: 800; font-family: monospace, system-ui;
    display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .deliv-text { font-size: 12.5px; font-weight: 600; color: var(--slate800); line-height: 1.55; padding-top: 2px; }
  .pricing-table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
  .pricing-table th {
    text-align: left; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--slate500); padding: 7px 10px; border-bottom: 1.5px solid var(--slate200);
  }
  .pricing-table td { font-size: 11.5px; color: var(--slate700); padding: 8px 10px; border-bottom: 1px solid var(--slate100); vertical-align: top; }
  .pricing-table th.num, .pricing-table td.num { text-align: right; font-family: monospace, system-ui; }
  .pricing-table td.num { font-weight: 700; color: var(--slate800); }
  .pricing-table tr.total-row td { font-weight: 800; color: var(--primary); border-top: 1.5px solid var(--slate200); border-bottom: none; }
  .info-list { list-style: none; }
  .info-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; font-size: 11px; font-weight: 600; color: var(--slate700); line-height: 1.45; }
  .icon-indigo { color: var(--primary); font-weight: 800; flex-shrink: 0; margin-top: 1px; }
  .doc-footer {
    width: 100%; padding-top: 14px; margin-top: 24px; border-top: 1px solid var(--slate100);
    font-size: 10.5px; color: var(--slate500); font-weight: 600; text-align: center;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header-row">
      <img src="${esc(logoSrc)}" alt="WebBriks" class="logo-img" />
      <div class="quote-meta">
        <div class="quote-badge">AI-GENERATED DRAFT</div>
        <div>${esc(new Date().toISOString().slice(0, 10))}</div>
      </div>
    </div>

    <div class="proposal-card">
      <div class="label-muted">DOCUMENT TITLE</div>
      <h1 class="proposal-title">${esc(doc.title)}</h1>
      ${doc.clientName ? `<div class="client-name">Prepared for: ${esc(doc.clientName)}</div>` : ''}
      ${doc.clientEmail ? `<div class="client-email">${esc(doc.clientEmail)}</div>` : ''}
      ${doc.overview ? `<div class="cover-message"><p>${esc(doc.overview)}</p></div>` : ''}
    </div>

    ${sectionsHtml}
    ${pricingHtml}
    ${notesHtml ? `<div class="sec-heading"><span class="sec-dot"></span>Notes</div>${notesHtml}` : ''}

    <div class="doc-footer">Generated by WebBriks &middot; AI Test PDF Tool</div>
  </div>
</body>
</html>`;
}

export class TestAiPdfService {
    static async generatePdf(rawText: string): Promise<{ buffer: Buffer; filename: string }> {
        const text = String(rawText || '').trim();
        if (!text) throw new AppError('Text is required', 400);
        if (text.length > 20_000) throw new AppError('Text is too long (max 20,000 characters)', 400);

        const doc = await structureWithOpenAI(text);
        const logoSrc = LOCAL_LOGO_BASE64 || (await fetchImageAsDataUrl(DEFAULT_LOGO)) || FALLBACK_PIXEL_PNG;
        const html = buildHtml(doc, logoSrc);

        let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            });
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'load' });
            await page.emulateMediaType('print');
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '12mm', bottom: '14mm', left: '10mm', right: '10mm' },
            });
            const stem = doc.title.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'test-document';
            return { buffer: Buffer.from(pdf), filename: `${stem}.pdf` };
        } catch (e: unknown) {
            const err = e as { message?: string };
            logger.error({ err: e }, 'test_pdf.puppeteer_failed');
            throw new AppError(err?.message || 'Failed to generate PDF with Puppeteer', 500);
        } finally {
            await browser?.close().catch(() => {});
        }
    }
}
