'use client';

import * as React from 'react';
import { useMemo, useState, useRef, useEffect } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar as CalendarIcon,
  ListFilter,
  ArrowUp,
  ArrowDown,
  Inbox,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// ── CUSTOM CLICK OUTSIDE HOOK ──────────────────────────────────────────────
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

// ── CUSTOM SELECT DROPDOWN COMPONENT ────────────────────────────────────────
interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  align?: 'up' | 'down';
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  icon,
  className = '',
  align = 'down',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 px-3 h-8.5 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all duration-200 shadow-2xs hover:bg-slate-50/50 dark:hover:bg-slate-900/30 cursor-pointer"
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
                    isSelected ? 'text-brand-primary dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'
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

// ── CUSTOM DATE RANGE PICKER COMPONENT (PURE DATE-FNS) ──────────────────────
interface CustomDateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onRangeChange: (start: Date | undefined, end: Date | undefined) => void;
}

function CustomDateRangePicker({
  startDate,
  endDate,
  onRangeChange,
}: CustomDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  // Calendar dates generation using date-fns
  const daysInCalendar = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const handleDayClick = (day: Date) => {
    if (!startDate || (startDate && endDate)) {
      onRangeChange(day, undefined);
    } else if (startDate && !endDate) {
      if (isBefore(day, startDate)) {
        onRangeChange(day, undefined);
      } else {
        onRangeChange(startDate, day);
        setIsOpen(false); // Close dropdown once range selection completes
      }
    }
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // Helper formatting for labels
  const formattedRange = useMemo(() => {
    if (startDate && endDate) {
      return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    }
    if (startDate) {
      return `${format(startDate, 'MMM d, yyyy')} - Select end`;
    }
    return 'Select Date Range';
  }, [startDate, endDate]);

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50/50 dark:hover:bg-slate-900/30 cursor-pointer transition-all duration-200"
      >
        <CalendarIcon className="w-4 h-4 text-brand-primary" />
        <span>{formattedRange}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-1.5 rounded-3xl border border-slate-200/80 dark:border-slate-850 bg-white dark:bg-slate-950 p-4 shadow-xl w-72"
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
                const isStart = startDate && isSameDay(day, startDate);
                const isEnd = endDate && isSameDay(day, endDate);
                const isInRange =
                  startDate &&
                  endDate &&
                  isAfter(day, startDate) &&
                  isBefore(day, endDate);

                let cellBg = 'hover:bg-slate-100 dark:hover:bg-slate-900';
                let textColor = isCurrentMonth
                  ? 'text-slate-800 dark:text-slate-200'
                  : 'text-slate-300 dark:text-slate-700';

                if (isStart || isEnd) {
                  cellBg = 'bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-md shadow-brand-primary/20';
                  textColor = 'text-white font-bold';
                } else if (isInRange) {
                  cellBg = 'bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-purple-300 rounded-none';
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

            {/* Action panel inside popover */}
            {(startDate || endDate) && (
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-900 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onRangeChange(undefined, undefined);
                    setIsOpen(false);
                  }}
                  className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer"
                >
                  Clear Range
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── MAIN TABLECONTENT COMPONENT ────────────────────────────────────────────
interface TableContentProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  // If searchKey is provided, it searches that column, otherwise it searches globally
  searchKey?: string;
  // Date range filtering
  dateFilterKey?: string; // e.g., 'createdAt', 'date'
  // Custom status/category filtering
  statusFilterKey?: string; // e.g., 'status', 'role'
  statusOptions?: { label: string; value: string }[];
  statusPlaceholder?: string;
  // Header Action button / controls
  actionHeader?: React.ReactNode;
}

export function TableContent<TData>({
  data,
  columns,
  isLoading = false,
  searchPlaceholder = 'Search...',
  searchKey,
  dateFilterKey,
  statusFilterKey,
  statusOptions,
  statusPlaceholder = 'All Status',
  actionHeader,
}: TableContentProps<TData>) {
  // Filters state
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // TanStack Table states
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // 1. Pre-filter data for Date Range and Status
  const filteredData = useMemo(() => {
    return data.filter((item: any) => {
      // Status Filter
      if (statusFilterKey && selectedStatus !== 'all') {
        const itemStatus = item[statusFilterKey];
        if (String(itemStatus).toLowerCase() !== selectedStatus.toLowerCase()) {
          return false;
        }
      }

      // Date Range Filter
      if (dateFilterKey && (startDate || endDate)) {
        const rawDate = item[dateFilterKey];
        if (!rawDate) return false;

        const itemDate = typeof rawDate === 'string' ? parseISO(rawDate) : new Date(rawDate);

        if (startDate && isBefore(itemDate, startOfDay(startDate))) {
          return false;
        }
        if (endDate && isAfter(itemDate, endOfDay(endDate))) {
          return false;
        }
      }

      return true;
    });
  }, [data, statusFilterKey, selectedStatus, dateFilterKey, startDate, endDate]);

  // 2. Initialize TanStack Table
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      if (searchKey) {
        const value = row.getValue(searchKey);
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      }
      // Fallback: search all columns
      return Object.values(row.original as object).some((val) =>
        String(val).toLowerCase().includes(String(filterValue).toLowerCase())
      );
    },
  });

  // Reset page index if filtering changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [globalFilter, selectedStatus, startDate, endDate]);

  const clearAllFilters = () => {
    setSelectedStatus('all');
    setStartDate(undefined);
    setEndDate(undefined);
    setGlobalFilter('');
  };

  const hasActiveFilters =
    selectedStatus !== 'all' || startDate !== undefined || endDate !== undefined || globalFilter !== '';

  // Rows per page options mapping
  const pageSizeOptions = [
    { label: '5', value: '5' },
    { label: '10', value: '10' },
    { label: '20', value: '20' },
    { label: '30', value: '30' },
    { label: '50', value: '50' },
  ];

  const statusDropdownOptions = useMemo(() => {
    if (!statusOptions) return [];
    return [{ label: 'All Status', value: 'all' }, ...statusOptions];
  }, [statusOptions]);

  return (
    <div className="w-full space-y-5">
      {/* ── Table Top Control Panel ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 premium-glass-card relative z-25"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-3.5 flex-1">
          {/* Search Field */}
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 group-focus-within:text-brand-primary group-focus-within:scale-110 transition-all duration-200" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="input-premium pl-11 pr-10"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Custom Status Dropdown Filter */}
          {statusFilterKey && statusOptions && (
            <div className="w-full md:w-48 shrink-0">
              <CustomSelect
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={statusDropdownOptions}
                placeholder={statusPlaceholder}
                icon={<ListFilter className="w-4 h-4 text-brand-primary" />}
              />
            </div>
          )}
        </div>

        {/* Date Filter Range & Action button */}
        <div className="flex flex-wrap items-center gap-3">
          {dateFilterKey && (
            <CustomDateRangePicker
              startDate={startDate}
              endDate={endDate}
              onRangeChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
              }}
            />
          )}

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-355 hover:bg-slate-105 dark:hover:bg-slate-900 hover:text-brand-primary transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-800 cursor-pointer flex items-center gap-1"
            >
              Reset Filters
            </button>
          )}

          {actionHeader && <div className="ml-auto xl:ml-0">{actionHeader}</div>}
        </div>
      </motion.div>

      {/* ── Table Grid Card ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="premium-glass-card overflow-hidden relative z-10"
      >
        <div className="relative w-full overflow-x-auto">
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead className="bg-slate-50/55 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="hover:bg-transparent border-b">
                  {headerGroup.headers.map((header) => {
                    const isSortable = header.column.getCanSort();
                    const sortState = header.column.getIsSorted();

                    return (
                      <th
                        key={header.id}
                        onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                        className={`py-4 px-4 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none text-left align-middle whitespace-nowrap ${
                          isSortable ? 'cursor-pointer hover:text-brand-primary' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {isSortable && (
                            <span className="transition-colors text-slate-400">
                              {sortState === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-brand-primary" />
                              ) : sortState === 'desc' ? (
                                <ArrowDown className="w-3.5 h-3.5 text-brand-primary" />
                              ) : (
                                <ArrowUpDown className="w-3.5 h-3.5 hover:text-brand-primary opacity-60" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-900 hover:bg-transparent">
                    {columns.map((_, cIdx) => (
                      <td key={cIdx} className="py-4.5 px-4">
                        <div className="h-4 bg-slate-200/60 dark:bg-slate-850 rounded-full animate-pulse w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows?.length ? (
                <AnimatePresence mode="popLayout">
                  {table.getRowModel().rows.map((row, idx) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.02 }}
                      className="group border-b border-slate-100 dark:border-slate-900/60 hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-all"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="py-4 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 align-middle whitespace-nowrap"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              ) : (
                <tr className="hover:bg-transparent border-b">
                  <td colSpan={columns.length} className="h-64 text-center align-middle whitespace-nowrap">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center justify-center gap-3 animate-fade-in"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                        <Inbox className="w-7 h-7 stroke-[1.5]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No results found</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                          We couldn't find any entries matching your filters. Try clearing filters or adding new items.
                        </p>
                      </div>
                    </motion.div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer Pagination Panel ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-t border-slate-150 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-900/20">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Rows per page:</span>
            <CustomSelect
              value={String(table.getState().pagination.pageSize)}
              onChange={(val) => table.setPageSize(Number(val))}
              options={pageSizeOptions}
              className="w-20"
              align="up"
            />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Showing {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0} to{' '}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                filteredData.length
              )}{' '}
              of {filteredData.length} entries
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="h-8.5 w-8.5 rounded-xl border border-slate-250 hover:bg-brand-primary/10 hover:text-brand-primary dark:border-slate-800 dark:hover:bg-brand-primary/20 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: table.getPageCount() }).map((_, pageIdx) => {
                const isCurrent = table.getState().pagination.pageIndex === pageIdx;
                return (
                  <button
                    key={pageIdx}
                    onClick={() => table.setPageIndex(pageIdx)}
                    className={`h-8.5 min-w-8.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer ${
                      isCurrent
                        ? 'bg-brand-primary text-white shadow-sm shadow-brand-primary/30 scale-105'
                        : 'border border-slate-200/70 hover:border-slate-350 text-slate-600 hover:text-slate-800 dark:border-slate-800 dark:hover:border-slate-700 dark:text-slate-300 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900/30'
                    }`}
                  >
                    {pageIdx + 1}
                  </button>
                );
              })}
            </div>

            <button
              className="h-8.5 w-8.5 rounded-xl border border-slate-250 hover:bg-brand-primary/10 hover:text-brand-primary dark:border-slate-800 dark:hover:bg-brand-primary/20 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
