import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Download, Trash2, Loader, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { IJobApplication, ApplicationStatus } from "@/types/career.type";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
} from "@/types/career.type";

const STATUS_DOT: Record<ApplicationStatus, string> = {
  pending: "bg-amber-500",
  reviewed: "bg-blue-500",
  shortlisted: "bg-emerald-500",
  rejected: "bg-red-500",
  hired: "bg-purple-500",
};

interface CareerTableProps {
  applications: IJobApplication[];
  isLoading: boolean;
  onView: (application: IJobApplication) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => Promise<void>;
}

export function CareerTable({
  applications,
  isLoading,
  onView,
  onDelete,
  onStatusChange,
}: CareerTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
            Applicant
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Position
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Experience
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Applied
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="border-b border-border/60">
              <TableCell className="pl-6"><Skeleton className="h-3.5 w-[140px]" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[100px]" /></TableCell>
              <TableCell><Skeleton className="h-5 w-[80px] rounded-md" /></TableCell>
              <TableCell><Skeleton className="h-8 w-[130px] rounded-md" /></TableCell>
              <TableCell><Skeleton className="h-3.5 w-[80px]" /></TableCell>
              <TableCell className="pr-6">
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : applications.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="h-40 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-brand-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No applications found matching your criteria.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          applications.map((app) => (
            <ApplicationRow
              key={app._id}
              app={app}
              onView={onView}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
}

function ApplicationRow({
  app,
  onView,
  onDelete,
  onStatusChange,
}: {
  app: IJobApplication;
  onView: (application: IJobApplication) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => Promise<void>;
}) {
  return (
    <TableRow className="cursor-pointer" onClick={() => onView(app)}>
      {/* Applicant */}
      <TableCell className="pl-6">
        <div>
          <p className="text-sm text-foreground truncate max-w-[160px]">
            {app.firstName} {app.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{app.email}</p>
        </div>
      </TableCell>

      {/* Position */}
      <TableCell>
        <span className="text-sm text-foreground/80">
          {app.jobPosition?.title || "Unknown"}
        </span>
      </TableCell>

      {/* Experience */}
      <TableCell>
        <Badge variant="outline" className="text-xs font-normal">
          {app.hasExperience ? "Experienced" : "Fresher"}
        </Badge>
      </TableCell>

      {/* Status */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <StatusSelect app={app} onStatusChange={onStatusChange} />
      </TableCell>

      {/* Applied */}
      <TableCell>
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {format(new Date(app.createdAt), "MMM dd, yyyy")}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="View Details"
            onClick={() => onView(app)}
            className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Download CV"
            asChild
            className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
          >
            <a href={app.cvFile?.url} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            onClick={() => onDelete(app._id)}
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusSelect({
  app,
  onStatusChange,
}: {
  app: IJobApplication;
  onStatusChange: (id: string, status: ApplicationStatus) => Promise<void>;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (newStatus: string) => {
    if (newStatus === app.status) return;
    setIsUpdating(true);
    try {
      await onStatusChange(app._id, newStatus as ApplicationStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Select value={app.status} onValueChange={handleChange} disabled={isUpdating}>
      <SelectTrigger
        size="sm"
        className={cn(
          "w-[135px] h-7 border-transparent text-[11px] font-semibold justify-center gap-1.5 shadow-none",
          APPLICATION_STATUS_COLORS[app.status],
        )}
      >
        {isUpdating ? (
          <Loader className="h-3 w-3 animate-spin" />
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[]).map((s) => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[s])} />
              {APPLICATION_STATUS_LABELS[s]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
