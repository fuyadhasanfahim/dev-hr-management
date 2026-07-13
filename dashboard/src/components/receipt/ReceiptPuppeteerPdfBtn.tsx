"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { downloadReceiptPdf, receiptPdfFileStem } from "@/lib/download-receipt-pdf";

export { receiptPdfFileStem };

interface Props {
  receiptId: string;
  fileNameBase: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  /** Renders just the icon (no label) — for compact table row actions. */
  iconOnly?: boolean;
}

/** Mirrors QuotationPuppeteerPdfBtn — same fetch/blob-download mechanics, receipt endpoint. */
export default function ReceiptPuppeteerPdfBtn({
  receiptId,
  fileNameBase,
  className,
  variant,
  iconOnly = false,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadReceiptPdf(receiptId, fileNameBase);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={loading}
      onClick={handleDownload}
      title={iconOnly ? (loading ? "Generating…" : "Download PDF") : undefined}
    >
      {iconOnly ? (
        loading ? (
          <Download className="h-4 w-4 animate-bounce" aria-hidden />
        ) : (
          <FileText className="h-4 w-4" aria-hidden />
        )
      ) : loading ? (
        <span className="flex items-center gap-2">
          <Download className="h-4 w-4 animate-bounce" aria-hidden />
          Generating…
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" aria-hidden />
          Download PDF
        </span>
      )}
    </Button>
  );
}
