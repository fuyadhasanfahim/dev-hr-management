'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  quotationId: string;
  fileNameBase: string;
}

function sanitizeFileName(base: string): string {
  const stem = (base || 'quotation').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'quotation';
  return stem.endsWith('.pdf') ? stem : `${stem}.pdf`;
}

export default function QuotationPuppeteerPdfBtn({ quotationId, fileNameBase }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    const base = process.env.NEXT_PUBLIC_APP_URL;
    if (!base) {
      toast.error('App URL is not configured');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/quotations/${quotationId}/pdf/puppeteer`, {
        credentials: 'include',
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

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sanitizeFileName(fileNameBase);
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
      toast.error(err?.message || 'Failed to download PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="border-teal-600 text-teal-700 hover:bg-teal-50"
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
          <Printer className="h-4 w-4" aria-hidden />
          Download using Puppeteer
        </span>
      )}
    </Button>
  );
}
