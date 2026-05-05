import { format } from 'date-fns';
import puppeteer from 'puppeteer';
import envConfig from '../config/env.config.js';
import QuotationModel from '../models/quotation.model.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';

/** Matches client `QuotationPDF` + `formatMoney` (BDT / ISO / symbol). */
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

function compactList(parts: Array<string | undefined | null>): string[] {
    return parts.map((x) => String(x ?? '').trim()).filter(Boolean);
}

function buildPaymentLink(secureToken: unknown, paymentBase: string): string | null {
    if (!secureToken || typeof secureToken !== 'string') return null;
    return `${paymentBase.replace(/\/$/, '')}/quotation/${secureToken}`;
}

type LineItem = { name: string; qty: number; rate: number; total: number };

type Milestone = { label: string; percentage: number; note?: string };

const DEFAULT_LOGO =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png';

const DEFAULT_SIGNATURE =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png';

function buildPrintHtml(
    q: Record<string, any>,
    ctx: { paymentClientBase: string; logoUrl: string; signatureUrl: string },
): string {
    const company = q.company || {};
    const client = q.client || {};
    const details = q.details || {};
    const totals = q.totals || {};
    const pricing = q.pricing || {};
    const techStack = q.techStack || {};
    const phases = Array.isArray(q.phases) ? q.phases : [];
    const additionalServices = Array.isArray(q.additionalServices) ? q.additionalServices : [];
    const workflow = Array.isArray(q.workflow) ? q.workflow : [];

    const currency = q.currency || 'BDT';
    const payLink = buildPaymentLink(q.secureToken, ctx.paymentClientBase);
    const logoUrl = (company.logo as string) || ctx.logoUrl;

    const issueDate = details?.date
        ? format(new Date(details.date), 'PPP')
        : format(new Date(), 'PPP');
    const validUntilStr = details?.validUntil
        ? format(new Date(details.validUntil), 'PPP')
        : '—';

    const baseTitle =
        q.serviceType === 'web-development' ? 'Web Design & Development' : 'Service';

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
            name: details?.title ? `${baseTitle} — ${details.title}` : baseTitle,
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

    const workflowSteps = workflow.map((s: string) => String(s || '').trim()).filter(Boolean);

    const pricingSubtotal = totals?.subtotal ?? 0;
    const pricingTax = totals?.taxAmount ?? 0;
    const pricingTotal = totals?.grandTotal ?? 0;
    const discountAmount =
        pricing?.discount && pricingSubtotal ? (pricingSubtotal * pricing.discount) / 100 : 0;

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
    const ctaPrimary = firstMilestone
        ? `ACCEPT & PAY ${firstMilestone.percentage}%`
        : 'ACCEPT QUOTATION';

    const footerText = compactList([
        company?.name ? String(company.name) : 'Company',
        company?.email ? `— ${company.email}` : null,
        company?.website ? `— ${company.website}` : null,
    ]).join(' ');

    const serviceBadge =
        q.serviceType === 'web-development' ? 'WEB' : 'SERVICE';
    const statusUpper = q.status ? String(q.status).replace(/_/g, ' ').toUpperCase() : '';

    const rowsHtml = items
        .map(
            (item, index) => `
        <tr class="${index % 2 ? 'tr-even' : ''}">
          <td class="td-no">${index + 1}</td>
          <td>${esc(item.name)}</td>
          <td class="td-num">${item.qty}</td>
          <td class="td-num">${item.rate > 0 ? formatMoneyPdf(item.rate, currency) : '—'}</td>
          <td class="td-num">${item.total > 0 ? formatMoneyPdf(item.total, currency) : '—'}</td>
        </tr>`,
        )
        .join('');

    const phasesHtml = phases.length
        ? phases
              .map(
                  (p: any, idx: number) => `
        <div class="scope-card">
          <div class="scope-h">
            <strong>Phase ${idx + 1}: ${esc(p.title)}</strong>
            <span class="scope-count">${(p.items || []).length} items</span>
          </div>
          ${p.description ? `<p class="scope-desc">${esc(p.description)}</p>` : ''}
          ${(p.items || []).map((item: string) => `<div class="bullet"><span class="dot">•</span><span>${esc(item)}</span></div>`).join('')}
        </div>`,
              )
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
        .map((m, idx) => {
            const isLast = idx === milestones.length - 1;
            const amount = (pricingTotal * (m.percentage || 0)) / 100;
            return `
        <div class="ms-row${isLast ? ' ms-last' : ''}">
          <span class="ms-badge">${m.percentage}%</span>
          <span class="ms-label">${esc(m.label)}</span>
          <span class="ms-amt">${formatMoneyPdf(amount, currency)}</span>
        </div>`;
        })
        .join('');

    const taxRow =
        pricing?.taxRate != null && Number(pricing.taxRate) > 0
            ? `<div class="pr-row"><span>Tax (${esc(pricing.taxRate)}%)</span><span>${formatMoneyPdf(pricingTax, currency)}</span></div>`
            : '';

    const discountRow = pricing?.discount
        ? `<div class="pr-row pr-row-last"><span>Discount (${esc(pricing.discount)}%)</span><span class="discount">−${formatMoneyPdf(discountAmount, currency)}</span></div>`
        : `<div class="pr-row pr-row-last"><span>Discount</span><span>${formatMoneyPdf(0, currency)}</span></div>`;

    const ctaMilestoneText = firstMilestone
        ? `On acceptance: ${firstMilestone.percentage}% (${formatMoneyPdf(
              (pricingTotal * firstMilestone.percentage) / 100,
              currency,
          )}) — ${esc(firstMilestone.label)}.`
        : '';

    const payButtons = payLink
        ? `
      <a class="btn btn-primary" href="${esc(payLink)}">${esc(ctaPrimary)}</a>
      <a class="btn btn-secondary" href="${esc(payLink)}">VIEW FULL QUOTATION</a>`
        : `<span class="btn btn-primary btn-disabled">LINK PENDING</span>`;

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
      font-size: 9.5px;
      line-height: 1.5;
      color: var(--slate700);
      background: #fff;
    }
    .page-pad { padding: 0 2mm; }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .logo-box { width: 120px; height: 44px; display: flex; align-items: center; }
    .logo-box img { max-width: 100%; max-height: 44px; object-fit: contain; }
    .header-right { text-align: right; }
    .h-title {
      font-size: 22px;
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
    .meta { font-size: 9px; color: var(--slate500); margin-bottom: 2px; }
    .meta strong { color: var(--slate900); font-weight: 700; }
    .divider { height: 1px; background: var(--slate100); margin: 16px 0; }
    .billing { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .bill-col { width: 48%; }
    .bill-col.r { text-align: right; }
    .lbl {
      font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em;
      color: var(--accent-mid); margin-bottom: 6px;
    }
    .bill-name { font-size: 10.5px; font-weight: 700; color: var(--slate900); margin-bottom: 3px; }
    .bill-txt { font-size: 9px; color: var(--slate500); line-height: 1.45; margin-bottom: 1px; }
    .sec {
      font-size: 10px; font-weight: 700; color: var(--slate900);
      letter-spacing: 0.08em; text-transform: uppercase; margin-top: 18px; margin-bottom: 8px;
    }
    .card {
      border: 1px solid var(--slate100); border-radius: 6px; padding: 12px;
      background: #fff; margin-bottom: 6px;
    }
    .card-soft { background: var(--slate50); }
    .proj-title { font-size: 13px; font-weight: 700; color: var(--slate900); margin-bottom: 6px; }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .badge {
      border: 1px solid var(--slate100); border-radius: 4px; padding: 2px 7px;
      background: var(--slate50); font-size: 7.5px; font-weight: 700;
      color: var(--slate500); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .scope-card {
      border: 1px solid var(--slate100); border-radius: 6px; padding: 12px; margin-bottom: 6px;
      page-break-inside: avoid;
    }
    .scope-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 10px; color: var(--slate900); }
    .scope-count { font-size: 8px; color: var(--slate500); }
    .scope-desc { font-size: 9px; color: var(--slate500); margin-bottom: 6px; }
    .bullet { display: flex; gap: 6px; margin-bottom: 3px; font-size: 9px; }
    .dot { color: var(--accent-mid); font-weight: 700; width: 10px; flex-shrink: 0; }
    table.svc { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 4px; }
    table.svc th {
      text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--slate500); background: var(--slate50); border-bottom: 1px solid var(--slate100);
      padding: 6px 8px;
    }
    table.svc td {
      border-bottom: 1px solid var(--slate100); padding: 6px 8px; vertical-align: top;
    }
    .tr-even { background: #fafafa; }
    .td-no { width: 28px; }
    .td-num { text-align: right; white-space: nowrap; }
    .tags { display: flex; flex-wrap: wrap; gap: 5px; }
    .tag {
      font-size: 8px; color: var(--slate700); background: var(--slate50);
      border: 1px solid var(--slate100); border-radius: 4px; padding: 3px 7px;
    }
    .workflow { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
    .wf-step { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
    .wf-num {
      width: 16px; height: 16px; border-radius: 50%; color: #fff; font-size: 7px; font-weight: 800;
      display: inline-flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--violet-light), var(--violet-deep));
    }
    .wf-txt { font-size: 8.5px; color: var(--slate700); max-width: 140px; }
    .wf-arrow { color: var(--slate300); font-size: 9px; }
    .pricing { border-radius: 6px; overflow: hidden; border: 1px solid var(--slate100); page-break-inside: avoid; }
    .pricing-h {
      padding: 8px 12px;
      background: linear-gradient(90deg, var(--violet-light), var(--violet-deep));
      color: #fff; font-size: 9px; font-weight: 700; letter-spacing: 0.06em;
    }
    .pricing-b { padding: 10px 12px; }
    .pr-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 9px; }
    .pr-row-last { border-bottom: 1px solid var(--slate100); margin-bottom: 6px; padding-bottom: 8px; }
    .discount { color: #dc2626; }
    .pr-total { display: flex; justify-content: space-between; padding-top: 8px; font-weight: 800; font-size: 12px; color: var(--slate900); }
    .ms { border: 1px solid var(--slate100); border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
    .ms-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--slate100); font-size: 9px; }
    .ms-last { border-bottom: none; }
    .ms-badge {
      min-width: 36px; text-align: center; font-weight: 800;
      color: var(--accent-mid); background: rgba(168, 85, 247, 0.12); border-radius: 4px; padding: 2px 6px;
    }
    .ms-label { flex: 1; color: var(--slate700); }
    .ms-amt { font-weight: 700; color: var(--slate900); }
    .trust {
      margin-top: 14px; padding: 12px; border-radius: 6px;
      background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(139, 92, 246, 0.25);
      page-break-inside: avoid;
    }
    .trust h4 { font-size: 9px; font-weight: 800; color: var(--violet-deep); margin-bottom: 6px; letter-spacing: 0.04em; }
    .trust p { font-size: 9px; color: var(--slate700); line-height: 1.55; }
    .cta {
      display: flex; gap: 16px; margin-top: 16px; align-items: flex-start;
      border: 1px solid var(--slate100); border-radius: 8px; padding: 14px;
      background: linear-gradient(180deg, #faf5ff 0%, #fff 40%);
      page-break-inside: avoid;
    }
    .cta-l { flex: 1; }
    .cta-r { display: flex; flex-direction: column; gap: 8px; align-items: stretch; min-width: 200px; }
    .cta-h { font-size: 9px; font-weight: 800; letter-spacing: 0.1em; color: var(--violet-deep); margin-bottom: 6px; }
    .cta-d { font-size: 9px; color: var(--slate500); margin-bottom: 4px; line-height: 1.45; }
    .btn {
      display: inline-block; text-align: center; text-decoration: none;
      padding: 10px 14px; border-radius: 6px; font-size: 8px; font-weight: 800; letter-spacing: 0.06em;
    }
    .btn-primary {
      color: #fff;
      background: linear-gradient(135deg, var(--violet-light), var(--violet-deep));
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);
    }
    .btn-secondary {
      color: #5b21b6; border: 1px solid #c4b5fd; background: #fff;
    }
    .btn-disabled { opacity: 0.7; cursor: default; }
    .sig-wrap { margin-top: 20px; page-break-inside: avoid; }
    .sig-row { display: flex; justify-content: space-between; gap: 24px; }
    .sig-block { flex: 1; }
    .sig-block img { max-height: 36px; object-fit: contain; display: block; margin-bottom: 4px; }
    .sig-line { border-bottom: 1px solid var(--slate900); margin-bottom: 6px; max-width: 220px; }
    .sig-name { font-size: 10px; font-weight: 700; color: var(--slate900); }
    .sig-role { font-size: 8px; color: var(--slate500); margin-top: 2px; }
    .spacer36 { height: 36px; }
    .foot {
      margin-top: 24px; padding-top: 10px; border-top: 1px solid var(--slate100);
      font-size: 8px; color: var(--slate500); text-align: center;
    }
  </style>
</head>
<body>
<div class="page-pad">

  <div class="header-row">
    <div class="logo-box">
      <img src="${esc(logoUrl)}" alt="Logo" crossorigin="anonymous" />
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
          ? `<div class="sec">Overview</div><div class="card card-soft"><div class="bill-txt" style="font-size:9.5px;color:var(--slate700);line-height:1.55;">${esc(q.overview).replace(/\n/g, '<br/>')}</div></div>`
          : ''
  }

  ${
      phases.length
          ? `<div class="sec">Project Scope</div>
    ${phasesHtml}`
          : ''
  }

  <div class="sec">Services</div>
  <div class="card" style="padding:0;">
    <table class="svc">
      <thead>
        <tr>
          <th class="td-no">No.</th>
          <th>Service</th>
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
  <div class="pricing">
    <div class="pricing-h">Pricing Breakdown</div>
    <div class="pricing-b">
      <div class="pr-row"><span>Subtotal</span><span>${formatMoneyPdf(pricingSubtotal, currency)}</span></div>
      ${taxRow}
      ${discountRow}
      <div class="pr-total"><span>Grand Total</span><span>${formatMoneyPdf(pricingTotal, currency)}</span></div>
    </div>
  </div>

  <div class="sec">Payment Terms</div>
  <div class="ms">${milestonesHtml}</div>

  <div class="trust">
    <h4>Why partner with us</h4>
    <p>We combine product strategy, modern engineering and reliable delivery to scale your business with confidence. This proposal reflects a phased, accountable delivery approach with transparent pricing.</p>
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
    <div class="sig-row">
      <div class="sig-block">
        <img src="${esc(ctx.signatureUrl)}" alt="Signature" crossorigin="anonymous" />
        <div class="sig-line"></div>
        <div class="sig-name">Md. Ashaduzzaman</div>
        <div class="sig-role">Founder &amp; CEO, ${esc(company?.name || 'Company')}</div>
      </div>
      <div class="sig-block">
        <div class="spacer36"></div>
        <div class="sig-line"></div>
        <div class="sig-name">${esc(client.contactName)}</div>
        <div class="sig-role">Client signature</div>
      </div>
    </div>
  </div>

  <div class="foot">${esc(footerText)}</div>

</div>
</body>
</html>`;
}

export class QuotationPuppeteerPdfService {
    static async generatePdf(quotationId: string): Promise<{ buffer: Buffer; filename: string }> {
        const q = await QuotationModel.findById(quotationId)
            .populate('clientId', 'name clientId emails')
            .lean();
        if (!q) throw new AppError('Quotation not found', 404);

        const signatureUrl = process.env.COMPANY_SIGNATURE_URL || DEFAULT_SIGNATURE;

        const html = buildPrintHtml(q as Record<string, any>, {
            paymentClientBase: envConfig.payment_client_url,
            logoUrl: DEFAULT_LOGO,
            signatureUrl,
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
                const g = globalThis as unknown as { document: { querySelectorAll: (sel: string) => Iterable<unknown> } };
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
                displayHeaderFooter: true,
                headerTemplate: '<div></div>',
                footerTemplate: `<div style="width:100%;font-size:8px;color:#64748b;text-align:center;font-family:system-ui,sans-serif;padding-top:4px;">
  Page <span class="pageNumber"></span> of <span class="totalPages"></span>
</div>`,
                margin: { top: '12mm', bottom: '18mm', left: '10mm', right: '10mm' },
            });
            const rawName = `${(q as any).quotationNumber || (q as any).details?.title || 'quotation'}.pdf`;
            const filename = rawName.replace(/[/\\?%*:|"<>]/g, '-');
            return { buffer: Buffer.from(pdf), filename };
        } catch (e: unknown) {
            const err = e as { message?: string };
            logger.error({ err: e, quotationId }, 'quotation.puppeteer_pdf_failed');
            throw new AppError(err?.message || 'Failed to generate PDF with Puppeteer', 500);
        } finally {
            await browser?.close().catch(() => {});
        }
    }
}
