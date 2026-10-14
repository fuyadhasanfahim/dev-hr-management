"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconLoader2 } from "@tabler/icons-react";

import { pagesToPdf } from "./export-pdf";
import { QuotationDocument } from "./QuotationDocument";
import type { QuotationDocInput } from "./types";

interface Job {
    data: QuotationDocInput;
    resolve: (b: Blob) => void;
    reject: (e: Error) => void;
}

function Stage({ job, onSettled }: { job: Job; onSettled: () => void }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const started = useRef(false);

    // Called when the pages are laid out: capture exactly once.
    const onLayout = useCallback(() => {
        if (started.current || !rootRef.current) return;
        started.current = true;
        pagesToPdf(rootRef.current, `Quotation ${job.data.quotationNumber ?? ""}`.trim())
            .then(job.resolve, (e) => job.reject(e instanceof Error ? e : new Error(String(e))))
            .finally(onSettled);
    }, [job, onSettled]);

    return (
        <>
            {/* the document sits at 100% under an opaque overlay, so the user only sees the spinner */}
            <div ref={rootRef} style={{ position: "absolute", left: 0, top: 0, zIndex: 150, width: 794, background: "#fff" }}>
                <QuotationDocument data={job.data} onLayout={onLayout} />
            </div>
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <IconLoader2 className="size-5 animate-spin" /> Preparing PDF…
                </div>
            </div>
        </>
    );
}

/**
 * Renders the quotation HTML off-screen and turns it into a PDF Blob (no headless browser).
 * Render `stage` somewhere in the component, call `generate(data)` to get the Blob.
 */
export function useQuotationPdf() {
    const [job, setJob] = useState<Job | null>(null);
    const generate = useCallback(
        (data: QuotationDocInput) => new Promise<Blob>((resolve, reject) => setJob({ data, resolve, reject })),
        [],
    );
    const clear = useCallback(() => setJob(null), []);
    const stage = job && typeof document !== "undefined" ? createPortal(<Stage key={job.data.quotationNumber} job={job} onSettled={clear} />, document.body) : null;
    return { generate, stage, busy: !!job };
}

/** Saves a Blob through a temporary link. */
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
