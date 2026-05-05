import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import envConfig from '../config/env.config.js';
import QuotationModel from '../models/quotation.model.js';
import { QuotationService } from './quotation.service.js';
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
        .replace(/"/g, '&quot;');
}

function compactList(parts: Array<string | undefined | null>): string[] {
    return parts.map((x) => String(x ?? '').trim()).filter(Boolean);
}

function buildPaymentLink(
    secureToken: unknown,
    paymentBase: string,
): string | null {
    if (!secureToken || typeof secureToken !== 'string') return null;
    return `${paymentBase.replace(/\/$/, '')}/quotation/${secureToken}`;
}

type LineItem = { name: string; qty: number; rate: number; total: number };

type Milestone = { label: string; percentage: number; note?: string };

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
        paymentClientBase: string;
        paymentPageUrl: string;
        logoSrc: string;
        signatureSrc: string;
    },
): string {
    const company = q.company || {};
    const client = q.client || {};
    const details = q.details || {};
    const totals = q.totals || {};
    const pricing = q.pricing || {};
    const techStack = q.techStack || {};
    const phases = Array.isArray(q.phases) ? q.phases : [];
    const additionalServices = Array.isArray(q.additionalServices)
        ? q.additionalServices
        : [];
    const workflow = Array.isArray(q.workflow) ? q.workflow : [];

    const currency = q.currency || 'BDT';
    const payLink =
        (ctx.paymentPageUrl && String(ctx.paymentPageUrl).trim()) ||
        buildPaymentLink(q.secureToken, ctx.paymentClientBase) ||
        '';

    const issueDate = details?.date
        ? format(new Date(details.date), 'PPP')
        : format(new Date(), 'PPP');
    const validUntilStr = details?.validUntil
        ? format(new Date(details.validUntil), 'PPP')
        : '—';

    const baseTitle =
        q.serviceType === 'web-development'
            ? 'Web Design & Development'
            : 'Service';

    const phaseRows: LineItem[] = phases.map((p: any, idx: number) => ({
        name: `Phase ${idx + 1}: ${p.title}${p.items?.length ? ` (${p.items.length} deliverables)` : ''}`,
        qty: 1,
        rate: 0,
        total: 0,
    }));

    const addOnRows: LineItem[] = additionalServices.map((s: any) => ({
        name: `${s.title} (${s.billingCycle})`,
        qty: 1,
        rate: s.price ?? 0,
        total: s.price ?? 0,
    }));

    const items: LineItem[] = [
        {
            name: details?.title
                ? `${baseTitle} — ${details.title}`
                : baseTitle,
            qty: 1,
            rate: pricing?.basePrice ?? 0,
            total: pricing?.basePrice ?? 0,
        },
        ...phaseRows,
        ...addOnRows,
    ];

    const techTags = compactList([
        techStack?.frontend,
        techStack?.backend,
        techStack?.database,
        ...(Array.isArray(techStack?.tools) ? techStack.tools : []),
    ]);

    const workflowSteps = workflow
        .map((s: string) => String(s || '').trim())
        .filter(Boolean);

    const pricingSubtotal = totals?.subtotal ?? 0;
    const pricingTax = totals?.taxAmount ?? 0;
    const pricingTotal = totals?.grandTotal ?? 0;
    const discountAmount =
        pricing?.discount && pricingSubtotal
            ? (pricingSubtotal * pricing.discount) / 100
            : 0;

    let milestones: Milestone[] = Array.isArray(q.paymentMilestones)
        ? q.paymentMilestones.map((m: any) => ({
              label: String(m.label || ''),
              percentage: Number(m.percentage) || 0,
              note: m.note,
          }))
        : [];

    if (!milestones.length) {
        milestones = [
            { label: 'Upfront on acceptance', percentage: 50 },
            { label: 'After delivery handover', percentage: 30 },
            { label: 'Final approval / clearance', percentage: 20 },
        ];
    }

    const firstMilestone = milestones[0];

    const serviceBadge =
        q.serviceType === 'web-development' ? 'WEB' : 'SERVICE';
    const statusUpper = q.status
        ? String(q.status).replace(/_/g, ' ').toUpperCase()
        : '';

    const rowsHtml = items
        .map(
            (item, index) => `
        <tr class="${index % 2 ? 'tr-even' : ''}">
          <td class="td-no">${index + 1}</td>
          <td class="td-name">${esc(item.name)}</td>
          <td class="td-num">${item.qty}</td>
          <td class="td-num">${item.rate > 0 ? formatMoneyPdf(item.rate, currency) : '—'}</td>
          <td class="td-num">${item.total > 0 ? formatMoneyPdf(item.total, currency) : '—'}</td>
        </tr>`,
        )
        .join('');

    const phasesHtml = phases.length
        ? phases
              .map((p: any, idx: number) => {
                  const descRow = p.description
                      ? `<tr><td class="phase-td phase-desc">${esc(p.description)}</td></tr>`
                      : '';
                  const itemRows = (p.items || []).length
                      ? (p.items as string[])
                            .map(
                                (item: string) =>
                                    `<tr><td class="phase-td phase-item"><span class="dot">•</span> ${esc(item)}</td></tr>`,
                            )
                            .join('')
                      : '';
                  const emptyRow =
                      !p.description && !(p.items || []).length
                          ? `<tr><td class="phase-td phase-empty">No deliverables listed</td></tr>`
                          : '';
                  const body = `${descRow}${itemRows}${emptyRow}`;
                  return `
    <table class="phase-table">
      <thead>
        <tr>
          <th class="phase-th">
            <div class="phase-th-inner">
              <strong>Phase ${idx + 1}: ${esc(p.title)}</strong>
              <span class="scope-count">${(p.items || []).length} deliverables</span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
              })
              .join('')
        : '';

    const techHtml = techTags.length
        ? `<div class="tags">${techTags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>`
        : '';

    const workflowHtml = workflowSteps.length
        ? `<div class="workflow">${workflowSteps
              .map(
                  (step, i) => `
            <div class="wf-step">
              <span class="wf-num">${i + 1}</span>
              <span class="wf-txt">${esc(step)}</span>
            </div>
            ${i < workflowSteps.length - 1 ? '<span class="wf-arrow">→</span>' : ''}`,
              )
              .join('')}</div>`
        : '';

    const milestonesHtml = milestones
        .map((m) => {
            const amount = (pricingTotal * (m.percentage || 0)) / 100;
            return `
        <tr class="pay-row">
          <td class="pay-badge-cell"><span class="ms-badge">${m.percentage}%</span></td>
          <td class="pay-label">${esc(m.label)}</td>
          <td class="pay-amt">${formatMoneyPdf(amount, currency)}</td>
        </tr>`;
        })
        .join('');

    const taxRow =
        pricing?.taxRate != null && Number(pricing.taxRate) > 0
            ? `<tr class="pr-tr"><td>Tax (${esc(pricing.taxRate)}%)</td><td class="pr-num">${formatMoneyPdf(pricingTax, currency)}</td></tr>`
            : '';

    const discountRow = pricing?.discount
        ? `<tr class="pr-tr"><td>Discount (${esc(pricing.discount)}%)</td><td class="discount pr-num">−${formatMoneyPdf(discountAmount, currency)}</td></tr>`
        : `<tr class="pr-tr"><td>Discount</td><td class="pr-num">${formatMoneyPdf(0, currency)}</td></tr>`;

    const pricingTbodyRows = `
      <tr class="pr-tr"><td>Subtotal</td><td class="pr-num">${formatMoneyPdf(pricingSubtotal, currency)}</td></tr>
      ${taxRow}
      ${discountRow}
      <tr class="pr-tr pr-total"><td>Grand Total</td><td class="pr-num">${formatMoneyPdf(pricingTotal, currency)}</td></tr>`;

    const ctaMilestoneText = firstMilestone
        ? `On acceptance: ${firstMilestone.percentage}% (${formatMoneyPdf(
              (pricingTotal * firstMilestone.percentage) / 100,
              currency,
          )}) — ${esc(firstMilestone.label)}.`
        : '';

    const payButtons = payLink
        ? `<a class="btn btn-primary" href="${esc(payLink)}">View full quotation</a>`
        : '';

    const signatureBlock = ctx.signatureSrc
        ? `<img class="sig-img" src="${esc(ctx.signatureSrc)}" alt="" width="200" height="48" />`
        : `<div class="sig-img-spacer" aria-hidden="true"></div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(details.title)}</title>
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
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13.5px;
      line-height: 1.62;
      color: var(--slate700);
      background: #fff;
    }
    .page-pad { padding: 0 3mm 4mm 3mm; }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .logo-box {
      width: 152px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex-shrink: 0;
    }
    .logo-box img {
      display: block;
      width: 148px;
      height: 48px;
      object-fit: contain;
      object-position: left center;
    }
    .header-right { text-align: right; }
    .h-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: linear-gradient(180deg, var(--violet-light), var(--violet-deep));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      color: var(--violet-deep);
    }
    .title-accent {
      height: 3px;
      width: 50px;
      margin: 8px 0 10px auto;
      border-radius: 2px;
      background: linear-gradient(90deg, var(--violet-light), var(--violet-deep));
    }
    .meta { font-size: 11.5px; color: var(--slate500); margin-bottom: 4px; line-height: 1.5; }
    .meta strong { color: var(--slate900); font-weight: 700; }
    .divider { height: 1px; background: var(--slate100); margin: 18px 0 20px; }
    .billing { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .bill-col { width: 48%; }
    .bill-col.r { text-align: right; }
    .lbl {
      font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em;
      color: var(--accent-mid); margin-bottom: 9px;
    }
    .bill-name { font-size: 13.5px; font-weight: 700; color: var(--slate900); margin-bottom: 5px; line-height: 1.35; }
    .bill-txt { font-size: 12px; color: var(--slate500); line-height: 1.58; margin-bottom: 4px; }
    .sec {
      font-size: 14.5px; font-weight: 800; color: var(--slate900);
      letter-spacing: 0.1em; text-transform: uppercase; margin-top: 24px; margin-bottom: 11px;
      page-break-after: avoid;
      break-after: avoid-page;
    }
    .card {
      border: 1px solid var(--slate100); border-radius: 8px; padding: 14px 16px;
      background: #fff; margin-bottom: 8px;
    }
    .card-soft { background: var(--slate50); }
    .proj-title { font-size: 17px; font-weight: 800; color: var(--slate900); margin-bottom: 9px; line-height: 1.3; }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .badge {
      border: 1px solid var(--slate100); border-radius: 4px; padding: 3px 8px;
      background: var(--slate50); font-size: 9.5px; font-weight: 700;
      color: var(--slate500); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .scope-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 4px;
    }
    table.phase-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      border: 1px solid var(--slate100);
      border-radius: 8px;
      overflow: hidden;
    }
    table.phase-table thead { background: var(--slate50); }
    .phase-th {
      text-align: left;
      font-weight: 400;
      padding: 0;
      border-bottom: 1px solid var(--slate100);
    }
    .phase-th-inner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      font-size: 13.5px;
      line-height: 1.3;
    }
    .phase-th-inner strong { color: var(--slate900); font-weight: 700; }
    .phase-th-inner .scope-count {
      font-size: 11.5px;
      color: var(--slate500);
      flex-shrink: 0;
      font-weight: 400;
    }
    .phase-td {
      padding: 11px 16px;
      border-top: 1px solid var(--slate100);
      vertical-align: top;
      line-height: 1.52;
      word-wrap: break-word;
    }
    .phase-desc { color: var(--slate500); font-size: 12px; }
    .phase-item { color: var(--slate700); }
    .phase-empty { color: var(--slate500); font-size: 11.5px; }
    .dot { color: var(--accent-mid); font-weight: 700; margin-right: 6px; }
    table.svc { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 0; table-layout: fixed; }
    table.svc th {
      text-align: left; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--slate500); background: var(--slate50); border-bottom: 1px solid var(--slate100);
      padding: 11px 13px; line-height: 1.35;
    }
    table.svc td {
      border-bottom: 1px solid var(--slate100); padding: 11px 13px; vertical-align: top;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .tr-even { background: #fafafa; }
    .td-no { width: 40px; text-align: center; }
    .td-name { width: auto; }
    .td-num { width: 13%; text-align: right; white-space: nowrap; }
    .tags { display: flex; flex-wrap: wrap; gap: 5px; }
    .tag {
      font-size: 11px; color: var(--slate700); background: var(--slate50);
      border: 1px solid var(--slate100); border-radius: 4px; padding: 3px 7px;
    }
    .workflow { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
    .wf-step { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 6px; }
    .wf-num {
      width: 20px; height: 20px; border-radius: 50%; color: #fff; font-size: 9px; font-weight: 800;
      display: inline-flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--violet-light), var(--violet-deep));
    }
    .wf-txt { font-size: 12px; color: var(--slate700); max-width: 220px; line-height: 1.52; }
    .wf-arrow { color: var(--slate300); font-size: 9px; }
    table.price-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    table.price-table thead th.pricing-h {
      text-align: left;
      padding: 13px 17px;
      background: linear-gradient(90deg, var(--violet-light), var(--violet-deep));
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.07em;
      line-height: 1.35;
      border: none;
    }
    table.price-table .pr-tr td {
      padding: 11px 16px;
      border-top: 1px solid var(--slate100);
      vertical-align: baseline;
      line-height: 1.45;
    }
    table.price-table .pr-num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    table.price-table .pr-tr.pr-total td {
      font-weight: 800;
      font-size: 16px;
      color: var(--slate900);
      background: rgba(248, 250, 252, 0.95);
      padding-top: 14px;
      padding-bottom: 14px;
    }
    .discount { color: #dc2626; }
    .payment-block {
      margin-top: 4px;
      margin-bottom: 12px;
    }
    table.pay-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      table-layout: fixed;
    }
    table.pay-table .pay-row td {
      padding: 12px 16px;
      border-top: 1px solid var(--slate100);
      vertical-align: top;
      line-height: 1.5;
    }
    table.pay-table .pay-row:first-child td { border-top: none; }
    .pay-badge-cell { width: 56px; }
    table.pay-table .ms-badge {
      min-width: 44px;
      text-align: center;
      font-weight: 800;
      color: var(--accent-mid);
      background: rgba(168, 85, 247, 0.12);
      border-radius: 4px;
      padding: 2px 6px;
      display: inline-block;
    }
    .pay-label { color: var(--slate700); }
    .pay-amt {
      width: 28%;
      text-align: right;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--slate900);
    }
    /* --- Last page: flex column fills ≥ one content page; footer pinned with margin-top: auto --- */
    .pdf-last-page {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      min-height: 260mm;
      margin-top: 28px;
      padding-top: 28px;
    }
    .pdf-last-page__grow {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .trust {
      margin-top: 0;
      padding: 20px 22px;
      border-radius: 10px;
      background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(139, 92, 246, 0.25);
      page-break-inside: auto;
    }
    .trust-title {
      font-size: 16.5px;
      font-weight: 800;
      color: var(--slate900);
      letter-spacing: 0.02em;
      margin: 0 0 16px;
      line-height: 1.25;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(139, 92, 246, 0.22);
    }
    .trust-title .brand {
      background: linear-gradient(90deg, var(--violet-light), var(--violet-deep));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      color: var(--violet-deep);
    }
    .trust-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 28px;
      align-items: start;
    }
    .trust-point {
      page-break-inside: avoid;
      min-width: 0;
    }
    .trust-pt-title {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--slate900);
      margin-bottom: 5px;
      line-height: 1.3;
    }
    .trust-pt-desc {
      font-size: 11.5px;
      font-weight: 400;
      color: var(--slate500);
      line-height: 1.55;
      margin: 0;
    }
    .cta {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 20px;
      margin-top: 22px;
      align-items: stretch;
      border: 1px solid var(--slate100); border-radius: 10px; padding: 18px 20px;
      background: linear-gradient(180deg, #faf5ff 0%, #fff 45%);
      page-break-inside: avoid;
    }
    .cta-l { flex: 1 1 220px; min-width: 200px; }
    .cta-r {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
      flex: 0 1 240px;
      min-width: 200px;
    }
    .cta-h { font-size: 12.5px; font-weight: 800; letter-spacing: 0.08em; color: var(--violet-deep); margin-bottom: 9px; line-height: 1.35; }
    .cta-d { font-size: 12px; color: var(--slate500); margin-bottom: 7px; line-height: 1.58; }
    .btn {
      display: block; text-align: center; text-decoration: none;
      padding: 13px 17px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em;
      line-height: 1.3;
    }
    .btn-proceed {
      color: #fff;
      background: linear-gradient(135deg, #9333ea, var(--violet-deep));
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
      font-size: 12px;
      padding: 15px 19px;
    }
    .btn-primary {
      color: #fff;
      background: linear-gradient(135deg, var(--violet-light), var(--violet-deep));
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);
    }
    .btn-secondary {
      color: #5b21b6; border: 1px solid #c4b5fd; background: #fff; font-weight: 700;
    }
    .btn-disabled { opacity: 0.65; cursor: default; pointer-events: none; }
    .sig-wrap {
      margin-top: 28px;
      page-break-inside: avoid;
      max-width: 320px;
    }
    .sig-img {
      display: block;
      width: 200px;
      height: 48px;
      object-fit: contain;
      object-position: left bottom;
      margin-bottom: 6px;
    }
    .sig-img-spacer { height: 40px; margin-bottom: 6px; }
    .sig-line { border-bottom: 1px solid var(--slate900); margin-bottom: 8px; width: 100%; max-width: 260px; }
    .sig-name { font-size: 13px; font-weight: 800; color: var(--slate900); line-height: 1.35; }
    .sig-role { font-size: 11.5px; color: var(--slate500); margin-top: 5px; line-height: 1.5; }
    .doc-footer {
      flex-shrink: 0;
      margin-top: auto;
      margin-bottom: 0;
      padding-top: 16px;
      border-top: 1px solid var(--slate300);
      text-align: center;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .doc-footer-main {
      font-size: 10.5px;
      font-weight: 600;
      color: #334155;
      line-height: 1.5;
    }
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
      <div class="h-title">QUOTATION</div>
      <div class="title-accent"></div>
      <div class="meta">Ref: <strong>${esc(q.quotationNumber || 'TBD')}</strong></div>
      <div class="meta">Date: <strong>${esc(issueDate)}</strong></div>
      <div class="meta">Valid until: <strong>${esc(validUntilStr)}</strong></div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="billing">
    <div class="bill-col">
      <div class="lbl">Bill From</div>
      <div class="bill-name">${esc(company?.name || 'Company')}</div>
      ${company?.address ? `<div class="bill-txt">${esc(company.address)}</div>` : ''}
      ${company?.email ? `<div class="bill-txt">${esc(company.email)}</div>` : ''}
      ${company?.phone ? `<div class="bill-txt">${esc(company.phone)}</div>` : ''}
    </div>
    <div class="bill-col r">
      <div class="lbl">Bill To</div>
      <div class="bill-name">${esc(client.contactName)}</div>
      ${client.companyName ? `<div class="bill-txt">${esc(client.companyName)}</div>` : ''}
      ${client.address ? `<div class="bill-txt">${esc(client.address)}</div>` : ''}
      ${client.email ? `<div class="bill-txt">${esc(client.email)}</div>` : ''}
      ${client.phone ? `<div class="bill-txt">${esc(client.phone)}</div>` : ''}
    </div>
  </div>

  <div class="sec">Project</div>
  <div class="card">
    <div class="proj-title">${esc(details?.title || 'Project')}</div>
    <div class="badges">
      <span class="badge">${esc(serviceBadge)}</span>
      ${client.companyName ? `<span class="badge">${esc(client.companyName)}</span>` : ''}
      ${statusUpper ? `<span class="badge">${esc(statusUpper)}</span>` : ''}
    </div>
  </div>

  ${
      q.overview
          ? `<div class="sec">Overview</div><div class="card card-soft"><div class="bill-txt">${esc(q.overview).replace(/\n/g, '<br/>')}</div></div>`
          : ''
  }

  ${
      phases.length
          ? `<div class="sec">Project Scope</div>
    <div class="scope-stack">${phasesHtml}</div>`
          : ''
  }

  <div class="sec">Services</div>
  <div class="card" style="padding:0;">
    <table class="svc">
      <thead>
        <tr>
          <th class="td-no">No.</th>
          <th class="td-name">Service</th>
          <th class="td-num">Qty</th>
          <th class="td-num">Rate</th>
          <th class="td-num">Total</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  ${techTags.length ? `<div class="sec">Technology Stack</div><div class="card">${techHtml}</div>` : ''}

  ${workflowSteps.length ? `<div class="sec">Workflow</div><div class="card">${workflowHtml}</div>` : ''}

  <div class="sec">Pricing</div>
  <div class="card" style="padding:0;">
    <table class="price-table">
      <thead>
        <tr>
          <th colspan="2" class="pricing-h pricing-th">Pricing Breakdown</th>
        </tr>
      </thead>
      <tbody>
        ${pricingTbodyRows}
      </tbody>
    </table>
  </div>

  <div class="payment-block">
  <div class="sec">Payment Terms</div>
  <div class="card" style="padding:0;">
    <table class="pay-table">
      <tbody>${milestonesHtml}</tbody>
    </table>
  </div>
  </div>

  <div class="pdf-last-page">
    <div class="pdf-last-page__grow">
  <div class="trust">
    <h2 class="trust-title">Why Choose <span class="brand">WebBriks</span></h2>
    <div class="trust-grid">
      <div class="trust-point">
        <div class="trust-pt-title">Strategic Product Thinking</div>
        <p class="trust-pt-desc">We align scope, milestones, and outcomes with your goals—so you invest in impact, not busywork.</p>
      </div>
      <div class="trust-point">
        <div class="trust-pt-title">Modern Scalable Tech Stack</div>
        <p class="trust-pt-desc">Future-ready tooling and architecture that grow with you and keep maintenance predictable.</p>
      </div>
      <div class="trust-point">
        <div class="trust-pt-title">Transparent &amp; Phased Delivery</div>
        <p class="trust-pt-desc">Clear phases, visible progress, and pricing tied to accountable checkpoints you can trust.</p>
      </div>
      <div class="trust-point">
        <div class="trust-pt-title">Reliable Communication &amp; Support</div>
        <p class="trust-pt-desc">Proactive updates, responsive collaboration, and partnership that continues after go-live.</p>
      </div>
    </div>
  </div>

  <div class="cta">
    <div class="cta-l">
      <div class="cta-h">SECURE ONLINE PAYMENT</div>
      <div class="cta-d">Use the secure online portal to review and accept this quotation, then proceed to the first milestone payment.</div>
      ${ctaMilestoneText ? `<div class="cta-d">${ctaMilestoneText}</div>` : ''}
    </div>
    <div class="cta-r">
      ${payButtons}
    </div>
  </div>

  <div class="sig-wrap">
    ${signatureBlock}
    <div class="sig-line"></div>
    <div class="sig-name">Md. Ashaduzzaman</div>
    <div class="sig-role">Founder &amp; CEO, ${esc(company?.name || 'WebBriks')}</div>
  </div>

    </div>

  <footer class="doc-footer">
    <div class="doc-footer-main">
      WebBriks — <a href="mailto:info@webbriks.com">info@webbriks.com</a> — <a href="https://www.webbriks.com">www.webbriks.com</a>
    </div>
  </footer>
  </div>

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

        const groupId = String((q as any).quotationGroupId ?? '');
        let paymentPageUrl = '';
        if (groupId) {
            try {
                paymentPageUrl = await QuotationService.getClientLink(groupId);
            } catch (err) {
                logger.warn(
                    { err, quotationId, groupId },
                    'quotation.puppeteer_pdf.payment_link',
                );
            }
        }
        if (!paymentPageUrl?.trim()) {
            const fallback = buildPaymentLink(
                (q as any).secureToken,
                envConfig.payment_client_url,
            );
            if (fallback) paymentPageUrl = fallback;
        }

        const html = buildPrintHtml(q as Record<string, any>, {
            paymentClientBase: envConfig.payment_client_url,
            paymentPageUrl,
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
