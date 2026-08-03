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
import { DESIGNATIONS, DEPARTMENTS } from "@/constants/metadata";

interface Shift {
  _id: string;
  name: string;
  title: string;
}

interface StaffFiltersProps {
  search: string;
  status: string;
  department: string;
  designation: string;
  shiftId: string;
  shifts: Shift[];
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

export function StaffFilters({
  search,
  status,
  department,
  designation,
  shiftId,
  shifts,
  onFilterChange,
  onClearFilters,
}: StaffFiltersProps) {
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

  const moreFiltersActiveCount = (department ? 1 : 0) + (designation ? 1 : 0) + (shiftId ? 1 : 0);
  const hasActiveFilters = Boolean(search) || Boolean(status) || moreFiltersActiveCount > 0;

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
      {/* Search */}
      <div className="relative w-full lg:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, staff ID..."
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
          <SelectTrigger className="w-[120px] h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {/* More Filters (Department, Designation, Shift) */}
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
              value={department || "all"}
              onValueChange={(val) => onFilterChange("department", val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept.value} value={dept.value}>
                    {dept.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={designation || "all"}
              onValueChange={(val) => onFilterChange("designation", val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
                <SelectValue placeholder="All Designations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Designations</SelectItem>
                {DESIGNATIONS.map((desig) => (
                  <SelectItem key={desig.value} value={desig.value}>
                    {desig.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={shiftId || "all"}
              onValueChange={(val) => onFilterChange("shiftId", val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-full h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
                <SelectValue placeholder="All Shifts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                {shifts.map((shift) => (
                  <SelectItem key={shift._id} value={shift._id}>
                    {shift.name} - {shift.title}
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
