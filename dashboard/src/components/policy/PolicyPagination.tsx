import {
    ChevronsLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface PolicyPaginationProps {
    currentPage: number;
    totalPages: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    isLoading: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

export function PolicyPagination({
    currentPage,
    totalPages,
    limit,
    onPageChange,
    onLimitChange,
    isLoading,
}: PolicyPaginationProps) {
    const canPrevious = currentPage > 1 && !isLoading;
    const canNext = currentPage < totalPages && !isLoading;

    return (
        <div className="flex w-full items-center gap-8">
            <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="rows-per-page" className="text-sm font-medium">
                    Rows per page
                </Label>
                <Select
                    value={`${limit}`}
                    onValueChange={(value) => onLimitChange(Number(value))}
                >
                    <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                        <SelectValue placeholder={limit} />
                    </SelectTrigger>
                    <SelectContent side="top">
                        {PAGE_SIZE_OPTIONS.map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                                {pageSize}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex w-fit items-center justify-center text-sm font-medium">
                Page {currentPage} of {Math.max(totalPages, 1)}
            </div>

            <div className="ml-auto flex items-center gap-2">
                <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => onPageChange(1)}
                    disabled={!canPrevious}
                >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft />
                </Button>
                <Button
                    variant="outline"
                    className="size-8"
                    size="icon"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={!canPrevious}
                >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft />
                </Button>
                <Button
                    variant="outline"
                    className="size-8"
                    size="icon"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={!canNext}
                >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight />
                </Button>
                <Button
                    variant="outline"
                    className="hidden size-8 lg:flex"
                    size="icon"
                    onClick={() => onPageChange(totalPages)}
                    disabled={!canNext}
                >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRight />
                </Button>
            </div>
        </div>
    );
}
