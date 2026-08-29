'use client';

import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';

interface TablePaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

/** Build a compact page list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 20]. */
function pageWindow(current: number, total: number): (number | 'ellipsis')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | 'ellipsis')[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) pages.push('ellipsis');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < total - 1) pages.push('ellipsis');
    pages.push(total);
    return pages;
}

export function TablePagination({
    page,
    totalPages,
    onPageChange,
}: TablePaginationProps) {
    if (totalPages <= 1) return null;

    const go = (p: number) => (e: React.MouseEvent) => {
        e.preventDefault();
        onPageChange(Math.min(Math.max(1, p), totalPages));
    };

    return (
        <Pagination className="justify-end">
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        href="#"
                        onClick={go(page - 1)}
                        aria-disabled={page === 1}
                        className={
                            page === 1 ? 'pointer-events-none opacity-50' : ''
                        }
                    />
                </PaginationItem>

                {pageWindow(page, totalPages).map((p, i) =>
                    p === 'ellipsis' ? (
                        <PaginationItem key={`e-${i}`}>
                            <PaginationEllipsis />
                        </PaginationItem>
                    ) : (
                        <PaginationItem key={p}>
                            <PaginationLink
                                href="#"
                                isActive={p === page}
                                onClick={go(p)}
                            >
                                {p}
                            </PaginationLink>
                        </PaginationItem>
                    ),
                )}

                <PaginationItem>
                    <PaginationNext
                        href="#"
                        onClick={go(page + 1)}
                        aria-disabled={page === totalPages}
                        className={
                            page === totalPages
                                ? 'pointer-events-none opacity-50'
                                : ''
                        }
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
}
