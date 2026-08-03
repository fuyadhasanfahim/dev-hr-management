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

interface Client {
  _id: string;
  name: string;
}

interface MeetingFiltersProps {
  search: string;
  status: string;
  clientId: string;
  clients: Client[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onClientChange: (value: string) => void;
  onClearFilters: () => void;
}

export function MeetingFilters({
  search,
  status,
  clientId,
  clients,
  onSearchChange,
  onStatusChange,
  onClientChange,
  onClearFilters,
}: MeetingFiltersProps) {
  const hasActiveFilters = Boolean(search) || Boolean(status) || Boolean(clientId);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
      {/* Search */}
      <div className="relative w-full lg:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search meetings or clients..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 bg-background border-input text-foreground focus-visible:ring-brand-primary"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
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
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={clientId || "all"}
          onValueChange={(val) => onClientChange(val === "all" ? "" : val)}
        >
          <SelectTrigger className="w-[160px] h-9 bg-background border-input text-foreground text-sm focus:ring-brand-primary">
            <SelectValue placeholder="Client" />
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

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
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
