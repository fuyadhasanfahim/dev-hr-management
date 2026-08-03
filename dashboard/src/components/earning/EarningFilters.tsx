import { useEffect, useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { MONTHS } from "@/types/earning.type";

interface EarningFiltersProps {
  search: string;
  status: string;
  clientId: string;
  month: string;
  year: string;
  statusOptions: { label: string; value: string }[];
  clients: { _id: string; name: string }[];
  years: number[];
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

export function EarningFilters({
  search,
  status,
  clientId,
  month,
  year,
  statusOptions,
  clients,
  years,
  onFilterChange,
  onClearFilters,
}: EarningFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebounce(localSearch, 500);

  useEffect(() => {
    if (debouncedSearch !== search) {
      onFilterChange("search", debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const moreFiltersActiveCount = (clientId ? 1 : 0) + (month ? 1 : 0) + (year ? 1 : 0);
  const hasActiveFilters = Boolean(search) || Boolean(status) || moreFiltersActiveCount > 0;

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
      {/* Search */}
      <div className="relative w-full lg:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by order title or quotation number..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9 h-9 bg-background border-input text-foreground focus-visible:ring-brand-primary"
        />
        {localSearch && (
          <button
            onClick={() => setLocalSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Select
          value={status || "all"}
          onValueChange={(val) => onFilterChange("status", val === "all" ? "" : val)}
        >
          <SelectTrigger className="w-[130px] h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* More Filters (Month, Year, Client) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 bg-background border-input text-foreground text-sm font-normal"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              More Filters
              {moreFiltersActiveCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-brand-primary/15 text-brand-primary dark:text-brand-accent text-[10px] font-semibold"
                >
                  {moreFiltersActiveCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <Select
              value={month || "all"}
              onValueChange={(val) => onFilterChange("month", val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={year || "all"}
              onValueChange={(val) => onFilterChange("year", val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={clientId || "all"}
              onValueChange={(val) => onFilterChange("clientId", val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocalSearch("");
              onClearFilters();
            }}
            className="h-9 px-2.5 text-muted-foreground hover:text-foreground gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
