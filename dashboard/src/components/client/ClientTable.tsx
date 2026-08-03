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
import { Eye, Edit, Users, UsersRound } from "lucide-react";
import { Client } from "@/types/client.type";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ClientTableProps {
  clients: Client[];
  isLoading: boolean;
  onEdit: (client: Client) => void;
  onView: (client: Client) => void;
}

export function ClientTable({
  clients,
  isLoading,
  onEdit,
  onView,
}: ClientTableProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
              Name
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Phone
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Telemarketer
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
              Team
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
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
                <TableCell className="pl-6"><Skeleton className="h-3.5 w-[110px]" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-[140px]" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-[100px]" /></TableCell>
                <TableCell><Skeleton className="h-5 w-[90px] rounded-md" /></TableCell>
                <TableCell><Skeleton className="h-3.5 w-[40px] mx-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-[60px] rounded-full" /></TableCell>
                <TableCell className="pr-6">
                  <div className="flex justify-end gap-1">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-40 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                    <UsersRound className="h-5 w-5 text-brand-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No clients found matching your criteria.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => {
              const isActive = client.status === "active";
              const tm =
                typeof client.assignedTelemarketer === "object"
                  ? client.assignedTelemarketer
                  : null;
              return (
                <TableRow
                  key={client._id}
                  className="cursor-pointer"
                  onClick={() => onView(client)}
                >
                  {/* Name */}
                  <TableCell className="pl-6">
                    <p className="text-sm font-medium text-foreground truncate max-w-[160px]">
                      {client.name}
                    </p>
                  </TableCell>

                  {/* Email */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-foreground/80 truncate max-w-[170px]">
                        {client.emails?.[0] || "—"}
                      </span>
                      {client.emails && client.emails.length > 1 && (
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px] font-medium"
                        >
                          +{client.emails.length - 1}
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Phone */}
                  <TableCell>
                    <span className="text-sm text-foreground/80">
                      {client.phone || "—"}
                    </span>
                  </TableCell>

                  {/* Telemarketer */}
                  <TableCell>
                    {tm?.name ? (
                      <Badge
                        variant="outline"
                        className="px-2 py-0.5 text-xs font-medium rounded-md"
                      >
                        {tm.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Team Members */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center gap-1.5 cursor-default text-foreground/80">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {client.teamMembers?.length || 0}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="min-w-[150px]">
                        {client.teamMembers && client.teamMembers.length > 0 ? (
                          <ul className="space-y-1">
                            {client.teamMembers.map((member, idx) => (
                              <li key={idx} className="text-xs">
                                {idx + 1}. {member.name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs">No team members assigned</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50"
                      }`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View"
                        onClick={() => onView(client)}
                        className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => onEdit(client)}
                        className="h-7 w-7 text-muted-foreground hover:text-brand-accent hover:bg-brand-accent/10"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
