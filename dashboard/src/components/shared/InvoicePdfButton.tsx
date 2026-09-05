'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { publicApiUrl } from '@/lib/public-api';

interface Props {
  /** `quotation` → /api/quotations/:id/invoice/pdf · `order` → /api/orders/:id/invoice/pdf */
  source: 'quotation' | 'order';
  id: string;
  /** File name shown to the user, without extension. */
  fileNameBase: string;
  className?: string;
  /** Render as an icon-only button (no label), e.g. for table row actions. */
  iconOnly?: boolean;
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
  const stem = (base || 'invoice').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'invoice';
  return stem.endsWith('.pdf') ? stem : `${stem}.pdf`;
}

export default function InvoicePdfButton({ source, id, fileNameBase, className, iconOnly }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    const segment = source === 'order' ? 'orders' : 'quotations';
    const apiUrl = publicApiUrl(`/api/${segment}/${id}/invoice/pdf`);
    if (!apiUrl.startsWith('http')) {
      toast.error('NEXT_PUBLIC_APP_URL is not set (cannot reach API)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl, { credentials: 'include', mode: 'cors' });

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
      const stem = (fromHeader || fileNameBase).replace(/\.pdf$/i, '').trim() || 'invoice';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sanitizeFileName(stem);
      a.rel = 'noopener';
      document.body.appendChild(a);
      requestAnimationFrame(() => {
        try {
          a.click();
        } catch {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 2500);
      });
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'AbortError') return;
      const msg =
        err?.message && /failed to fetch|networkerror|load failed/i.test(err.message)
          ? 'Network error: is the API running at NEXT_PUBLIC_APP_URL?'
          : err?.message || 'Failed to download invoice';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        disabled={loading}
        onClick={handleDownload}
        aria-label="Download invoice"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <FileText className="h-3.5 w-3.5" aria-hidden />
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={loading}
      onClick={handleDownload}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Generating…
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" aria-hidden />
          Invoice
        </span>
      )}
    </Button>
  );
}
