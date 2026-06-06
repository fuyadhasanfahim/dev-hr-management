import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LeadPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    isLoading: boolean;
}

export function LeadPagination({
    currentPage,
    totalPages,
    onPageChange,
    isLoading,
}: LeadPaginationProps) {
    const renderPageNumbers = () => {
        const delta = 1;
        const range: (number | string)[] = [];

        for (
            let i = Math.max(2, currentPage - delta);
            i <= Math.min(totalPages - 1, currentPage + delta);
            i++
        ) {
            range.push(i);
        }

        if (currentPage - delta > 2) range.unshift("...");
        if (currentPage + delta < totalPages - 1) range.push("...");

        range.unshift(1);
        if (totalPages > 1) range.push(totalPages);

        return range.map((pageNumber, idx) => {
            if (pageNumber === "...") {
                return (
                    <span
                        key={`ellipsis-${idx}`}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm"
                    >
                        ···
                    </span>
                );
            }

            const isActive = currentPage === pageNumber;
            return (
                <button
                    key={pageNumber}
                    className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                            ? "bg-teal-600 text-white shadow-sm"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => onPageChange(pageNumber as number)}
                    disabled={isLoading || isActive}
                >
                    {pageNumber}
                </button>
            );
        });
    };

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || isLoading}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-0.5 mx-1">
                {renderPageNumbers()}
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
