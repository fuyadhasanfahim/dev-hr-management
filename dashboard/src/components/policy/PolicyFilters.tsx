import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";

interface PolicyFiltersProps {
  search: string;
  status: string;
  showStatusFilter: boolean;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

export function PolicyFilters({
  search,
  status,
  showStatusFilter,
  onFilterChange,
  onClearFilters,
}: PolicyFiltersProps) {
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

  const hasActiveFilters = Boolean(search) || Boolean(status);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
      {/* Search */}
      <div className="relative w-full lg:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search policies by title..."
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
      {(showStatusFilter || hasActiveFilters) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {showStatusFilter && (
            <Select
              value={status || "all"}
              onValueChange={(val) => onFilterChange("status", val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-[130px] h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          )}

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
      )}
    </div>
  );
}
