"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconAlertCircle, IconLoader2 } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { PdfCancelled, isPdfCancelled, pagesToPdf, waitForReady, type ExportProgress } from "./export-pdf";
import { QuotationDocument } from "./QuotationDocument";
import type { QuotationDocInput } from "./types";

export { isPdfCancelled };

interface JobState {
    data: QuotationDocInput;
    /** Bumped by Retry so the off-screen document is rebuilt from scratch. */
    attempt: number;
    error?: string;
}
interface Settle {
    resolve: (b: Blob) => void;
    reject: (e: Error) => void;
}

const label = (p: ExportProgress) =>
    p.phase === "rendering" ? `Rendering page ${p.page} of ${p.total}…` : p.phase === "finalizing" ? "Finalizing your PDF…" : "Preparing your quotation…";

/** Off-screen copy of the document at 100%; captures it once it is laid out and its fonts/images are ready. */
function Host({ data, onProgress, onDone, onError }: { data: QuotationDocInput; onProgress: (p: ExportProgress) => void; onDone: (b: Blob) => void; onError: (e: unknown) => void }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const started = useRef(false);
    // "Still mounted" flag instead of an AbortController: React StrictMode runs effect cleanups once
    // during development, which would permanently abort a controller created at first render.
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false; // unmount (dismiss / retry / owner gone) cancels the capture
        };
    }, []);
    const signal = useRef({
        get aborted() {
            return !alive.current;
        },
    }).current;

    const onLayout = useCallback(() => {
        const root = rootRef.current;
        if (started.current || !root) return;
        started.current = true;
        (async () => {
            await waitForReady(root);
            onDone(await pagesToPdf(root, { title: `Quotation ${data.quotationNumber ?? ""}`.trim(), onProgress, signal }));
        })().catch((e) => alive.current && onError(e));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div ref={rootRef} data-qd-export aria-hidden style={{ position: "fixed", left: -12000, top: 0, width: 794, pointerEvents: "none" }}>
            <QuotationDocument data={data} onLayout={onLayout} />
        </div>
    );
}

function Status({ progress, error, onRetry, onDismiss }: { progress: ExportProgress; error?: string; onRetry: () => void; onDismiss: () => void }) {
    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4">
            <div role="status" aria-live="polite" className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg">
                {error ? (
                    <>
                        <IconAlertCircle className="size-5 shrink-0 text-destructive" />
                        <div className="min-w-0">
                            <p className="font-medium">We couldn&apos;t create the PDF</p>
                            <p className="truncate text-xs text-muted-foreground">{error}</p>
                        </div>
                        <Button size="sm" onClick={onRetry}>Retry</Button>
                        <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
                    </>
                ) : (
                    <>
                        <IconLoader2 className="size-4 shrink-0 animate-spin text-primary" />
                        <span>{label(progress)}</span>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Builds the quotation PDF in the browser from the same HTML as the preview — no headless browser.
 * The app stays visible: a small status card shows the real stage (and page) being rendered, and a failure
 * offers Retry without losing the request. Render `stage` once; `generate(data)` resolves with the PDF Blob.
 * It rejects with PdfCancelled when dismissed (check with isPdfCancelled) and refuses a second export while one runs.
 */
export function useQuotationPdf() {
    const [job, setJob] = useState<JobState | null>(null);
    const [progress, setProgress] = useState<ExportProgress>({ phase: "preparing" });
    const settle = useRef<Settle | null>(null);

    const generate = useCallback((data: QuotationDocInput) => {
        if (settle.current) return Promise.reject(new Error("A PDF export is already running"));
        return new Promise<Blob>((resolve, reject) => {
            settle.current = { resolve, reject };
            setProgress({ phase: "preparing" });
            setJob({ data, attempt: 1 });
        });
    }, []);

    const finish = useCallback((fn: (s: Settle) => void) => {
        const s = settle.current;
        settle.current = null;
        setJob(null);
        if (s) fn(s);
    }, []);

    const onDone = useCallback((b: Blob) => finish((s) => s.resolve(b)), [finish]);
    const onError = useCallback((e: unknown) => setJob((j) => (j ? { ...j, error: e instanceof Error ? e.message : String(e) } : j)), []);
    const retry = useCallback(() => {
        setProgress({ phase: "preparing" });
        setJob((j) => (j ? { data: j.data, attempt: j.attempt + 1 } : j));
    }, []);
    const dismiss = useCallback(() => finish((s) => s.reject(new PdfCancelled())), [finish]);

    // the owner went away mid-export: stop and release the promise
    useEffect(
        () => () => {
            settle.current?.reject(new PdfCancelled());
            settle.current = null;
        },
        [],
    );

    const stage =
        job && typeof document !== "undefined"
            ? createPortal(
                  <>
                      {!job.error && <Host key={job.attempt} data={job.data} onProgress={setProgress} onDone={onDone} onError={onError} />}
                      <Status progress={progress} error={job.error} onRetry={retry} onDismiss={dismiss} />
                  </>,
                  document.body,
              )
            : null;
    return { generate, stage, busy: !!job };
}

/** Off-screen copy of the document that opens the print dialog once it is laid out. */
function PrintHost({ data, onFinished }: { data: QuotationDocInput; onFinished: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const started = useRef(false);
    const onLayout = useCallback(() => {
        if (started.current || !ref.current) return;
        started.current = true;
        void waitForReady(ref.current).then(() => {
            document.body.classList.add("qd-printing");
            window.addEventListener("afterprint", onFinished, { once: true });
            window.print();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div ref={ref} id="qd-print-root" style={{ position: "fixed", left: -12000, top: 0, width: 794 }}>
            <QuotationDocument data={data} onLayout={onLayout} />
        </div>
    );
}

/** Prints the same pages (one per A4 sheet) through the browser: vector text, "Save as PDF" from the print dialog. */
export function useQuotationPrint() {
    const [data, setData] = useState<QuotationDocInput | null>(null);
    const onFinished = useCallback(() => {
        document.body.classList.remove("qd-printing");
        setData(null);
    }, []);
    const print = useCallback((d: QuotationDocInput) => setData((cur) => cur ?? d), []);
    const host = data && typeof document !== "undefined" ? createPortal(<PrintHost data={data} onFinished={onFinished} />, document.body) : null;
    return { print, host };
}

/** Saves a Blob through a temporary link and releases the object URL. */
export function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/[/\\?%*:|"<>]/g, "-");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
}
