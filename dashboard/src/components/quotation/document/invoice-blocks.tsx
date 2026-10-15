import type { ReactNode } from "react";

import { LOGO_SRC, SIGNATORY_NAME, SIGNATORY_ROLE, SIGNATURE_SRC } from "./brand";
import { currencySymbol, fmtDate } from "./format";
import type { Block } from "./blocks";
import type { QuotationDocInput } from "./types";

/** Unit prices can be fractional (e.g. $0.50 per image), so invoices keep two decimals where needed. */
const money = (n: number, c?: string) => {
    const v = Number.isFinite(n) ? n : 0;
    return `${currencySymbol(c)} ${v.toLocaleString("en-US", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`.trim();
};

const COLS = (
    <colgroup>
        <col style={{ width: 92 }} />
        <col />
        <col style={{ width: 70 }} />
        <col style={{ width: 98 }} />
        <col style={{ width: 106 }} />
    </colgroup>
);

const line = (label: string, v?: string): ReactNode => (v ? <div className="qd-line"><em>{label}</em><span>{v}</span></div> : null);

/**
 * The photo-editing invoice, in the quotation's own look: masthead, From / To, an itemised table
 * (date, images, per-image price, total), the amount due, a Pay now link, and the authorised signature.
 */
export function buildInvoiceBlocks(d: QuotationDocInput): Block[] {
    const inv = d.invoice!;
    const cur = d.currency;
    const to = d.client;
    const blocks: Block[] = [];

    blocks.push({
        id: "inv-head",
        h: 0,
        node: (
            <div className="qd-cover">
                <div className="qd-mast">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LOGO_SRC} alt={d.company.name} width={158} height={38} />
                    <div className="qd-mast-r"><span>Invoice</span><b># {d.quotationNumber}</b></div>
                </div>
                <div className="qd-cover-title" style={{ padding: "16px 0 10px" }}>
                    <p className="qd-kicker">Photo editing services</p>
                    <h1>{inv.periodLabel}</h1>
                </div>
                <div className="qd-cover-grid">
                    <dl>
                        <div><dt>Invoice no.</dt><dd>{d.quotationNumber}</dd></div>
                        <div><dt>Issued</dt><dd>{fmtDate(inv.issueDate)}</dd></div>
                        <div><dt>Due</dt><dd>{fmtDate(inv.dueDate)}</dd></div>
                    </dl>
                    <div className="qd-cover-total">
                        <span>{inv.paid ? "Paid" : "Amount due"}</span>
                        <b>{money(inv.totalAmount, cur)}</b>
                        <small>{inv.totalImages.toLocaleString("en-US")} images · {inv.items.length} order{inv.items.length === 1 ? "" : "s"}</small>
                    </div>
                </div>
            </div>
        ),
    });

    blocks.push({
        id: "inv-parties",
        h: 0,
        node: (
            <div className="qd-parties" style={{ paddingTop: 10 }}>
                <div className="qd-party">
                    <span className="qd-tag">From</span>
                    <div className="qd-name">{d.company.name}</div>
                    {line("Address", d.company.address)}
                    {line("Email", d.company.email)}
                    {line("Phone", d.company.phone)}
                    {line("Web", d.company.website)}
                </div>
                <div className="qd-party">
                    <span className="qd-tag">To</span>
                    <div className="qd-name">{to.companyName || to.contactName}</div>
                    {to.companyName ? line("Contact", to.contactName) : null}
                    {line("Address", to.address)}
                    {line("Email", to.email)}
                    {line("Phone", to.phone)}
                </div>
            </div>
        ),
    });

    // Rows are separate blocks so a long invoice continues on the next page with its header repeated.
    blocks.push({
        id: "inv-th",
        h: 0,
        table: "inv",
        head: true,
        keepWithNext: true,
        node: (
            <table className="qd-table" style={{ marginTop: 14 }}>
                {COLS}
                <thead><tr><th>Date</th><th>Order</th><th className="r">Images</th><th className="r">Per image</th><th className="r">Total</th></tr></thead>
            </table>
        ),
    });
    inv.items.forEach((it, i) =>
        blocks.push({
            id: `inv-r-${i}`,
            h: 0,
            table: "inv",
            keepWithNext: i === inv.items.length - 1,
            node: (
                <table className="qd-table">
                    {COLS}
                    <tbody>
                        <tr>
                            <td className="m">{fmtDate(it.date)}</td>
                            <td><b>{it.orderName}</b></td>
                            <td className="r">{it.images.toLocaleString("en-US")}</td>
                            <td className="r">{money(it.unitPrice, cur)}</td>
                            <td className="r"><b>{money(it.amount, cur)}</b></td>
                        </tr>
                    </tbody>
                </table>
            ),
        }),
    );

    blocks.push({
        id: "inv-sum",
        h: 0,
        node: (
            <div className="qd-sum">
                <div className="qd-grand"><span>{inv.paid ? "Total paid" : "Total amount"}</span><b>{money(inv.totalAmount, cur)}</b></div>
            </div>
        ),
    });

    // Payment and signature share one row so a short invoice still fits on a single page.
    blocks.push({
        id: "inv-foot",
        h: 0,
        node: (
            <div className="qd-foot">
                <div>
                    <div className="qd-auth-label" style={{ marginBottom: 6 }}>Payment</div>
                    <p className="qd-p" style={{ padding: "0 0 12px" }}>
                        {inv.paid ? "This invoice has been paid. Thank you." : `Please pay by ${fmtDate(inv.dueDate)}. Secure online payment by card or PayPal.`}
                    </p>
                    {!inv.paid && inv.paymentUrl && <a className="qd-pay" href={inv.paymentUrl}>Pay now</a>}
                </div>
                <div className="qd-auth" style={{ paddingTop: 0 }}>
                    <div className="qd-auth-label">Authorized by</div>
                    {SIGNATURE_SRC ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="qd-auth-sig" style={{ height: 46 }} src={SIGNATURE_SRC} alt="" crossOrigin="anonymous" />
                    ) : (
                        <div className="qd-auth-spacer" />
                    )}
                    <div className="qd-auth-line" />
                    <div className="qd-auth-name">{SIGNATORY_NAME}</div>
                    <div className="qd-auth-role">{SIGNATORY_ROLE}, {d.company.name}</div>
                </div>
            </div>
        ),
    });

    return blocks;
}
