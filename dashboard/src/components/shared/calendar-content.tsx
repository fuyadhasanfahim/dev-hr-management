'use client';

import * as React from 'react';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';

interface CalendarContentProps {
  value: Date | string | undefined;
  onChange: (date: Date) => void;
  className?: string;
  align?: 'up' | 'down';
}

const POPUP_WIDTH = 288; // w-72
const POPUP_HEIGHT_ESTIMATE = 360;
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

export function CalendarContent({
  value,
  onChange,
  className = '',
  align = 'down',
}: CalendarContentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => {
    if (!value) return new Date();
    if (typeof value === 'string') return parseISO(value);
    return value;
  }, [value]);

  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate);

  useClickOutside([containerRef, popupRef], () => setIsOpen(false));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync calendar view month when selected date changes
  useEffect(() => {
    setCurrentMonth(selectedDate);
  }, [selectedDate]);

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.left;
    if (left + POPUP_WIDTH > viewportWidth - VIEWPORT_MARGIN) {
      left = Math.max(VIEWPORT_MARGIN, rect.right - POPUP_WIDTH);
    }

    let placeUp = align === 'up';
    if (placeUp && rect.top - POPUP_HEIGHT_ESTIMATE < VIEWPORT_MARGIN) {
      placeUp = false;
    } else if (!placeUp && rect.bottom + POPUP_HEIGHT_ESTIMATE > viewportHeight - VIEWPORT_MARGIN) {
      placeUp = true;
    }

    if (placeUp) {
      setPosition({ bottom: viewportHeight - rect.top + 6, left });
    } else {
      setPosition({ top: rect.bottom + 6, left });
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

  const daysInCalendar = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const handleDayClick = (day: Date) => {
    onChange(day);
    setIsOpen(false);
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const formattedDate = useMemo(() => {
    if (!value) return 'Select Date';
    return format(selectedDate, 'MMM dd, yyyy');
  }, [value, selectedDate]);

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 px-3 h-10 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50/50 dark:hover:bg-slate-900/30 cursor-pointer transition-all duration-200"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-brand-primary" />
          <span>{formattedDate}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
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
                style={{ position: 'fixed', top: position.top, bottom: position.bottom, left: position.left }}
                className="z-50 rounded-3xl border border-slate-200/80 dark:border-slate-850 bg-white dark:bg-slate-950 p-4 shadow-xl w-72"
              >
                {/* Header: Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-slate-600 dark:text-slate-350 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-slate-600 dark:text-slate-355 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Weekdays row */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {weekdays.map((day) => (
                    <span key={day} className="text-[11px] font-bold text-slate-400">
                      {day}
                    </span>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {daysInCalendar.map((day, idx) => {
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = isSameDay(day, selectedDate);

                    let cellBg = 'hover:bg-slate-100 dark:hover:bg-slate-900';
                    let textColor = isCurrentMonth
                      ? 'text-slate-800 dark:text-slate-200'
                      : 'text-slate-300 dark:text-slate-700';

                    if (isSelected) {
                      cellBg = 'bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-md shadow-brand-primary/20';
                      textColor = 'text-white font-bold';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={`h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all cursor-pointer ${cellBg} ${textColor}`}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
