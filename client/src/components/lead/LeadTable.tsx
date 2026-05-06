import { useState } from "react";
import { useConvertLeadToClientMutation } from "@/redux/features/lead/leadApi";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, UserPlus, Loader } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Lead } from "@/types/lead.type";
import { format } from "date-fns";

interface LeadTableProps {
  leads: Lead[];
  isLoading: boolean;
  onEdit: (lead: Lead) => void;
  onView: (lead: Lead) => void;
}

export function LeadTable({
  leads,
  isLoading,
  onEdit,
  onView,
}: LeadTableProps) {
  const [convertLead] = useConvertLeadToClientMutation();
  const [activeConvertingId, setActiveConvertingId] = useState<string | null>(null);

  const handleConvert = async (lead: Lead) => {
    if (!confirm(`Are you sure you want to convert "${lead.name || "this lead"}" to a client?`)) return;
    try {
      setActiveConvertingId(lead._id);
      const clientData = {
        name: lead.name || "Unknown",
        emails: lead.email ? [lead.email] : ["temp@temp.com"],
        phone: lead.phone,
        status: "active",
      };
      await convertLead({ id: lead._id, clientData }).unwrap();
      toast.success("Lead converted to Client successfully!");
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to convert lead");
    } finally {
      setActiveConvertingId(null);
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "High":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50";
      case "Medium":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50";
      case "Low":
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 border-y border-border hover:bg-muted/40">
            <TableHead className="font-semibold text-muted-foreground">Name</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Phone</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Status</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Priority</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Source</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Next Action</TableHead>
            <TableHead className="font-semibold text-muted-foreground text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index} className="border-b border-border">
                <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[110px]" /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                No leads found matching your criteria.
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => (
              <TableRow
                key={lead._id}
                className="group border-b border-border hover:bg-muted/30 transition-colors"
              >
                <TableCell className="font-medium text-foreground">
                  {lead.name || "N/A"}
                </TableCell>
                <TableCell className="text-muted-foreground">{lead.phone}</TableCell>
                <TableCell>
                  {lead.status ? (
                    <Badge
                      variant="outline"
                      style={{
                        backgroundColor: lead.status.color ? `${lead.status.color}20` : undefined,
                        color: lead.status.color || undefined,
                        borderColor: lead.status.color ? `${lead.status.color}50` : undefined,
                      }}
                      className="px-2.5 py-0.5 rounded-full font-medium"
                    >
                      {lead.status.name}
                    </Badge>
                  ) : (
                    <span className="text-slate-400 text-sm">None</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`px-2.5 py-0.5 rounded-full font-medium ${getPriorityColor(
                      lead.priority
                    )}`}
                  >
                    {lead.priority || "Medium"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.source?.name || "N/A"}
                </TableCell>
                <TableCell>
                  {lead.nextActionDate ? (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground/90">
                        {lead.nextActionType?.name || "Follow-up"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(lead.nextActionDate), "MMM dd, yyyy")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">No action planned</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(lead)}
                      className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-500/10"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(lead)}
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                      title="Edit Lead"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!lead.isConverted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleConvert(lead)}
                        disabled={activeConvertingId === lead._id}
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                        title="Convert to Client"
                      >
                        {activeConvertingId === lead._id ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
