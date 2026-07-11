'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface CheckboxContentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  className?: string;
}

export function CheckboxContent({
  checked,
  onChange,
  label,
  id,
  className = '',
}: CheckboxContentProps) {
  const checkboxId = id || React.useId();

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <button
        type="button"
        id={checkboxId}
        onClick={() => onChange(!checked)}
        className={`h-5 w-5 rounded-lg flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${
          checked
            ? 'bg-gradient-to-r from-brand-primary to-brand-accent text-white border-0 shadow-xs'
            : 'border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-transparent'
        }`}
      >
        {checked && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <Check className="w-3.5 h-3.5 stroke-[3.5]" />
          </motion.div>
        )}
      </button>
      <label
        htmlFor={checkboxId}
        onClick={() => onChange(!checked)}
        className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
      >
        {label}
      </label>
    </div>
  );
}
