import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="space-y-6">
      {/* Search Input Row */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search leads..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-9 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-9 px-3 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 gap-1.5"
          >
            <X className="h-4 w-4" />
            Clear All Filters
          </Button>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
        {/* Status Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 min-w-[70px] mt-2">
            Status:
          </span>
          <Tabs
            value={status || "all"}
            onValueChange={(val) =>
              onFilterChange("status", val === "all" ? "" : val)
            }
            className="w-full"
          >
            <TabsList className="flex flex-wrap h-auto gap-1.5 bg-transparent p-0 justify-start">
              <TabsTrigger
                value="all"
                className="px-3 py-1 h-8 text-xs border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white dark:data-[state=active]:bg-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                All Statuses
              </TabsTrigger>
              {statuses?.map((s) => (
                <TabsTrigger
                  key={s._id}
                  value={s._id}
                  className="px-3 py-1 h-8 text-xs border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white dark:data-[state=active]:bg-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  {s.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Priority Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 min-w-[70px] mt-2">
            Priority:
          </span>
          <Tabs
            value={priority || "all"}
            onValueChange={(val) =>
              onFilterChange("priority", val === "all" ? "" : val)
            }
            className="w-full"
          >
            <TabsList className="flex flex-wrap h-auto gap-1.5 bg-transparent p-0 justify-start">
              <TabsTrigger
                value="all"
                className="px-3 py-1 h-8 text-xs border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white dark:data-[state=active]:bg-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                All Priorities
              </TabsTrigger>
              <TabsTrigger
                value="High"
                className="px-3 py-1 h-8 text-xs border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 rounded-lg data-[state=active]:bg-red-600 data-[state=active]:text-white dark:data-[state=active]:bg-red-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                High
              </TabsTrigger>
              <TabsTrigger
                value="Medium"
                className="px-3 py-1 h-8 text-xs border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white dark:data-[state=active]:bg-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                Medium
              </TabsTrigger>
              <TabsTrigger
                value="Low"
                className="px-3 py-1 h-8 text-xs border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=active]:bg-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                Low
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Source Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 min-w-[70px] mt-2">
            Source:
          </span>
          <Tabs
            value={source || "all"}
            onValueChange={(val) =>
              onFilterChange("source", val === "all" ? "" : val)
            }
            className="w-full"
          >
            <TabsList className="flex flex-wrap h-auto gap-1.5 bg-transparent p-0 justify-start">
              <TabsTrigger
                value="all"
                className="px-3 py-1 h-8 text-xs border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white dark:data-[state=active]:bg-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                All Sources
              </TabsTrigger>
              {sources?.map((s) => (
                <TabsTrigger
                  key={s._id}
                  value={s._id}
                  className="px-3 py-1 h-8 text-xs border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white dark:data-[state=active]:bg-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  {s.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
