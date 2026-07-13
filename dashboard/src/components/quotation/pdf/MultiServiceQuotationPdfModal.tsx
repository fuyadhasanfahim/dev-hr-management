'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Download } from 'lucide-react';
import { publicApiUrl } from '@/lib/public-api';

export interface MultiServiceQuotationPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Existing quotation id, if already saved. */
  quotationId?: string;
  fileNameBase: string;
  /** Saves the current draft (create or update) and resolves with its id, or null if it couldn't be saved (e.g. no client selected). */
  ensureSaved: () => Promise<string | null>;
}

/**
 * Shows the exact same Puppeteer-generated PDF used by the download button and
 * the "send to client" email attachment — no separate hand-built mockup — so
 * what staff preview here is byte-identical to what the client receives.
 */
export const MultiServiceQuotationPdfModal: React.FC<MultiServiceQuotationPdfModalProps> = ({
  isOpen,
  onClose,
  quotationId,
  fileNameBase,
  ensureSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const id = quotationId || (await ensureSaved());
        if (!id) {
          if (!cancelled) setError('Please select a client first, then try again.');
          return;
        }

        const pdfApiUrl = publicApiUrl(`/api/quotations/${id}/pdf/puppeteer`);
        const res = await fetch(pdfApiUrl, { credentials: 'include', mode: 'cors' });
        if (!res.ok) throw new Error(res.statusText || 'Failed to generate PDF');

        const blob = await res.blob();
        if (blob.size === 0) throw new Error('Empty PDF response');

        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (e: unknown) {
        const err = e as { message?: string };
        if (!cancelled) setError(err?.message || 'Failed to generate PDF preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Revoke the last blob URL on unmount to avoid leaking memory.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl h-[85vh] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 bg-[#1E0078] text-white border-b border-[#4E12D4]/30 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-[#4E12D4] to-[#C850FA] text-[10px] font-extrabold uppercase tracking-widest text-white shrink-0">
                Live PDF Preview
              </span>
              <h3 className="font-bold text-sm tracking-tight truncate">{fileNameBase}.pdf</h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-purple-200 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 relative">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-[#4E12D4]" />
                <p className="text-sm font-semibold">Saving draft &amp; generating the real PDF…</p>
              </div>
            )}
            {!loading && error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-8">
                <p className="text-sm font-bold text-red-500">{error}</p>
              </div>
            )}
            {!loading && !error && blobUrl && (
              <iframe src={blobUrl} title="Quotation PDF Preview" className="w-full h-full border-0" />
            )}
          </div>

          {blobUrl && !loading && !error && (
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <a
                href={blobUrl}
                download={`${fileNameBase}.pdf`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#4E12D4] to-[#1E0078] text-white font-bold text-xs shadow-md hover:opacity-95 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Download this PDF
              </a>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
