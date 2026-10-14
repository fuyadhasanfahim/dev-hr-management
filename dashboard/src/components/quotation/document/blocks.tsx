import type { ReactNode } from "react";
import {
    IconBox,
    IconCalendarDollar,
    IconCircleX,
    IconFileDescription,
    IconGavel,
    IconInfoCircle,
    IconListDetails,
    IconMail,
    IconMapPin,
    IconPhone,
    IconReceipt2,
    IconRoute,
    IconShieldCheck,
    IconTarget,
    IconTimeline,
    IconUser,
    IconUserCheck,
    IconWorld,
    IconX,
} from "@tabler/icons-react";

import { computeQuotationTotals } from "@/lib/quotation-totals";
import type { IQuotationService } from "@/types/quotation.type";
import { DEFAULT_LEGAL, LOGO_SRC, SIGNATORY_NAME, SIGNATORY_ROLE, SIGNATURE_SRC } from "./brand";
import { fmtDate, fmtMoney } from "./format";
import type { PBlock } from "./paginate";
import type { QuotationDocInput } from "./types";

export type Tone = "brand" | "rose" | "amber" | "slate" | "plain";
type Icon = typeof IconBox;

export interface Block extends PBlock {
    id: string;
    node: ReactNode;
    /** Blocks sharing a card id are drawn as one bordered block, even across a page break. */
    card?: { id: string; tone: Tone };
}

const cycleLabel = (c?: string) => (c === "monthly" ? " / month" : c === "yearly" ? " / year" : "");
const pad2 = (n: number) => String(n).padStart(2, "0");
const SPLIT_SHADES = ["#a855f7", "#7c3aed", "#5b21b6", "#3b1280", "#6d28d9", "#8b5cf6"];

const chapter = (n: number, Ic: Icon, title: string, desc: string): Block => ({
    id: `ch-${n}`,
    h: 0,
    keepWithNext: true,
    node: (
        <div className="qd-chap">
            <span className="qd-chap-n">{pad2(n)}</span>
            <div>
                <h2>{title}</h2>
                <p>{desc}</p>
            </div>
            <span className="qd-chap-rule" />
            <Ic size={22} stroke={1.6} color="#a78bda" />
        </div>
    ),
});

const gap = (id: string): Block => ({ id: `${id}-gap`, h: 0, node: <div className="qd-gap" /> });

/** A titled block (icon + title + subtitle) whose rows may continue on the next page. */
function cardBlocks(id: string, tone: Tone, Ic: Icon, title: string, sub: string, rows: ReactNode[]): Block[] {
    if (!rows.length) return [];
    const card = { id, tone };
    return [
        {
            id: `${id}-h`,
            h: 0,
            card,
            table: id,
            head: true,
            keepWithNext: true,
            node: (
                <div className="qd-card-head">
                    <span className="qd-card-ic"><Ic size={18} stroke={1.8} /></span>
                    <div>
                        <h3>{title}</h3>
                        <p>{sub}</p>
                    </div>
                </div>
            ),
        },
        ...rows.map((r, i) => ({ id: `${id}-r${i}`, h: 0, card, table: id, keepWithNext: i === rows.length - 1, node: <div className="qd-row">{r}</div> })),
        { id: `${id}-e`, h: 0, card, node: <div className="qd-card-end" /> },
        gap(id),
    ];
}

const pairs = (items: string[], offset = 0): ReactNode[] =>
    Array.from({ length: Math.ceil(items.length / 2) }, (_, r) => (
        <div className="qd-tiles" key={r}>
            {[0, 1].map((c) => {
                const t = items[r * 2 + c];
                return t ? (
                    <div className="qd-tile" key={c}><i>{pad2(offset + r * 2 + c + 1)}</i><span>{t}</span></div>
                ) : (
                    <div className="qd-tile empty" key={c} />
                );
            })}
        </div>
    ));

const paragraphsOf = (text?: string) => (text ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

export function buildBlocks(d: QuotationDocInput): Block[] {
    const cur = d.currency;
    const calc = computeQuotationTotals(d.services as IQuotationService[]);
    const taxRate = d.services.find((s) => s.taxRate)?.taxRate ?? 0;
    const blocks: Block[] = [];
    let chap = 0;
    const next = () => ++chap;

    // ── cover ──
    const clientName = d.client.companyName || d.client.contactName;
    blocks.push({
        id: "hero",
        h: 0,
        node: (
            <div className="qd-hero">
                <div className="qd-hero-top">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LOGO_SRC} alt={d.company.name} width={183} height={44} />
                    <div className="qd-hero-id">
                        <span>QUOTATION</span>
                        <b># {d.quotationNumber || "Assigned on save"}</b>
                    </div>
                </div>
                <div className="qd-hero-body">
                    <span className="qd-eyebrow">Proposal</span>
                    <h1>{d.details.title}</h1>
                    <p className="qd-hero-for">Prepared for <b>{clientName}</b></p>
                </div>
                <div className="qd-facts">
                    <div className="qd-fact"><label>Issued</label><b>{fmtDate(d.details.date)}</b></div>
                    <div className="qd-fact"><label>Valid until</label><b>{fmtDate(d.details.validUntil)}</b></div>
                    <div className="qd-fact strong"><label>Total investment</label><b>{fmtMoney(calc.totals.grandTotal, cur)}</b></div>
                </div>
            </div>
        ),
    });

    const line = (Ic: Icon, v?: string) => (v ? <div className="qd-line"><Ic size={14} stroke={1.8} /><span>{v}</span></div> : null);
    blocks.push({
        id: "parties",
        h: 0,
        node: (
            <div className="qd-parties">
                <div className="qd-party for">
                    <span className="qd-tag"><i />Prepared for</span>
                    <div className="qd-name">{clientName}</div>
                    {line(IconUser, d.client.companyName ? d.client.contactName : undefined)}
                    {line(IconMapPin, d.client.address)}
                    {line(IconMail, d.client.email)}
                    {line(IconPhone, d.client.phone)}
                </div>
                <div className="qd-party">
                    <span className="qd-tag"><i />Prepared by</span>
                    <div className="qd-name">{d.company.name}</div>
                    {line(IconMapPin, d.company.address)}
                    {line(IconMail, d.company.email)}
                    {line(IconPhone, d.company.phone)}
                    {line(IconWorld, d.company.website)}
                </div>
            </div>
        ),
    });

    // ── overview ──
    const overview = paragraphsOf(d.overview);
    if (overview.length) {
        blocks.push(chapter(next(), IconFileDescription, "Project Overview", "A summary of the project and what we aim to achieve."));
        overview.forEach((p, i) => blocks.push({ id: `ov-${i}`, h: 0, node: <div className="qd-lead"><p>{p}</p></div> }));
    }

    // ── scope & deliverables ──
    const wf = d.workflow ?? [];
    const deliverables = wf.filter((w) => w.startsWith("Deliverable: ")).map((w) => w.slice("Deliverable: ".length));
    const timeline = wf.filter((w) => !w.startsWith("Deliverable: "));
    const hasScope = d.services.some((s) => (s.scopeItems ?? []).length || s.scopeDescription) || deliverables.length;
    if (hasScope) {
        blocks.push(chapter(next(), IconTarget, "Scope & Deliverables", "Everything that is part of this engagement."));
        d.services.forEach((s, si) => {
            if (s.scopeDescription) blocks.push({ id: `sd-${si}`, h: 0, node: <div className="qd-lead"><div className="qd-lead-t">Scope of Work</div><p>{s.scopeDescription}</p></div> });
            const items = (s.scopeItems ?? []).filter(Boolean);
            blocks.push(...cardBlocks(`feat-${si}`, "brand", IconListDetails, d.services.length > 1 ? `Features — ${s.category.replace("-", " ")}` : "Features & Capabilities", `${items.length} item${items.length === 1 ? "" : "s"} included in the quoted price`, pairs(items)));
        });
        blocks.push(...cardBlocks("deliv", "brand", IconBox, "Deliverables", "What you will receive at the end of the project", pairs(deliverables)));
    }

    // ── timeline ──
    if (timeline.length) {
        blocks.push(chapter(next(), IconTimeline, "Milestones & Timeline", "How the work progresses from kick-off to delivery."));
        timeline.forEach((t, i) => {
            const at = t.lastIndexOf(" — ");
            const [title, dur] = at > 0 ? [t.slice(0, at), t.slice(at + 3)] : [t, ""];
            blocks.push({
                id: `tl-${i}`,
                h: 0,
                node: (
                    <div className="qd-step">
                        <div className="qd-rail"><b>{i + 1}</b></div>
                        <div className="qd-step-body"><span>{title}</span>{dur && <span className="qd-chip">{dur}</span>}</div>
                    </div>
                ),
            });
        });
    }

    // ── investment ──
    const rows = d.services.flatMap((s) => [
        ...(s.basePrice ? [{ title: "Base price", description: "", qty: 1, price: s.basePrice, billing: "" }] : []),
        ...s.lineItems.map((l) => ({ title: l.title, description: l.description ?? "", qty: l.quantity ?? 1, price: l.price, billing: cycleLabel(l.billingCycle) })),
    ]);
    if (rows.length) {
        blocks.push(chapter(next(), IconReceipt2, "Investment", "Itemised pricing for this quotation."));
        const card = { id: "inv", tone: "plain" as Tone };
        const cols = (
            <colgroup>
                <col style={{ width: 36 }} />
                <col />
                <col style={{ width: 52 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 118 }} />
            </colgroup>
        );
        blocks.push({
            id: "inv-head", h: 0, table: "inv", head: true, keepWithNext: true, card,
            node: <table className="qd-table">{cols}<thead><tr><th>#</th><th>Item description</th><th className="c">Qty</th><th className="r">Unit price</th><th className="r">Total</th></tr></thead></table>,
        });
        rows.forEach((r, i) =>
            blocks.push({
                id: `inv-${i}`, h: 0, table: "inv", card, keepWithNext: i === rows.length - 1,
                node: (
                    <table className="qd-table">
                        {cols}
                        <tbody>
                            <tr className={i % 2 ? "alt" : ""}>
                                <td>{pad2(i + 1)}</td>
                                <td><b>{r.title}</b>{r.description && <small>{r.description}</small>}</td>
                                <td className="c">{r.qty}</td>
                                <td className="r">{fmtMoney(r.price, cur)}{r.billing && <small>{r.billing.replace(" / ", "per ")}</small>}</td>
                                <td className="r"><b>{fmtMoney(r.price * r.qty, cur)}</b>{r.billing && <small>{r.billing.replace(" / ", "per ")}</small>}</td>
                            </tr>
                        </tbody>
                    </table>
                ),
            }),
        );
        blocks.push({
            id: "inv-totals",
            h: 0,
            node: (
                <div style={{ paddingTop: 12 }}>
                    <div className="qd-totals">
                        <div><span>Subtotal</span><span>{fmtMoney(calc.totals.subtotal + calc.totals.discountAmount, cur)}</span></div>
                        {calc.totals.discountAmount > 0 && <div><span>Discount</span><span>− {fmtMoney(calc.totals.discountAmount, cur)}</span></div>}
                        {calc.totals.taxAmount > 0 && <div><span>VAT / Tax ({taxRate}%)</span><span>{fmtMoney(calc.totals.taxAmount, cur)}</span></div>}
                        <div className="qd-grand"><span>Total Investment</span><span>{fmtMoney(calc.totals.grandTotal, cur)}</span></div>
                    </div>
                    {calc.recurringCharges.length > 0 && (
                        <div className="qd-note">
                            <IconInfoCircle size={18} color="#5b21b6" style={{ flex: "none" }} />
                            <span><b>Recurring charges, billed separately:</b> {calc.recurringCharges.map((r) => `${r.title} — ${fmtMoney(r.price * (r.quantity ?? 1), cur)}${cycleLabel(r.billingCycle)}`).join("; ")}</span>
                        </div>
                    )}
                </div>
            ),
        });
    }

    // ── payment schedule ──
    const ms = d.paymentMilestones ?? [];
    if (ms.length) {
        blocks.push(chapter(next(), IconCalendarDollar, "Payment Schedule", "When each payment is due and how much it is."));
        blocks.push({
            id: "pay-split",
            h: 0,
            node: (
                <div className="qd-split" style={{ marginBottom: 12 }}>
                    {ms.map((m, i) => (
                        <span key={i} style={{ flexGrow: Math.max(m.percentage, 1), flexBasis: 0, background: SPLIT_SHADES[i % SPLIT_SHADES.length] }}>
                            {m.percentage >= 20 ? `${m.label} · ${m.percentage}%` : `${m.percentage}%`}
                        </span>
                    ))}
                </div>
            ),
        });
        const card = { id: "pay", tone: "plain" as Tone };
        const cols = (
            <colgroup>
                <col style={{ width: 36 }} />
                <col />
                <col style={{ width: 84 }} />
                <col style={{ width: 130 }} />
            </colgroup>
        );
        blocks.push({
            id: "pay-head", h: 0, table: "pay", head: true, keepWithNext: true, card,
            node: <table className="qd-table">{cols}<thead><tr><th>#</th><th>Milestone</th><th className="c">Share</th><th className="r">Amount</th></tr></thead></table>,
        });
        ms.forEach((m, i) =>
            blocks.push({
                id: `pay-${i}`, h: 0, table: "pay", card,
                node: (
                    <table className="qd-table">
                        {cols}
                        <tbody>
                            <tr className={i % 2 ? "alt" : ""}>
                                <td>{pad2(i + 1)}</td>
                                <td><b>{m.label}</b>{m.note && <small>{m.note}</small>}</td>
                                <td className="c"><span className="qd-pill">{m.percentage}%</span></td>
                                <td className="r"><b>{fmtMoney((calc.totals.grandTotal * m.percentage) / 100, cur)}</b></td>
                            </tr>
                        </tbody>
                    </table>
                ),
            }),
        );
        blocks.push(gap("pay"));
    }

    // ── what is included / what we need / not included / terms ──
    const bullet = (t: string) => <div className="qd-bul"><span className="m" /><span>{t}</span></div>;
    const included = d.includedSupport ?? [];
    if (included.length) {
        blocks.push(chapter(next(), IconShieldCheck, "Support & Inclusions", "What is covered in your package beyond the build itself."));
        blocks.push(...cardBlocks("inc", "brand", IconShieldCheck, "Included in your package", "Covered by this quotation at no extra charge", included.map(bullet)));
    }
    const needs = d.clientRequirements ?? [];
    if (needs.length) {
        blocks.push(chapter(next(), IconUserCheck, "What We Need From You", "Items from your side that keep the project on schedule."));
        blocks.push(...cardBlocks("need", "amber", IconUserCheck, "Client responsibilities", "Please provide these as the project progresses", needs.map(bullet)));
    }
    const excluded = d.notIncluded ?? [];
    if (excluded.length) {
        blocks.push(chapter(next(), IconCircleX, "Not Included", "Outside the scope of this quotation."));
        blocks.push(
            ...cardBlocks("exc", "rose", IconCircleX, "Not included in this quotation", "Can be quoted separately if you need them", excluded.map((t, i) => (
                <div key={i} className="qd-bul"><span className="x"><IconX size={12} stroke={2.6} /></span><span>{t}</span></div>
            ))),
        );
    }
    const terms = d.keyTerms ?? [];
    if (terms.length) {
        blocks.push(chapter(next(), IconGavel, "Terms & Conditions", "The terms that govern this quotation."));
        blocks.push(...cardBlocks("terms", "slate", IconGavel, "Key terms & conditions", "By accepting this quotation you agree to the following", terms.map((t, i) => <div key={i} className="qd-clause"><b>{pad2(i + 1)}</b><span>{t}</span></div>)));
    }

    // ── next steps, signature, closing ──
    const advance = ms[0]?.percentage ? `${ms[0].percentage}%` : "agreed";
    blocks.push(chapter(next(), IconRoute, "Next Steps", "What happens once you approve this quotation."));
    blocks.push({
        id: "next",
        h: 0,
        keepWithNext: true,
        node: (
            <div className="qd-next">
                <div><b>1</b>Confirm quotation</div>
                <div><b>2</b>Complete {advance} initial payment</div>
                <div><b>3</b>Project begins</div>
            </div>
        ),
    });
    blocks.push({
        id: "auth",
        h: 0,
        keepWithNext: true,
        node: (
            <div className="qd-auth" style={{ paddingTop: 14 }}>
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
