'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

interface SelectContentProps {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  align?: 'up' | 'down';
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export function SelectContent({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  icon,
  className = '',
  align = 'down',
}: SelectContentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 px-3 h-10 text-sm font-medium text-slate-700 dark:text-slate-205 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all duration-200 shadow-2xs hover:bg-slate-50/50 dark:hover:bg-slate-900/30 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: align === 'up' ? -10 : 10, scale: 0.95 }}
            animate={{ opacity: 1, y: align === 'up' ? -6 : 4, scale: 1 }}
            exit={{ opacity: 0, y: align === 'up' ? -10 : 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 w-full rounded-2xl border border-slate-200/80 dark:border-slate-850 bg-white dark:bg-slate-900 p-1.5 shadow-xl max-h-60 overflow-y-auto ${
              align === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    isSelected ? 'text-brand-primary dark:text-purple-300' : 'text-slate-750 dark:text-slate-300'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-brand-primary" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
