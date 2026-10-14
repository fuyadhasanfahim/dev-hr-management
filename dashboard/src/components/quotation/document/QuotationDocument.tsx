"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Hind_Siliguri, Plus_Jakarta_Sans } from "next/font/google";

import { buildBlocks, type Block } from "./blocks";
import { LOGO_SRC, MARK_SRC } from "./brand";
import { paginate } from "./paginate";
import type { QuotationDocInput } from "./types";
import "./quotation-document.css";

export { LOGO_SRC, MARK_SRC };

// One family for the whole document: Plus Jakarta Sans (headings and body, different weights), with Hind Siliguri
// for Bengali text. Both are OFL and bundled by next/font, so they load from our own origin and are ready before export.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--qd-font-sans", display: "swap" });
const bengali = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--qd-font-bn", display: "swap" });

// A4 at 96dpi. Must match quotation-document.css.
const PAGE_H = 1123;
const CONTENT_W = 794 - 112;
const CONTENT_BOTTOM = PAGE_H - 76; // above the footer
const cap = (page: number) => CONTENT_BOTTOM - (page === 0 ? 52 : 90);

const Wrap = ({ b }: { b: Block }) => <div className="qd-blk">{b.node}</div>;

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
    // Pages are stored together with the exact blocks they were measured for. Rendering from this
    // snapshot (not from `blocks`) means a data change can never index into a different block list;
    // the previous layout simply stays on screen until the new one has been measured.
    const [layout, setLayout] = useState<{ blocks: Block[]; pages: number[][] } | null>(null);

    useLayoutEffect(() => {
        let cancelled = false;
        const measure = () => {
            const root = measureRef.current;
            if (!root || cancelled) return;
            const heights = Array.from(root.children).map((c) => Math.ceil(c.getBoundingClientRect().height));
            setLayout({ blocks, pages: paginate(blocks.map((b, i) => ({ h: heights[i] ?? 0, keepWithNext: b.keepWithNext, table: b.table, head: b.head })), cap) });
        };
        measure();
        // fonts / images can change heights after the first paint
        void document.fonts?.ready.then(measure);
        const imgs = Array.from(measureRef.current?.querySelectorAll("img") ?? []);
        imgs.forEach((img) => !img.complete && img.addEventListener("load", measure, { once: true }));
        return () => {
            cancelled = true;
        };
    }, [blocks]);

    const pages = layout?.pages ?? [];
    const shown = layout?.blocks ?? blocks;
    const total = pages.length;
    useEffect(() => {
        if (total) onLayout?.(total);
    }, [total, onLayout, key]);

    return (
        <div className={`qdoc ${sans.variable} ${bengali.variable}`}>
            <div ref={measureRef} className="qd-measure" style={{ width: CONTENT_W }} aria-hidden>
                {blocks.map((b) => <Wrap key={b.id} b={b} />)}
            </div>
            <div className="qd-pages" style={zoom !== 1 ? { zoom } : undefined}>
                {/* reserve one page of space until pagination is done, so the preview never jumps */}
                {total === 0 && <section className="qd-page qd-skeleton" aria-busy />}
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
                                <span>Quotation <b># {data.quotationNumber || "Assigned on save"}</b></span>
                            </div>
                        )}
                        <div className="qd-content">
                            {idx.map((bi, k) => <Wrap key={`${bi}-${k}`} b={shown[bi]!} />)}
                        </div>
                        <div className="qd-footer">
                            <span>{data.company.name} | {data.details.title} | Confidential | Page {p + 1}</span>
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
