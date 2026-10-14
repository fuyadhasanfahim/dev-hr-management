"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    IconCalendar,
    IconCircleCheck,
    IconFileText,
    IconListCheck,
    IconMail,
    IconMapPin,
    IconPhone,
    IconReceipt,
    IconSettings,
    IconShieldCheck,
    IconUser,
    IconWorld,
    IconX,
} from "@tabler/icons-react";

import { computeQuotationTotals } from "@/lib/quotation-totals";
import type { IQuotationService } from "@/types/quotation.type";
import { fmtDate, fmtMoney } from "./format";
import { paginate, type PBlock } from "./paginate";
import type { QuotationDocInput } from "./types";
import "./quotation-document.css";

export const LOGO_SRC = "/assets/brand/logo.png";
export const MARK_SRC = "/assets/brand/wb-mark.png";

// A4 at 96dpi. Must match quotation-document.css.
const PAGE_H = 1123;
const CONTENT_W = 794 - 104;
const CONTENT_BOTTOM = PAGE_H - 70; // above the footer
const cap = (page: number) => CONTENT_BOTTOM - (page === 0 ? 48 : 88);

interface Block extends PBlock {
    id: string;
    node: ReactNode;
}

const sectionTitle = (id: string, Icon: typeof IconFileText, text: string): Block => ({
    id,
    h: 0,
    keepWithNext: true,
    node: (
        <div className="qd-sec">
            <span className="qd-sec-ic"><Icon size={14} stroke={2} /></span>
            <h3>{text}</h3>
        </div>
    ),
});

const checkRow = (id: string, text: string): Block => ({
    id,
    h: 0,
    node: (
        <div className="qd-li">
            <IconCircleCheck size={14} fill="#5b21b6" color="#fff" stroke={2} />
            <span>{text}</span>
        </div>
    ),
});

const numRow = (id: string, n: number, text: string): Block => ({
    id,
    h: 0,
    node: (
        <div className="qd-li">
            <span className="qd-num">{n}</span>
            <span>{text}</span>
        </div>
    ),
});

/** A titled list: heading + one block per row, so long lists break cleanly across pages. */
function listSection(key: string, Icon: typeof IconFileText, title: string, rows: ReactNode[] | string[], kind: "check" | "num" | "cols"): Block[] {
    const items = rows as string[];
    if (!items.length) return [];
    const out: Block[] = [sectionTitle(`${key}-t`, Icon, title)];
    if (kind === "cols") {
        for (let i = 0; i < items.length; i += 2) {
            out.push({
                id: `${key}-${i}`,
                h: 0,
                node: (
                    <div className="qd-cols">
                        {[items[i], items[i + 1]].map((t, j) =>
                            t ? (
                                <div key={j} className="qd-li">
                                    <IconCircleCheck size={14} fill="#5b21b6" color="#fff" stroke={2} />
                                    <span>{t}</span>
                                </div>
                            ) : (
                                <div key={j} />
                            ),
                        )}
                    </div>
                ),
            });
        }
    } else {
        items.forEach((t, i) => out.push(kind === "num" ? numRow(`${key}-${i}`, i + 1, t) : checkRow(`${key}-${i}`, t)));
    }
    return out;
}

const cycleLabel = (c?: string) => (c === "monthly" ? " / month" : c === "yearly" ? " / year" : "");

function buildBlocks(d: QuotationDocInput): Block[] {
    const cur = d.currency;
    const calc = computeQuotationTotals(d.services as IQuotationService[]);
    const taxRate = d.services.find((s) => s.taxRate)?.taxRate ?? 0;
    const blocks: Block[] = [];

    // ── header ──
    blocks.push({
        id: "head",
        h: 0,
        node: (
            <div className="qd-head">
                <div className="qd-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LOGO_SRC} alt={d.company.name} width={192} height={46} />
                    <p>Design | Development | Growth</p>
                </div>
                <div className="qd-doc-title">
                    <span className="qd-conf">CONFIDENTIAL</span>
                    <h1>Quotation</h1>
                    <div className="qd-no"># {d.quotationNumber || "Assigned on save"}</div>
                    <div className="qd-dates">
                        <div>Date: {fmtDate(d.details.date)}</div>
                        <div>Valid Until: {fmtDate(d.details.validUntil)}</div>
                    </div>
                </div>
            </div>
        ),
    });

    // ── prepared for / by ──
    const line = (Icon: typeof IconUser, v?: string) =>
        v ? (
            <div className="qd-line">
                <Icon size={13} stroke={2} />
                <span>{v}</span>
            </div>
        ) : null;
    blocks.push({
        id: "parties",
        h: 0,
        node: (
            <div className="qd-parties">
                <div className="qd-party">
                    <h4>Prepared For</h4>
                    <div className="qd-name">{d.client.companyName || d.client.contactName}</div>
                    {line(IconMapPin, d.client.address)}
                    {line(IconUser, d.client.contactName)}
                    {line(IconMail, d.client.email)}
                    {line(IconPhone, d.client.phone)}
                </div>
                <div className="qd-party">
                    <h4>Prepared By</h4>
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
    const paragraphs = (d.overview ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    blocks.push(sectionTitle("ov-t", IconFileText, "Project Overview"));
    blocks.push({ id: "ov-title", h: 0, keepWithNext: paragraphs.length > 0, node: <p className="qd-strong">{d.details.title}</p> });
    paragraphs.forEach((p, i) => blocks.push({ id: `ov-${i}`, h: 0, node: <p className="qd-p" style={{ paddingBottom: 4 }}>{p}</p> }));

    // ── scope & key deliverables (per service) ──
    d.services.forEach((s, si) => {
        const items = (s.scopeItems ?? []).filter(Boolean);
        if (!items.length && !s.scopeDescription) return;
        blocks.push(sectionTitle(`sc${si}-t`, IconSettings, d.services.length > 1 ? `Scope of Work — ${s.category.replace("-", " ")}` : "Scope of Work & Key Deliverables"));
        if (s.scopeDescription) blocks.push({ id: `sc${si}-d`, h: 0, node: <p className="qd-p">{s.scopeDescription}</p> });
        for (let i = 0; i < items.length; i += 2) {
            blocks.push({
                id: `sc${si}-${i}`,
                h: 0,
                node: (
                    <div className="qd-cols">
                        {[items[i], items[i + 1]].map((t, j) =>
                            t ? (
                                <div key={j} className="qd-li">
                                    <IconCircleCheck size={14} fill="#5b21b6" color="#fff" stroke={2} />
                                    <span>{t}</span>
                                </div>
                            ) : (
                                <div key={j} />
                            ),
                        )}
                    </div>
                ),
            });
        }
    });

    // ── deliverables & timeline (stored as one `workflow` list; deliverables are prefixed) ──
    const wf = d.workflow ?? [];
    const deliverables = wf.filter((w) => w.startsWith("Deliverable: ")).map((w) => w.slice("Deliverable: ".length));
    const timeline = wf.filter((w) => !w.startsWith("Deliverable: "));
    blocks.push(...listSection("dl", IconListCheck, "Deliverables", deliverables, "cols"));
    blocks.push(...listSection("tl", IconCalendar, "Milestones & Timeline", timeline, "num"));

    // ── investment ──
    const rows = d.services.flatMap((s) => [
        ...(s.basePrice ? [{ title: "Base price", description: "", qty: 1, price: s.basePrice, billing: "" }] : []),
        ...s.lineItems.map((l) => ({ title: l.title, description: l.description ?? "", qty: l.quantity ?? 1, price: l.price, billing: cycleLabel(l.billingCycle) })),
    ]);
    if (rows.length) {
        blocks.push(sectionTitle("inv-t", IconReceipt, "Investment Summary"));
        const cols = (
            <colgroup>
                <col style={{ width: 28 }} />
                <col />
                <col style={{ width: 52 }} />
                <col style={{ width: 112 }} />
                <col style={{ width: 112 }} />
            </colgroup>
        );
        blocks.push({
            id: "inv-head",
            table: "inv",
            head: true,
            keepWithNext: true,
            h: 0,
            node: (
                <table className="qd-table">
                    {cols}
                    <thead>
                        <tr><th>#</th><th>Item Description</th><th className="c">Qty</th><th className="r">Unit Price</th><th className="r">Total</th></tr>
                    </thead>
                </table>
            ),
        });
        rows.forEach((r, i) =>
            blocks.push({
                id: `inv-${i}`,
                table: "inv",
                keepWithNext: i === rows.length - 1,
                h: 0,
                node: (
                    <table className="qd-table">
                        {cols}
                        <tbody>
                            <tr>
                                <td>{i + 1}</td>
                                <td>{r.title}{r.description && <small>{r.description}</small>}</td>
                                <td className="c">{r.qty}</td>
                                <td className="r">{fmtMoney(r.price, cur)}{r.billing}</td>
                                <td className="r">{fmtMoney(r.price * r.qty, cur)}{r.billing}</td>
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
                <div style={{ paddingTop: 8 }}>
                    <div className="qd-totals">
                        <div><span>Subtotal</span><span>{fmtMoney(calc.totals.subtotal + calc.totals.discountAmount, cur)}</span></div>
                        {calc.totals.discountAmount > 0 && <div><span>Discount</span><span>− {fmtMoney(calc.totals.discountAmount, cur)}</span></div>}
                        {calc.totals.taxAmount > 0 && <div><span>VAT / Tax ({taxRate}%)</span><span>{fmtMoney(calc.totals.taxAmount, cur)}</span></div>}
                        <div className="qd-grand"><span>Total Investment ({cur})</span><span>{fmtMoney(calc.totals.grandTotal, cur)}</span></div>
                    </div>
                    {calc.recurringCharges.length > 0 && (
                        <p className="qd-note">
                            Recurring (billed separately):{" "}
                            {calc.recurringCharges.map((r) => `${r.title} — ${fmtMoney(r.price * (r.quantity ?? 1), cur)}${cycleLabel(r.billingCycle)}`).join("; ")}
                        </p>
                    )}
                </div>
            ),
        });
    }

    // ── payment schedule ──
    const ms = d.paymentMilestones ?? [];
    if (ms.length) {
        blocks.push(sectionTitle("pay-t", IconReceipt, "Payment Schedule"));
        const cols = (
            <colgroup>
                <col style={{ width: 28 }} />
                <col />
                <col style={{ width: 70 }} />
                <col style={{ width: 120 }} />
            </colgroup>
        );
        blocks.push({
            id: "pay-head",
            table: "pay",
            head: true,
            keepWithNext: true,
            h: 0,
            node: (
                <table className="qd-table">
                    {cols}
                    <thead><tr><th>#</th><th>Milestone</th><th className="c">Payment</th><th className="r">Amount</th></tr></thead>
                </table>
            ),
        });
        ms.forEach((m, i) =>
            blocks.push({
                id: `pay-${i}`,
                table: "pay",
                h: 0,
                node: (
                    <table className="qd-table">
                        {cols}
                        <tbody>
                            <tr>
                                <td>{i + 1}</td>
                                <td>{m.label}{m.note && <small>{m.note}</small>}</td>
                                <td className="c">{m.percentage}%</td>
                                <td className="r">{fmtMoney((calc.totals.grandTotal * m.percentage) / 100, cur)}</td>
                            </tr>
                        </tbody>
                    </table>
                ),
            }),
        );
    }

    // ── terms & lists ──
    blocks.push(...listSection("sup", IconShieldCheck, "Included Support", d.includedSupport ?? [], "check"));
    blocks.push(...listSection("req", IconUser, "Client Responsibilities", d.clientRequirements ?? [], "check"));
    blocks.push(...listSection("exc", IconX, "Not Included", d.notIncluded ?? [], "check"));
    blocks.push(...listSection("terms", IconFileText, "Key Terms & Conditions", d.keyTerms ?? [], "num"));

    // ── acceptance ──
    blocks.push({
        id: "sign",
        h: 0,
        node: (
            <div className="qd-sign">
                <div><b>For {d.company.name}</b>Authorized signature &amp; date</div>
                <div><b>{d.client.companyName || d.client.contactName}</b>Client acceptance — signature &amp; date</div>
            </div>
        ),
    });

    return blocks.map((b) => ({ ...b, node: <div className="qd-blk">{b.node}</div> }));
}

interface Props {
    data: QuotationDocInput;
    /** 1 = 100%. Applied to the pages only; layout is always measured at 100%. */
    zoom?: number;
    /** Called once the pages are laid out (used to trigger the PDF capture). */
    onLayout?: (pageCount: number) => void;
}

/**
 * The quotation as real A4 pages (794 × 1123 px). Blocks are measured off-screen and packed onto pages,
 * so long content flows onto as many pages as it needs. The same markup feeds the on-screen preview,
 * the PDF and the email attachment.
 */
export function QuotationDocument({ data, zoom = 1, onLayout }: Props) {
    const key = JSON.stringify(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const blocks = useMemo(() => buildBlocks(data), [key]);
    const measureRef = useRef<HTMLDivElement>(null);
    const [pages, setPages] = useState<number[][]>([]);

    useLayoutEffect(() => {
        let cancelled = false;
        const measure = () => {
            const root = measureRef.current;
            if (!root || cancelled) return;
            const heights = Array.from(root.children).map((c) => Math.ceil(c.getBoundingClientRect().height));
            setPages(paginate(blocks.map((b, i) => ({ h: heights[i] ?? 0, keepWithNext: b.keepWithNext, table: b.table, head: b.head })), cap));
        };
        measure();
        // fonts / the logo can change heights after the first paint
        void document.fonts?.ready.then(measure);
        return () => {
            cancelled = true;
        };
    }, [blocks]);

    const total = pages.length;
    useEffect(() => {
        if (total) onLayout?.(total);
    }, [total, onLayout, key]);

    return (
        <div className="qdoc">
            <div ref={measureRef} className="qd-measure" style={{ width: CONTENT_W }} aria-hidden>
                {blocks.map((b) => <div key={b.id}>{b.node}</div>)}
            </div>
            <div className="qd-pages" style={zoom !== 1 ? { zoom } : undefined}>
                {pages.map((idx, p) => (
                    <section key={p} className={`qd-page${p > 0 ? " qd-cont" : ""}`} data-page={p + 1}>
                        <div className="qd-watermark">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={MARK_SRC} alt="" />
                        </div>
                        {p > 0 && (
                            <div className="qd-runhead">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={LOGO_SRC} alt="" width={92} height={22} />
                                <span>Quotation # {data.quotationNumber || "—"}</span>
                            </div>
                        )}
                        <div className="qd-content">{idx.map((bi, k) => <div key={`${bi}-${k}`}>{blocks[bi]!.node}</div>)}</div>
                        <div className="qd-footer">
                            <span>
                                <b>{data.company.name}</b> · {[data.company.address, data.company.email, data.company.phone, data.company.website].filter(Boolean).join(" · ")}
                            </span>
                            <span style={{ whiteSpace: "nowrap" }}>Page {p + 1} of {total}</span>
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
