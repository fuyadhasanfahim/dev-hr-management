'use client';

import * as React from 'react';
import { useState, useRef, useMemo, useEffect } from 'react';
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

export function CalendarContent({
  value,
  onChange,
  className = '',
  align = 'down',
}: CalendarContentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => {
    if (!value) return new Date();
    if (typeof value === 'string') return parseISO(value);
    return value;
  }, [value]);

  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate);

  useClickOutside(containerRef, () => setIsOpen(false));

  // Sync calendar view month when selected date changes
  useEffect(() => {
    setCurrentMonth(selectedDate);
  }, [selectedDate]);

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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: align === 'up' ? -10 : 10, scale: 0.95 }}
            animate={{ opacity: 1, y: align === 'up' ? -6 : 4, scale: 1 }}
            exit={{ opacity: 0, y: align === 'up' ? -10 : 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 mt-1.5 rounded-3xl border border-slate-200/80 dark:border-slate-850 bg-white dark:bg-slate-950 p-4 shadow-xl w-72 left-0 sm:left-auto ${
              align === 'up' ? 'bottom-full mb-1.5' : 'top-full'
            }`}
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
      </AnimatePresence>
    </div>
  );
}
