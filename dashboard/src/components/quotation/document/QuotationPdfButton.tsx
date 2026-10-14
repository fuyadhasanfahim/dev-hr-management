"use client";

import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { QuotationDocInput } from "./types";
import { isPdfCancelled, saveBlob, useQuotationPdf } from "./use-quotation-pdf";

/** `#QTN-…` when a quotation number exists, else the title. */
export const pdfFileStem = (number?: string | null, title?: string | null) => {
    const n = String(number ?? "").trim();
    return n ? (n.startsWith("#") ? n : `#${n}`) : String(title ?? "").trim() || "quotation";
};

/** Downloads the quotation as a PDF built in the browser from the same HTML the preview shows. */
export function QuotationPdfButton({ data }: { data: QuotationDocInput }) {
    const { generate, stage, busy } = useQuotationPdf();
    const download = async () => {
        try {
            saveBlob(await generate(data), `${pdfFileStem(data.quotationNumber, data.details?.title)}.pdf`);
        } catch (err) {
            if (!isPdfCancelled(err)) toast.error((err as Error).message || "Could not create the PDF");
        }
    };
    return (
        <>
            <Button type="button" className="bg-teal-600 text-white hover:bg-teal-700" disabled={busy} onClick={download}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
                {busy ? "Generating…" : "Download PDF"}
            </Button>
            {stage}
        </>
    );
}
