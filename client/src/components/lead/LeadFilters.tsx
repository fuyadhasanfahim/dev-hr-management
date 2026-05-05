import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { useEffect, useState } from "react";
import { LeadSetting } from "@/types/lead.type";

interface LeadFiltersProps {
  search: string;
  status: string;
  priority: string;
  source: string;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  statuses: LeadSetting[];
  sources: LeadSetting[];
}

export function LeadFilters({
  search,
  status,
  priority,
  source,
  onFilterChange,
  onClearFilters,
  statuses,
  sources,
}: LeadFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebounce(localSearch, 500);

  useEffect(() => {
    if (debouncedSearch !== search) {
      onFilterChange("search", debouncedSearch);
    }
  }, [debouncedSearch, onFilterChange, search]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const hasActiveFilters =
    search !== "" || status !== "" || priority !== "" || source !== "";

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search leads..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9 h-9 border-slate-200 bg-white"
        />
      </div>

      {/* Status Filter */}
      <div className="w-full sm:w-[160px]">
        <Select
          value={status || "all"}
          onValueChange={(value) =>
            onFilterChange("status", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="h-9 border-slate-200 bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses?.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priority Filter */}
      <div className="w-full sm:w-[140px]">
        <Select
          value={priority || "all"}
          onValueChange={(value) =>
            onFilterChange("priority", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="h-9 border-slate-200 bg-white">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Source Filter */}
      <div className="w-full sm:w-[160px]">
        <Select
          value={source || "all"}
          onValueChange={(value) =>
            onFilterChange("source", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="h-9 border-slate-200 bg-white">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources?.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="h-9 px-2.5 text-slate-500 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
