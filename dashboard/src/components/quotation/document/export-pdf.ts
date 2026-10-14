export type ExportPhase = "preparing" | "rendering" | "finalizing";
export interface ExportProgress {
    phase: ExportPhase;
    /** Only set while rendering: the page being captured (measured, not estimated). */
    page?: number;
    total?: number;
}

/** Thrown when an export is dismissed or its owner unmounts. Not an error to show the user. */
export class PdfCancelled extends Error {
    constructor() {
        super("PDF export cancelled");
        this.name = "PdfCancelled";
    }
}
export const isPdfCancelled = (e: unknown) => e instanceof PdfCancelled;

/** Resolves after the next paint. rAF never fires in a background tab, so a short timer keeps the export from hanging there. */
const nextFrame = () =>
    new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 100);
        requestAnimationFrame(() => {
            clearTimeout(t);
            resolve();
        });
    });

/** Fonts and every image decoded, then two frames so React has committed the final layout. */
export async function waitForReady(root: HTMLElement) {
    await document.fonts?.ready;
    await Promise.all(Array.from(root.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
    await nextFrame();
    await nextFrame();
}

const PX_TO_MM = 210 / 794;

/** jsPDF's built-in fonts only cover Latin-1; anything else would be written as garbage. */
const latin = (s: string) =>
    s
        .replace(/৳/g, "BDT ")
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—−]/g, "-")
        .replace(/…/g, "...")
        .replace(/[^\x20-\x7E -ÿ]/g, "?");

/**
 * Invisible text over the page image, positioned from the real DOM: the PDF becomes searchable and
 * copyable while looking exactly like the rendered page. (The visible glyphs come from the image.)
 */
function addTextLayer(pdf: import("jspdf").jsPDF, page: HTMLElement) {
    const pageRect = page.getBoundingClientRect();
    const range = document.createRange();
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.textContent?.trim() && !n.parentElement?.closest(".qd-watermark") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        const words: { t: string; r: DOMRect }[] = [];
        for (const m of text.matchAll(/\S+/g)) {
            range.setStart(node, m.index ?? 0);
            range.setEnd(node, (m.index ?? 0) + m[0].length);
            const r = range.getClientRects()[0];
            if (r && r.width > 0) words.push({ t: m[0], r });
        }
        // words that sit on the same visual line become one text run
        const lines: { t: string; r: DOMRect }[][] = [];
        for (const w of words) {
            const last = lines[lines.length - 1];
            const prev = last?.[last.length - 1];
            if (last && prev && Math.abs(w.r.top - prev.r.top) < 3 && w.r.left >= prev.r.left) last.push(w);
            else lines.push([w]);
        }
        // one run per word, each stretched to the word's real width, so gaps between words stay real gaps
        for (const ln of lines) {
            ln.forEach((w, j) => {
                const nextLeft = ln[j + 1]?.r.left ?? w.r.right;
                const str = latin(j < ln.length - 1 ? `${w.t} ` : w.t);
                pdf.setFontSize(Math.max(4, w.r.height * 0.72));
                // fit the word's width; but for letter-spaced labels the gap is typographic, not a word gap — leave the
                // characters together so the text still copies as one word
                const cs = ((nextLeft - w.r.left) * PX_TO_MM - pdf.getTextWidth(str)) / Math.max(1, str.length);
                pdf.setCharSpace(cs > 0.45 ? 0 : cs);
                pdf.text(str, (w.r.left - pageRect.left) * PX_TO_MM, (w.r.top - pageRect.top) * PX_TO_MM, { baseline: "top", renderingMode: "invisible" });
            });
        }
    }
    pdf.setCharSpace(0);
}

/**
 * All same-origin CSS currently applied to the document, as one string. `url()` references are made
 * absolute against their own stylesheet, because once inlined they would resolve against the page
 * instead (that is how the web fonts would 404 and silently fall back to a system font).
 */
function collectCss(): string {
    let out = "";
    for (const sheet of Array.from(document.styleSheets)) {
        const base = sheet.href ?? document.baseURI;
        try {
            for (const rule of Array.from(sheet.cssRules)) {
                out += `${rule.cssText.replace(/url\((['"]?)(?!data:|https?:|\/\/|#)([^'")]+)\1\)/g, (_m, q: string, u: string) => `url(${q}${new URL(u, base).href}${q})`)}\n`;
            }
        } catch {
            // a cross-origin stylesheet cannot be read; the document's own styles are all same-origin
        }
    }
    return out;
}

interface Options {
    title?: string;
    onProgress?: (p: ExportProgress) => void;
    /** Anything with an `aborted` flag (e.g. an AbortSignal) — checked between pages. */
    signal?: { aborted: boolean };
}

/** Captures every `.qd-page` under `root` into an A4 PDF: one image per page plus an invisible text layer. */
export async function pagesToPdf(root: HTMLElement, { title = "Quotation", onProgress, signal }: Options = {}): Promise<Blob> {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const abort = () => {
        if (signal?.aborted) throw new PdfCancelled();
    };

    const pages = Array.from(root.querySelectorAll<HTMLElement>(".qd-page:not(.qd-skeleton)"));
    if (!pages.length) throw new Error("The document has no pages to export");

    const css = collectCss();
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    pdf.setProperties({ title });
    for (let i = 0; i < pages.length; i++) {
        abort();
        onProgress?.({ phase: "rendering", page: i + 1, total: pages.length });
        await nextFrame(); // let the label paint before the heavy synchronous capture
        const canvas = await html2canvas(pages[i]!, {
            scale: 2,
            backgroundColor: "#fffefc",
            useCORS: true,
            logging: false,
            onclone: async (doc) => {
                // html2canvas renders a cloned document in an iframe. Linked stylesheets there can still be
                // loading when it paints, which produced unstyled pages at random. Inline them so nothing races.
                doc.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => n.remove());
                const style = doc.createElement("style");
                style.textContent = css;
                doc.head.appendChild(style);
                // the export host is parked off-screen; measure its clone at the origin
                const host = doc.querySelector<HTMLElement>("[data-qd-export]");
                if (host) Object.assign(host.style, { position: "absolute", left: "0", top: "0" });
                await doc.fonts?.ready;
            },
        });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297, undefined, "FAST");
        addTextLayer(pdf, pages[i]!);
    }
    abort();
    onProgress?.({ phase: "finalizing" });
    await nextFrame();
    return pdf.output("blob");
}
