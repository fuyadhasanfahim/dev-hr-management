import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Search, X, SlidersHorizontal, Calendar as CalendarIcon } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { useDebounce } from "@/hooks/use-debounce";

export type FilterType = "all" | "today" | "week" | "month" | "year" | "range";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

interface Branch {
  _id: string;
  name: string;
}

interface ExpenseFiltersProps {
  search: string;
  status: string;
  branchId: string;
  filterType: FilterType;
  selectedMonth: number;
  selectedYear: number;
  dateRange: { from?: Date; to?: Date };
  years: number[];
  branches: Branch[];
  statusOptions: { value: string; label: string }[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onFilterTypeChange: (value: FilterType) => void;
  onMonthChange: (value: number) => void;
  onYearChange: (value: number) => void;
  onDateRangeChange: (range: { from?: Date; to?: Date }) => void;
  onClearFilters: () => void;
}

export function ExpenseFilters({
  search,
  status,
  branchId,
  filterType,
  selectedMonth,
  selectedYear,
  dateRange,
  years,
  branches,
  statusOptions,
  onSearchChange,
  onStatusChange,
  onBranchChange,
  onFilterTypeChange,
  onMonthChange,
  onYearChange,
  onDateRangeChange,
  onClearFilters,
}: ExpenseFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebounce(localSearch, 500);

  useEffect(() => {
    if (debouncedSearch !== search) {
      onSearchChange(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const moreFiltersActiveCount =
    (filterType !== "all" ? 1 : 0) + (branchId ? 1 : 0);
  const hasActiveFilters = Boolean(search) || Boolean(status) || moreFiltersActiveCount > 0;

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
      {/* Search */}
      <div className="relative w-full lg:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search expenses..."
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
          onValueChange={(val) => onStatusChange(val === "all" ? "" : val)}
        >
          <SelectTrigger className="w-[140px] h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
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

        {/* More Filters (Date range, Branch) */}
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
              value={filterType}
              onValueChange={(v) => onFilterTypeChange(v as FilterType)}
            >
              <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
                <SelectItem value="range">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {filterType === "month" && (
              <div className="flex gap-2">
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(v) => onMonthChange(parseInt(v))}
                >
                  <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(v) => onYearChange(parseInt(v))}
                >
                  <SelectTrigger className="w-[100px] h-9 bg-background border-input text-foreground text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterType === "year" && (
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => onYearChange(parseInt(v))}
              >
                <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {filterType === "range" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 justify-start text-left font-normal bg-background"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}
                        </>
                      ) : (
                        format(dateRange.from, "PPP")
                      )
                    ) : (
                      "Pick a date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) =>
                      onDateRangeChange({ from: range?.from, to: range?.to })
                    }
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}

            <Select
              value={branchId || "all"}
              onValueChange={(val) => onBranchChange(val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch._id} value={branch._id}>
                    {branch.name}
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
