import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CLIENT_STATUS_OPTIONS, PER_PAGE_OPTIONS } from "@/lib/constants";
import { Search, X } from "lucide-react";

interface ClientFiltersProps {
  search: string;
  status: string;
  limit: number;
  onFilterChange: (key: string, value: string | number) => void;
  onClearFilters: () => void;
}

export function ClientFilters({
  search,
  status,
  limit,
  onFilterChange,
  onClearFilters,
}: ClientFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onFilterChange("search", localSearch);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(timer);
  }, [localSearch, search, onFilterChange]);

  // Sync if external search clears it
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search clients..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9 w-full bg-slate-50/50 dark:bg-slate-900/50"
        />
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <Select
          value={status}
          onValueChange={(value) => onFilterChange("status", value)}
        >
          <SelectTrigger className="w-auto bg-slate-50/50 dark:bg-slate-900/50">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {CLIENT_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={limit.toString()}
          onValueChange={(value) => onFilterChange("limit", parseInt(value))}
        >
          <SelectTrigger className="w-auto bg-slate-50/50 dark:bg-slate-900/50">
            <SelectValue placeholder="Rows per page" />
          </SelectTrigger>
          <SelectContent>
            {PER_PAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt.toString()}>
                {opt} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="secondary"
          size="icon"
          onClick={onClearFilters}
          className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 px-3"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
