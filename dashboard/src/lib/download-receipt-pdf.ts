"use client";

import { toast } from "sonner";
import { publicApiUrl } from "@/lib/public-api";

/** Match UI label: `#RCPT-…` when a receipt number exists (avoids double `#`). */
export function receiptPdfFileStem(
  receiptNumber?: string | null,
  titleFallback?: string | null,
): string {
  const num = String(receiptNumber ?? "").trim();
  if (num) return num.startsWith("#") ? num : `#${num}`;
  const t = String(titleFallback ?? "").trim();
  return t || "receipt";
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8'')?([^;\n]+)/i.exec(header);
  if (star?.[1]) {
    const raw = star[1].trim().replace(/^["']|["']$/g, "");
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  const quoted = /filename="((?:\\.|[^"\\])*)"/i.exec(header);
  if (quoted?.[1]) return quoted[1].replace(/\\(.)/g, "$1");
  const plain = /filename=([^;\n]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim().replace(/^["']|["']$/g, "");
  return null;
}

function sanitizeFileName(base: string): string {
  const stem = (base || "receipt").replace(/[/\\?%*:|"<>]/g, "-").trim() || "receipt";
  return stem.endsWith(".pdf") ? stem : `${stem}.pdf`;
}

/**
 * Fetches the puppeteer-rendered receipt PDF and triggers a browser download.
 * Shows its own error toast on failure — callers only need to react to the
 * boolean result if they want to chain further UI (e.g. a success toast).
 */
export async function downloadReceiptPdf(
  receiptId: string,
  fileNameBase: string,
): Promise<boolean> {
  const pdfApiUrl = publicApiUrl(`/api/receipts/${receiptId}/pdf/puppeteer`);
  if (!pdfApiUrl.startsWith("http")) {
    toast.error("NEXT_PUBLIC_APP_URL is not set (cannot reach API)");
    return false;
  }

  try {
    const res = await fetch(pdfApiUrl, {
      credentials: "include",
      mode: "cors",
    });

    if (!res.ok) {
      const text = await res.text();
      let message = res.statusText || "Download failed";
      try {
        const j = JSON.parse(text) as { message?: string };
        if (j?.message) message = j.message;
      } catch {
        if (text?.length && text.length < 400) message = text;
      }
      toast.error(message);
      return false;
    }

    const blob = await res.blob();
    if (blob.size === 0) {
      toast.error("Empty PDF response");
      return false;
    }

    const fromHeader = parseContentDispositionFilename(res.headers.get("Content-Disposition"));
    const stemForName = (fromHeader || fileNameBase).replace(/\.pdf$/i, "").trim() || "receipt";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeFileName(stemForName);
    a.rel = "noopener";
    document.body.appendChild(a);

    try {
      a.click();
    } catch {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        toast.error("Could not start download");
        URL.revokeObjectURL(url);
        a.remove();
        return false;
      }
    }
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 2500);

    return true;
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    if (err?.name === "AbortError") return false;
    const msg =
      err?.message && /failed to fetch|networkerror|load failed/i.test(err.message)
        ? "Network error: is the API running at NEXT_PUBLIC_APP_URL? Try restarting the server."
        : err?.message || "Failed to download PDF";
    toast.error(msg);
    return false;
  }
}
