'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DialogContentProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function DialogContent({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
}: DialogContentProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Frosted glass backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-md"
          />

          {/* Dialog popup card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-lg bg-white/95 dark:bg-slate-950/95 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl z-10 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header section */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-black bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
                  {title}
                </h3>
                {description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm text-slate-700 dark:text-slate-300">
              {children}
            </div>

            {/* Footer action buttons */}
            {footer && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10 flex justify-end gap-3 items-center">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
