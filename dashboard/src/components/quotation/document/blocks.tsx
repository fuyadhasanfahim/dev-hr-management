import type { ReactNode } from "react";

import { computeQuotationTotals } from "@/lib/quotation-totals";
import { isUpfrontBillingCycle, type BillingCycle, type IQuotationLineItem, type IQuotationService } from "@/types/quotation.type";
import { DEFAULT_LEGAL, LOGO_SRC, SIGNATORY_NAME, SIGNATORY_ROLE, SIGNATURE_SRC } from "./brand";
import { fmtDate, fmtMoney } from "./format";
import type { PBlock } from "./paginate";
import type { QuotationDocInput } from "./types";

export interface Block extends PBlock {
    id: string;
    node: ReactNode;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const BILLING: Record<BillingCycle, string> = {
    "one-time": "One-time",
    monthly: "Monthly",
    yearly: "Yearly",
    "per-image": "Per image",
    "per-video": "Per video",
    "per-second": "Per second",
    "per-10s": "Per 10 sec",
};
const money = (n: number, c?: string) => fmtMoney(n, c);

/** Section opener: number + rule, title, one-line purpose. Always kept with the first row after it. */
const section = (n: number, title: string, desc: string): Block => ({
    id: `sec-${n}`,
    h: 0,
    keepWithNext: true,
    node: (
        <header className="qd-sec">
            <div className="qd-sec-k"><b>{pad2(n)}</b><i /></div>
            <h2>{title}</h2>
            <p>{desc}</p>
        </header>
    ),
});

const subhead = (id: string, text: string, meta?: string): Block => ({
    id,
    h: 0,
    keepWithNext: true,
    node: <div className="qd-sub"><span>{text}</span>{meta && <em>{meta}</em>}</div>,
});

/** Numbered two-column list with hairline separators (features, deliverables). Reading order is row by row. */
function pairRows(id: string, items: string[]): Block[] {
    return Array.from({ length: Math.ceil(items.length / 2) }, (_, r) => ({
        id: `${id}-${r}`,
        h: 0,
        node: (
            <div className="qd-pair">
                {[0, 1].map((c) => {
                    const i = r * 2 + c;
                    return items[i] !== undefined ? (
                        <div className="qd-item" key={c}><span className="qd-no">{pad2(i + 1)}</span><span className="qd-txt">{items[i]}</span></div>
                    ) : (
                        <div key={c} />
                    );
                })}
            </div>
        ),
    }));
}

/** One full-width row per item so long lists and clauses flow across pages without clipping. */
function listRows(id: string, items: string[], marker: (i: number) => ReactNode): Block[] {
    return items.map((t, i) => ({
        id: `${id}-${i}`,
        h: 0,
        node: <div className="qd-item"><span className="qd-no">{marker(i)}</span><span className="qd-txt">{t}</span></div>,
    }));
}

type Row = { title: string; description: string; qty: number; price: number; cycle: BillingCycle };

/** A finance-style table whose rows are separate blocks, so it can continue across pages with its header repeated. */
function priceTable(id: string, rows: Row[], cur: string | undefined, amountHead: string): Block[] {
    const cols = (
        <colgroup>
            <col style={{ width: 34 }} />
            <col />
            <col style={{ width: 44 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 98 }} />
            <col style={{ width: 106 }} />
        </colgroup>
    );
    const out: Block[] = [
        {
            id: `${id}-head`, h: 0, table: id, head: true, keepWithNext: true,
            node: <table className="qd-table">{cols}<thead><tr><th>No.</th><th>Description</th><th className="r">Qty</th><th>Billing</th><th className="r">Unit price</th><th className="r">{amountHead}</th></tr></thead></table>,
        },
    ];
    rows.forEach((r, i) =>
        out.push({
            id: `${id}-${i}`, h: 0, table: id, keepWithNext: i === rows.length - 1,
            node: (
                <table className="qd-table">
                    {cols}
                    <tbody>
                        <tr>
                            <td className="n">{pad2(i + 1)}</td>
                            <td><b>{r.title}</b>{r.description && <small>{r.description}</small>}</td>
                            <td className="r">{r.qty}</td>
                            <td className="m">{BILLING[r.cycle] ?? r.cycle}</td>
                            <td className="r">{money(r.price, cur)}</td>
                            <td className="r"><b>{money(r.price * r.qty, cur)}</b></td>
                        </tr>
                    </tbody>
                </table>
            ),
        }),
    );
    return out;
}

const sumRow = (label: ReactNode, value: ReactNode, strong = false) => (
    <div className={`qd-sum-r${strong ? " strong" : ""}`}><span>{label}</span><span>{value}</span></div>
);

export function buildBlocks(d: QuotationDocInput): Block[] {
    const cur = d.currency;
    const services = d.services as IQuotationService[];
    const calc = computeQuotationTotals(services);
    const taxRate = services.find((s) => s.taxRate)?.taxRate ?? 0;
    const blocks: Block[] = [];
    let chap = 0;
    const next = () => ++chap;
    const clientName = d.client.companyName || d.client.contactName;

    // ── cover ──
    blocks.push({
        id: "cover",
        h: 0,
        node: (
            <div className="qd-cover">
                <div className="qd-mast">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LOGO_SRC} alt={d.company.name} width={158} height={38} />
                    <div className="qd-mast-r"><span>Quotation</span><b># {d.quotationNumber || "Assigned on save"}</b></div>
                </div>
                <div className="qd-cover-title">
                    <p className="qd-kicker">Proposal for {clientName}</p>
                    <h1>{d.details.title}</h1>
                </div>
                <div className="qd-cover-grid">
                    <dl>
                        <div><dt>Quotation no.</dt><dd>{d.quotationNumber || "Assigned on save"}</dd></div>
                        <div><dt>Issued</dt><dd>{fmtDate(d.details.date)}</dd></div>
                        <div><dt>Valid until</dt><dd>{fmtDate(d.details.validUntil)}</dd></div>
                    </dl>
                    <div className="qd-cover-total">
                        <span>Total investment</span>
                        <b>{money(calc.totals.grandTotal, cur)}</b>
                        {calc.recurringCharges.length > 0 && <small>Recurring charges are billed separately</small>}
                    </div>
                </div>
            </div>
        ),
    });

    const line = (label: string, v?: string) => (v ? <div className="qd-line"><em>{label}</em><span>{v}</span></div> : null);
    blocks.push({
        id: "parties",
        h: 0,
        node: (
            <div className="qd-parties">
                <div className="qd-party">
                    <span className="qd-tag">Prepared for</span>
                    <div className="qd-name">{clientName}</div>
                    {d.client.companyName ? line("Contact", d.client.contactName) : null}
                    {line("Address", d.client.address)}
                    {line("Email", d.client.email)}
                    {line("Phone", d.client.phone)}
                </div>
                <div className="qd-party">
                    <span className="qd-tag">Prepared by</span>
                    <div className="qd-name">{d.company.name}</div>
                    {line("Address", d.company.address)}
                    {line("Email", d.company.email)}
                    {line("Phone", d.company.phone)}
                    {line("Web", d.company.website)}
                </div>
            </div>
        ),
    });

    // ── overview ──
    const overview = (d.overview ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (overview.length) {
        blocks.push(section(next(), "Project Overview", "A summary of the project and what we aim to achieve."));
        overview.forEach((p, i) => blocks.push({ id: `ov-${i}`, h: 0, node: <p className="qd-p">{p}</p> }));
    }

    // ── scope & deliverables ──
    const wf = d.workflow ?? [];
    const deliverables = wf.filter((w) => w.startsWith("Deliverable: ")).map((w) => w.slice("Deliverable: ".length));
    const timeline = wf.filter((w) => !w.startsWith("Deliverable: "));
    if (services.some((s) => (s.scopeItems ?? []).length || s.scopeDescription) || deliverables.length) {
        blocks.push(section(next(), "Scope & Deliverables", "Everything that is part of this engagement."));
        services.forEach((s, si) => {
            if (s.scopeDescription) {
                blocks.push(subhead(`sd-${si}-t`, "Scope of work"));
                blocks.push({ id: `sd-${si}`, h: 0, node: <p className="qd-p lead">{s.scopeDescription}</p> });
            }
            const items = (s.scopeItems ?? []).filter(Boolean);
            if (items.length) {
                blocks.push(subhead(`ft-${si}-t`, services.length > 1 ? `Features & capabilities — ${s.category.replace("-", " ")}` : "Features & capabilities", `${items.length} items`));
                blocks.push(...pairRows(`ft-${si}`, items));
            }
        });
        if (deliverables.length) {
            blocks.push(subhead("dl-t", "Deliverables", `${deliverables.length} items`));
            blocks.push(...pairRows("dl", deliverables));
        }
    }

    // ── timeline ──
    if (timeline.length) {
        blocks.push(section(next(), "Milestones & Timeline", "How the work progresses from kick-off to delivery."));
        timeline.forEach((t, i) => {
            const at = t.lastIndexOf(" — ");
            const [title, dur] = at > 0 ? [t.slice(0, at), t.slice(at + 3)] : [t, ""];
            blocks.push({ id: `tl-${i}`, h: 0, node: <div className="qd-item"><span className="qd-no">{pad2(i + 1)}</span><span className="qd-txt">{title}</span>{dur && <span className="qd-dur">{dur}</span>}</div> });
        });
    }

    // ── investment: the one-time project investment, and recurring charges kept apart ──
    const toRow = (l: IQuotationLineItem): Row => ({ title: l.title, description: l.description ?? "", qty: l.quantity ?? 1, price: l.price, cycle: l.billingCycle });
    const oneTime: Row[] = services.flatMap((s) => [
        ...(s.basePrice ? [{ title: "Base price", description: "", qty: 1, price: s.basePrice, cycle: "one-time" as BillingCycle }] : []),
        ...s.lineItems.filter((l) => isUpfrontBillingCycle(l.billingCycle)).map(toRow),
    ]);
    const recurring: Row[] = services.flatMap((s) => s.lineItems.filter((l) => !isUpfrontBillingCycle(l.billingCycle)).map(toRow));
    if (oneTime.length || recurring.length) {
        blocks.push(section(next(), "Investment", "Itemised pricing for this quotation."));
        if (oneTime.length) {
            blocks.push(subhead("inv-t", "Project investment", "one-time"));
            blocks.push(...priceTable("inv", oneTime, cur, "Amount"));
            blocks.push({
                id: "inv-sum",
                h: 0,
                node: (
                    <div className="qd-sum">
                        {sumRow("Subtotal", money(calc.totals.subtotal + calc.totals.discountAmount, cur))}
                        {calc.totals.discountAmount > 0 && sumRow("Discount", `− ${money(calc.totals.discountAmount, cur)}`)}
                        {calc.totals.taxAmount > 0 && sumRow(`VAT / Tax (${taxRate}%)`, money(calc.totals.taxAmount, cur))}
                        <div className="qd-grand"><span>Total investment</span><b>{money(calc.totals.grandTotal, cur)}</b></div>
                    </div>
                ),
            });
        }
        if (recurring.length) {
            blocks.push(subhead("rec-t", "Recurring charges", "billed separately from the project investment"));
            blocks.push(...priceTable("rec", recurring, cur, "Per period"));
            const per = (cycle: BillingCycle) => recurring.filter((r) => r.cycle === cycle).reduce((a, r) => a + r.price * r.qty, 0);
            const monthly = per("monthly");
            const yearly = per("yearly");
            blocks.push({
                id: "rec-sum",
                h: 0,
                node: (
                    <div className="qd-sum">
                        {monthly > 0 && sumRow("Monthly recurring", `${money(monthly, cur)} / month`, true)}
                        {yearly > 0 && sumRow("Yearly recurring", `${money(yearly, cur)} / year`, true)}
                    </div>
                ),
            });
        }
    }

    // ── payment schedule ──
    const ms = d.paymentMilestones ?? [];
    if (ms.length) {
        blocks.push(section(next(), "Payment Schedule", "When each payment is due and how much it is."));
        const cols = (
            <colgroup>
                <col style={{ width: 34 }} />
                <col style={{ width: 190 }} />
                <col />
                <col style={{ width: 66 }} />
                <col style={{ width: 112 }} />
            </colgroup>
        );
        blocks.push({
            id: "pay-head", h: 0, table: "pay", head: true, keepWithNext: true,
            node: <table className="qd-table">{cols}<thead><tr><th>No.</th><th>Milestone</th><th>Condition / due</th><th className="r">Share</th><th className="r">Amount</th></tr></thead></table>,
        });
        ms.forEach((m, i) =>
            blocks.push({
                id: `pay-${i}`, h: 0, table: "pay", keepWithNext: i === ms.length - 1,
                node: (
                    <table className="qd-table">
                        {cols}
                        <tbody>
                            <tr>
                                <td className="n">{pad2(i + 1)}</td>
                                <td><b>{m.label}</b></td>
                                <td className="m">{m.note ?? ""}</td>
                                <td className="r">{m.percentage}%</td>
                                <td className="r"><b>{money((calc.totals.grandTotal * m.percentage) / 100, cur)}</b></td>
                            </tr>
                        </tbody>
                    </table>
                ),
            }),
        );
        blocks.push({
            id: "pay-total",
            h: 0,
            node: <div className="qd-sum">{sumRow(`Total (${ms.reduce((a, m) => a + (Number(m.percentage) || 0), 0)}%)`, money((calc.totals.grandTotal * ms.reduce((a, m) => a + (Number(m.percentage) || 0), 0)) / 100, cur), true)}</div>,
        });
    }

    // ── lists ──
    const dot = () => <i className="qd-dot" />;
    const cross = () => <i className="qd-x">×</i>;
    const included = d.includedSupport ?? [];
    if (included.length) {
        blocks.push(section(next(), "Support & Inclusions", "What is covered in your package beyond the build itself."));
        blocks.push(...listRows("inc", included, dot));
    }
    const needs = d.clientRequirements ?? [];
    if (needs.length) {
        blocks.push(section(next(), "What We Need From You", "Items from your side that keep the project on schedule."));
        blocks.push(...listRows("need", needs, dot));
    }
    const excluded = d.notIncluded ?? [];
    if (excluded.length) {
        blocks.push(section(next(), "Not Included", "Outside the scope of this quotation; can be quoted separately."));
        blocks.push(...listRows("exc", excluded, cross));
    }
    const terms = d.keyTerms ?? [];
    if (terms.length) {
        blocks.push(section(next(), "Terms & Conditions", "The terms that govern this quotation."));
        blocks.push(...listRows("terms", terms, (i) => pad2(i + 1)));
    }

    // ── next steps, signature (identical to the previous quotation PDF), closing ──
    const advance = ms[0]?.percentage ? `${ms[0].percentage}%` : "agreed";
    blocks.push(section(next(), "Next Steps", "What happens once you approve this quotation."));
    blocks.push({
        id: "next",
        h: 0,
        keepWithNext: true,
        node: (
            <div className="qd-next">
                <div><b>1</b><span>Confirm quotation</span></div>
                <div><b>2</b><span>Complete {advance} initial payment</span></div>
                <div><b>3</b><span>Project begins</span></div>
            </div>
        ),
    });
    blocks.push({
        id: "auth",
        h: 0,
        keepWithNext: true,
        node: (
            <div className="qd-auth">
                <div className="qd-auth-label">Authorized by</div>
                {SIGNATURE_SRC ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="qd-auth-sig" src={SIGNATURE_SRC} alt="" crossOrigin="anonymous" />
                ) : (
                    <div className="qd-auth-spacer" />
                )}
                <div className="qd-auth-line" />
                <div className="qd-auth-name">{SIGNATORY_NAME}</div>
                <div className="qd-auth-role">{SIGNATORY_ROLE}, {d.company.name}</div>
            </div>
        ),
    });
    blocks.push({
        id: "closing",
        h: 0,
        node: (
            <div className="qd-closing">
                <div className="qd-closing-name">{d.company.name}</div>
                <div className="qd-closing-contact">{d.company.country || DEFAULT_LEGAL.country}</div>
                <div className="qd-closing-address">{d.company.ein || DEFAULT_LEGAL.ein} · {d.company.vat || DEFAULT_LEGAL.vat}</div>
            </div>
        ),
    });

    return blocks;
}
