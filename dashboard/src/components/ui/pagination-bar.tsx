'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const PAGE_SIZE_OPTIONS = [20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Page buttons for the bar: the first 3 and last 3 pages plus the current page and its neighbours,
 * with "…" where pages are skipped — 1 2 3 … 49 50 51 … 97 98 99.
 */
export function pageItems(current: number, total: number): (number | 'ellipsis')[] {
    const keep = new Set<number>();
    for (const n of [1, 2, 3, total - 2, total - 1, total, current - 1, current, current + 1]) {
        if (n >= 1 && n <= total) keep.add(n);
    }
    const sorted = [...keep].sort((a, b) => a - b);
    const out: (number | 'ellipsis')[] = [];
    sorted.forEach((n, i) => {
        const prev = sorted[i - 1];
        if (prev !== undefined && n - prev > 1) {
            // A gap of exactly one page is shown as that page instead of a pointless "…".
            if (n - prev === 2) out.push(n - 1);
            else out.push('ellipsis');
        }
        out.push(n);
    });
    return out;
}

interface PaginationBarProps {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    isLoading?: boolean;
    className?: string;
}

export function PaginationBar({ page, limit, total, totalPages, onPageChange, onLimitChange, isLoading, className }: PaginationBarProps) {
    const pages = Math.max(1, totalPages);
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    const canPrev = page > 1 && !isLoading;
    const canNext = page < pages && !isLoading;

    return (
        <div className={cn('flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between', className)}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                    <Label htmlFor="rows-per-page" className="text-sm font-medium text-muted-foreground">
                        Rows per page
                    </Label>
                    <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
                        <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                            <SelectValue placeholder={limit} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-sm tabular-nums text-muted-foreground">
                    {total === 0 ? 'No results' : `Showing ${from}–${to} of ${total.toLocaleString()}`}
                </p>
            </div>

            <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
                <Button variant="outline" size="sm" className="gap-1" disabled={!canPrev} onClick={() => onPageChange(page - 1)}>
                    <ChevronLeft className="size-4" />
                    Previous
                </Button>
                {pageItems(page, pages).map((item, i) =>
                    item === 'ellipsis' ? (
                        <span key={`e${i}`} aria-hidden className="w-6 select-none text-center text-sm text-muted-foreground">
                            …
                        </span>
                    ) : (
                        <Button
                            key={item}
                            variant={item === page ? 'default' : 'outline'}
                            size="sm"
                            className="size-8 px-0 tabular-nums"
                            aria-label={`Page ${item}`}
                            aria-current={item === page ? 'page' : undefined}
                            disabled={isLoading && item !== page}
                            onClick={() => item !== page && onPageChange(item)}
                        >
                            {item}
                        </Button>
                    ),
                )}
                <Button variant="outline" size="sm" className="gap-1" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
                    Next
                    <ChevronRight className="size-4" />
                </Button>
            </nav>
        </div>
    );
}
