import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
    page: number;
    totalPages: number;
    limit: number;
    total: number;
    noun?: string;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    isLoading?: boolean;
    pageSizes?: number[];
}

/** 1 2 3 … 49 50 51 … 98 99 100 — first 3, last 3 and a window around the current page. */
export function pageItems(current: number, total: number): (number | "…")[] {
    const keep = new Set<number>();
    for (const n of [1, 2, 3, total - 2, total - 1, total, current - 1, current, current + 1]) if (n >= 1 && n <= total) keep.add(n);
    const sorted = [...keep].sort((a, b) => a - b);
    const out: (number | "…")[] = [];
    sorted.forEach((n, i) => {
        const prev = sorted[i - 1];
        if (prev !== undefined && n - prev === 2) out.push(prev + 1); // a single hidden page is just shown
        else if (prev !== undefined && n - prev > 2) out.push("…");
        out.push(n);
    });
    return out;
}

/** Rows-per-page · "Showing 21 to 40 of 217" · « ‹ 1 2 3 … 98 99 100 › » */
export function NumberedPagination({
    page,
    totalPages,
    limit,
    total,
    noun = "items",
    onPageChange,
    onLimitChange,
    isLoading = false,
    pageSizes = [20, 50, 100],
}: Props) {
    const pages = Math.max(totalPages, 1);
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    const canPrev = page > 1 && !isLoading;
    const canNext = page < pages && !isLoading;

    return (
        <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
                <Label htmlFor="rows-per-page" className="text-sm font-medium">Rows per page</Label>
                <Select value={`${limit}`} onValueChange={(v) => onLimitChange(Number(v))}>
                    <SelectTrigger size="sm" className="w-20" id="rows-per-page"><SelectValue placeholder={limit} /></SelectTrigger>
                    <SelectContent side="top">
                        {pageSizes.map((n) => <SelectItem key={n} value={`${n}`}>{n}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground/80">{from}</span> to{" "}
                <span className="font-medium text-foreground/80">{to}</span> of{" "}
                <span className="font-medium text-foreground/80">{total}</span> {noun}
            </p>

            <nav aria-label="Pagination" className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="hidden size-8 sm:flex" onClick={() => onPageChange(1)} disabled={!canPrev}>
                    <span className="sr-only">First page</span><ChevronsLeft />
                </Button>
                <Button variant="outline" size="icon" className="size-8" onClick={() => onPageChange(page - 1)} disabled={!canPrev}>
                    <span className="sr-only">Previous page</span><ChevronLeft />
                </Button>
                {pageItems(page, pages).map((it, i) =>
                    it === "…" ? (
                        <span key={`gap-${i}`} className="px-1.5 text-sm text-muted-foreground">…</span>
                    ) : (
                        <Button
                            key={it}
                            variant={it === page ? "default" : "outline"}
                            size="icon"
                            className={cn("size-8 text-xs", it !== page && "font-normal")}
                            aria-current={it === page ? "page" : undefined}
                            onClick={() => onPageChange(it)}
                            disabled={isLoading && it !== page}
                        >
                            {it}
                        </Button>
                    ),
                )}
                <Button variant="outline" size="icon" className="size-8" onClick={() => onPageChange(page + 1)} disabled={!canNext}>
                    <span className="sr-only">Next page</span><ChevronRight />
                </Button>
                <Button variant="outline" size="icon" className="hidden size-8 sm:flex" onClick={() => onPageChange(pages)} disabled={!canNext}>
                    <span className="sr-only">Last page</span><ChevronsRight />
                </Button>
            </nav>
        </div>
    );
}
