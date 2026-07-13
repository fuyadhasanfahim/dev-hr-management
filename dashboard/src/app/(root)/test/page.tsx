'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { publicApiUrl } from '@/lib/public-api';

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const quoted = /filename="((?:\\.|[^"\\])*)"/i.exec(header);
  if (quoted?.[1]) return quoted[1].replace(/\\(.)/g, '$1');
  const plain = /filename=([^;\n]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim().replace(/^["']|["']$/g, '');
  return null;
}

export default function TestAiPdfPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!text.trim()) {
      toast.error('Paste some content first');
      return;
    }

    const apiUrl = publicApiUrl('/api/test/pdf');
    if (!apiUrl.startsWith('http')) {
      toast.error('NEXT_PUBLIC_APP_URL is not set (cannot reach API)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const body = await res.text();
        let message = res.statusText || 'Download failed';
        try {
          const j = JSON.parse(body) as { message?: string };
          if (j?.message) message = j.message;
        } catch {
          if (body?.length && body.length < 400) message = body;
        }
        toast.error(message);
        return;
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        toast.error('Empty PDF response');
        return;
      }

      const filename = parseContentDispositionFilename(res.headers.get('Content-Disposition')) || 'test-document.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 2500);

      toast.success('PDF downloaded');
    } catch (e: unknown) {
      const err = e as { message?: string };
      const msg =
        err?.message && /failed to fetch|networkerror|load failed/i.test(err.message)
          ? 'Network error: is the API running at NEXT_PUBLIC_APP_URL?'
          : err?.message || 'Failed to generate PDF';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Test PDF
          </CardTitle>
          <CardDescription>
            Paste any raw text below. OpenAI structures it into a branded proposal-style document, and
            Puppeteer renders it to a downloadable PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste project notes, a proposal draft, meeting summary, pricing details, etc..."
            className="min-h-[300px] resize-y"
          />
          <div className="flex justify-end">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
