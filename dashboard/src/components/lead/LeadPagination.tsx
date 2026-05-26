import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

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
        const delta = 2;
        const range = [];
        
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
                    <span key={`ellipsis-${idx}`} className="px-3 py-2 text-slate-400">
                        ...
                    </span>
                );
            }

            return (
                <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "ghost"}
                    size="icon"
                    className={`h-8 w-8 ${
                        currentPage === pageNumber
                            ? "bg-teal-600 text-white hover:bg-teal-700"
                            : "text-slate-600 hover:text-slate-900"
                    }`}
                    onClick={() => onPageChange(pageNumber as number)}
                    disabled={isLoading}
                >
                    {pageNumber}
                </Button>
            );
        });
    };

    return (
        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500"
                onClick={() => onPageChange(1)}
                disabled={currentPage === 1 || isLoading}
            >
                <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || isLoading}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center mx-2 gap-1">
                {renderPageNumbers()}
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500"
                onClick={() => onPageChange(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
            >
                <ChevronsRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
