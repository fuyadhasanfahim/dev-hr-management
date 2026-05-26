'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { publicApiUrl } from '@/lib/public-api';

interface Props {
  quotationId: string;
  fileNameBase: string;
}

/** Match UI label: `#QTN-…` when a quotation number exists (avoids double `#`). */
export function quotationPdfFileStem(
  quotationNumber?: string | null,
  titleFallback?: string | null,
): string {
  const num = String(quotationNumber ?? '').trim();
  if (num) return num.startsWith('#') ? num : `#${num}`;
  const t = String(titleFallback ?? '').trim();
  return t || 'quotation';
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=(?:UTF-8'')?([^;\n]+)/i.exec(header);
  if (star?.[1]) {
    const raw = star[1].trim().replace(/^["']|["']$/g, '');
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  const quoted = /filename="((?:\\.|[^"\\])*)"/i.exec(header);
  if (quoted?.[1]) return quoted[1].replace(/\\(.)/g, '$1');
  const plain = /filename=([^;\n]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim().replace(/^["']|["']$/g, '');
  return null;
}

function sanitizeFileName(base: string): string {
  const stem = (base || 'quotation').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'quotation';
  return stem.endsWith('.pdf') ? stem : `${stem}.pdf`;
}

export default function QuotationPuppeteerPdfBtn({ quotationId, fileNameBase }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    const pdfApiUrl = publicApiUrl(`/api/quotations/${quotationId}/pdf/puppeteer`);
    if (!pdfApiUrl.startsWith('http')) {
      toast.error('NEXT_PUBLIC_APP_URL is not set (cannot reach API)');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(pdfApiUrl, {
        credentials: 'include',
        mode: 'cors',
      });

      if (!res.ok) {
        const text = await res.text();
        let message = res.statusText || 'Download failed';
        try {
          const j = JSON.parse(text) as { message?: string };
          if (j?.message) message = j.message;
        } catch {
          if (text?.length && text.length < 400) message = text;
        }
        toast.error(message);
        return;
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        toast.error('Empty PDF response');
        return;
      }

      const fromHeader = parseContentDispositionFilename(res.headers.get('Content-Disposition'));
      const stemForName = (fromHeader || fileNameBase).replace(/\.pdf$/i, '').trim() || 'quotation';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sanitizeFileName(stemForName);
      a.rel = 'noopener';
      document.body.appendChild(a);

      requestAnimationFrame(() => {
        try {
          a.click();
        } catch {
          try {
            window.open(url, '_blank', 'noopener,noreferrer');
          } catch {
            toast.error('Could not start download');
            URL.revokeObjectURL(url);
            a.remove();
            return;
          }
        }
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 2500);
      });
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'AbortError') return;
      // Network / CORS failures often surface as TypeError: Failed to fetch
      const msg =
        err?.message && /failed to fetch|networkerror|load failed/i.test(err.message)
          ? 'Network error: is the API running at NEXT_PUBLIC_APP_URL? Try restarting the server.'
          : err?.message || 'Failed to download PDF';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      className="bg-teal-600 text-white hover:bg-teal-700"
      disabled={loading}
      onClick={handleDownload}
    >
      {loading ? (
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
