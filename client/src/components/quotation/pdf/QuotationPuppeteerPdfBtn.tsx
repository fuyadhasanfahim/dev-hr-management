'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  quotationId: string;
  fileNameBase: string;
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
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          (errBody as { message?: string }).message || res.statusText || 'Download failed',
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileNameBase || 'quotation'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to download PDF');
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
