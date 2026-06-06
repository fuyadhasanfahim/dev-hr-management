import { Search, X, SlidersHorizontal, CalendarDays } from "lucide-react";
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
import { useDebounce } from "@/hooks/use-debounce";
import { useEffect, useState } from "react";
import { LeadSetting } from "@/types/lead.type";

interface LeadFiltersProps {
  search: string;
  status: string;
  priority: string;
  source: string;
  nextActionType: string;
  nextActionDateFrom: string;
  nextActionDateTo: string;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  statuses: LeadSetting[];
  sources: LeadSetting[];
  actionTypes: LeadSetting[];
}

const PRIORITY_OPTIONS = [
  { value: "High", label: "High", dotColor: "bg-red-500" },
  { value: "Medium", label: "Medium", dotColor: "bg-amber-500" },
  { value: "Low", label: "Low", dotColor: "bg-blue-500" },
] as const;

const DATE_PRESET_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_week", label: "This Week" },
  { value: "next_week", label: "Next Week" },
  { value: "this_month", label: "This Month" },
  { value: "overdue", label: "Overdue" },
  { value: "no_action", label: "No Action Planned" },
  { value: "custom", label: "Custom Range" },
] as const;

function getDatePresetRange(preset: string): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: fmt(today), to: fmt(today) };
    case "tomorrow": {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { from: fmt(tomorrow), to: fmt(tomorrow) };
    }
    case "this_week": {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return { from: fmt(startOfWeek), to: fmt(endOfWeek) };
    }
    case "next_week": {
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + (7 - today.getDay()));
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);
      return { from: fmt(nextMonday), to: fmt(nextSunday) };
    }
    case "this_month": {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: fmt(startOfMonth), to: fmt(endOfMonth) };
    }
    case "overdue": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: "2020-01-01", to: fmt(yesterday) };
    }
    default:
      return { from: "", to: "" };
  }
}

function detectPreset(from: string, to: string): string {
  if (!from && !to) return "";
  for (const preset of ["today", "tomorrow", "this_week", "next_week", "this_month", "overdue"] as const) {
    const range = getDatePresetRange(preset);
    if (range.from === from && range.to === to) return preset;
  }
  if (from || to) return "custom";
  return "";
}

export function LeadFilters({
  search,
  status,
  priority,
  source,
  nextActionType,
  nextActionDateFrom,
  nextActionDateTo,
  onFilterChange,
  onClearFilters,
  statuses,
  sources,
  actionTypes,
}: LeadFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebounce(localSearch, 500);
  const [datePreset, setDatePreset] = useState(() =>
    detectPreset(nextActionDateFrom, nextActionDateTo)
  );

  useEffect(() => {
    if (debouncedSearch !== search) {
      onFilterChange("search", debouncedSearch);
    }
  }, [debouncedSearch, onFilterChange, search]);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Sync datePreset when external values change
  useEffect(() => {
    setDatePreset(detectPreset(nextActionDateFrom, nextActionDateTo));
  }, [nextActionDateFrom, nextActionDateTo]);

  const handleDatePresetChange = (preset: string) => {
    if (preset === "all") {
      setDatePreset("");
      onFilterChange("nextActionDateFrom", "");
      // Small delay to avoid batching issues
      setTimeout(() => onFilterChange("nextActionDateTo", ""), 0);
      return;
    }
    if (preset === "no_action") {
      // no_action is a special case — we don't have server support for "null nextActionDate",
      // so we clear date range filters. This could be extended later.
      setDatePreset("no_action");
      onFilterChange("nextActionDateFrom", "");
      setTimeout(() => onFilterChange("nextActionDateTo", ""), 0);
      return;
    }
    if (preset === "custom") {
      setDatePreset("custom");
      return;
    }
    setDatePreset(preset);
    const range = getDatePresetRange(preset);
    onFilterChange("nextActionDateFrom", range.from);
    setTimeout(() => onFilterChange("nextActionDateTo", range.to), 0);
  };

  // Build active filter pills
  const activeFilters: { key: string; label: string; color?: string }[] = [];
  if (status) {
    const s = statuses.find((s) => s._id === status);
    activeFilters.push({ key: "status", label: s?.name || "Status", color: s?.color });
  }
  if (priority) {
    const p = PRIORITY_OPTIONS.find((p) => p.value === priority);
    activeFilters.push({ key: "priority", label: p?.label || priority });
  }
  if (source) {
    const s = sources.find((s) => s._id === source);
    activeFilters.push({ key: "source", label: s?.name || "Source", color: s?.color });
  }
  if (nextActionType) {
    const a = actionTypes.find((a) => a._id === nextActionType);
    activeFilters.push({ key: "nextActionType", label: a?.name || "Action Type", color: a?.color });
  }
  if (nextActionDateFrom || nextActionDateTo) {
    const presetLabel = DATE_PRESET_OPTIONS.find((p) => p.value === datePreset)?.label;
    const label =
      presetLabel && datePreset !== "custom"
        ? presetLabel
        : nextActionDateFrom && nextActionDateTo
          ? `${nextActionDateFrom} → ${nextActionDateTo}`
          : nextActionDateFrom
            ? `From ${nextActionDateFrom}`
            : `Until ${nextActionDateTo}`;
    activeFilters.push({ key: "nextActionDate", label });
  }

  const hasActiveFilters = activeFilters.length > 0 || search !== "";

  const clearDateFilters = () => {
    setDatePreset("");
    onFilterChange("nextActionDateFrom", "");
    setTimeout(() => onFilterChange("nextActionDateTo", ""), 0);
  };

  return (
    <div className="space-y-3">
      {/* ── Row 1: Search + Filter dropdowns ─────────────────────── */}
      <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center">
        {/* Search */}
        <div className="relative w-full xl:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, email, phone..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus-visible:ring-teal-500"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <SlidersHorizontal className="h-4 w-4 text-slate-400 dark:text-slate-500 hidden sm:block shrink-0" />

          {/* Status */}
          <Select
            value={status || "all"}
            onValueChange={(val) => onFilterChange("status", val === "all" ? "" : val)}
          >
            <SelectTrigger className="w-[130px] h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm focus:ring-teal-500">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses?.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  <span className="flex items-center gap-2">
                    {s.color && (
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                    )}
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select
            value={priority || "all"}
            onValueChange={(val) => onFilterChange("priority", val === "all" ? "" : val)}
          >
            <SelectTrigger className="w-[125px] h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm focus:ring-teal-500">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <span className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${p.dotColor}`} />
                    {p.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Source */}
          <Select
            value={source || "all"}
            onValueChange={(val) => onFilterChange("source", val === "all" ? "" : val)}
          >
            <SelectTrigger className="w-[130px] h-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm focus:ring-teal-500">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources?.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  <span className="flex items-center gap-2">
                    {s.color && (
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                    )}
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear all */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLocalSearch("");
                onClearFilters();
              }}
              className="h-9 px-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Row 2: Next Action filters ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex items-center gap-1.5 shrink-0">
          <CalendarDays className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Next Action
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action Type */}
          {actionTypes.length > 0 && (
            <Select
              value={nextActionType || "all"}
              onValueChange={(val) => onFilterChange("nextActionType", val === "all" ? "" : val)}
            >
              <SelectTrigger className="w-[140px] h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:ring-teal-500">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {actionTypes.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    <span className="flex items-center gap-2">
                      {a.color && (
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: a.color }}
                        />
                      )}
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date Preset */}
          <Select
            value={datePreset || "all"}
            onValueChange={(val) => handleDatePresetChange(val === "all" ? "all" : val)}
          >
            <SelectTrigger className="w-[140px] h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:ring-teal-500">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Date</SelectItem>
              {DATE_PRESET_OPTIONS.filter((p) => p.value !== "no_action").map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom date inputs — only visible when "Custom Range" is selected */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={nextActionDateFrom}
                onChange={(e) => onFilterChange("nextActionDateFrom", e.target.value)}
                className="w-[135px] h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus-visible:ring-teal-500"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date"
                value={nextActionDateTo}
                onChange={(e) => onFilterChange("nextActionDateTo", e.target.value)}
                className="w-[135px] h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus-visible:ring-teal-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Active filter pills (only when filters are active) ── */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 dark:text-slate-500">Active:</span>
          {activeFilters.map((f) => (
            <Badge
              key={f.key}
              variant="secondary"
              className="gap-1.5 pl-2 pr-1 py-0.5 text-xs font-normal bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-0 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {f.color && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: f.color }}
                />
              )}
              {f.label}
              <button
                onClick={() => {
                  if (f.key === "nextActionDate") {
                    clearDateFilters();
                  } else {
                    onFilterChange(f.key, "");
                  }
                }}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-slate-300/60 dark:hover:bg-slate-600/60 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
