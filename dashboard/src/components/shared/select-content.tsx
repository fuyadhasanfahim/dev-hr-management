'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectContentProps {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  align?: 'up' | 'down';
}

const POPUP_HEIGHT_ESTIMATE = 260;
const VIEWPORT_MARGIN = 8;

function useClickOutside(refs: React.RefObject<HTMLElement | null>[], handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const isInside = refs.some((ref) => ref.current && ref.current.contains(target));
      if (isInside) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [refs, handler]);
}

export function SelectContent({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  icon,
  className = '',
  triggerClassName = '',
  align = 'down',
}: SelectContentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useClickOutside([containerRef, popupRef], () => setIsOpen(false));

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportHeight = window.innerHeight;
    const left = rect.left;

    let placeUp = align === 'up';
    if (placeUp && rect.top - POPUP_HEIGHT_ESTIMATE < VIEWPORT_MARGIN) {
      placeUp = false;
    } else if (!placeUp && rect.bottom + POPUP_HEIGHT_ESTIMATE > viewportHeight - VIEWPORT_MARGIN) {
      placeUp = true;
    }

    if (placeUp) {
      setPosition({ bottom: viewportHeight - rect.top + 6, left, width: rect.width });
    } else {
      setPosition({ top: rect.bottom + 6, left, width: rect.width });
    }
  }, [align]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 px-3 h-10 text-sm font-medium text-slate-700 dark:text-slate-205 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all duration-200 shadow-2xs hover:bg-slate-50/50 dark:hover:bg-slate-900/30 cursor-pointer',
          triggerClassName,
        )}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={popupRef}
                initial={{ opacity: 0, y: align === 'up' ? -10 : 10, scale: 0.95 }}
                animate={{ opacity: 1, y: align === 'up' ? -6 : 4, scale: 1 }}
                exit={{ opacity: 0, y: align === 'up' ? -10 : 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'fixed',
                  top: position.top,
                  bottom: position.bottom,
                  left: position.left,
                  width: Math.max(position.width, 160),
                }}
                className="z-50 rounded-2xl border border-slate-200/80 dark:border-slate-850 bg-white dark:bg-slate-900 p-1.5 shadow-xl max-h-60 overflow-y-auto"
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
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
