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
import { Eye, Edit } from "lucide-react";
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
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "High":
        return "bg-red-50 text-red-700 border-red-200";
      case "Medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Low":
        return "bg-slate-50 text-slate-700 border-slate-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 border-y border-slate-100 hover:bg-slate-50">
            <TableHead className="font-semibold text-slate-600">Name</TableHead>
            <TableHead className="font-semibold text-slate-600">Phone</TableHead>
            <TableHead className="font-semibold text-slate-600">Status</TableHead>
            <TableHead className="font-semibold text-slate-600">Priority</TableHead>
            <TableHead className="font-semibold text-slate-600">Source</TableHead>
            <TableHead className="font-semibold text-slate-600">Next Action</TableHead>
            <TableHead className="font-semibold text-slate-600 text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index} className="border-b border-slate-50">
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
                className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
              >
                <TableCell className="font-medium text-slate-900">
                  {lead.name || "N/A"}
                </TableCell>
                <TableCell className="text-slate-600">{lead.phone}</TableCell>
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
                <TableCell className="text-slate-600">
                  {lead.source?.name || "N/A"}
                </TableCell>
                <TableCell>
                  {lead.nextActionDate ? (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">
                        {lead.nextActionType?.name || "Follow-up"}
                      </span>
                      <span className="text-xs text-slate-500">
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
                      className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(lead)}
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Edit Lead"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
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
