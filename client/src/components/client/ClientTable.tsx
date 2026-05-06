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
import { Eye, Edit2, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { Client } from "@/types/client.type";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ClientTableProps {
  clients: Client[];
  isLoading: boolean;
  isTelemarketer: boolean;
  onEdit: (client: Client) => void;
}

export function ClientTable({
  clients,
  isLoading,
  isTelemarketer,
  onEdit,
}: ClientTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto w-full">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Client ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-center">Team Members</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12 mx-auto" />
                </TableCell>
                <TableCell className="text-center">
                  <Skeleton className="h-6 w-16 mx-auto rounded-full" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-medium text-slate-500 dark:text-slate-400">Client ID</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400">Name</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400">Email</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400">Phone</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Team Members</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Status</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={7}
                className="text-center py-16 text-muted-foreground"
              >
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-400">
                    <UsersRound className="w-8 h-8" />
                  </div>
                  <p className="text-base font-medium text-slate-900 dark:text-slate-100">No clients yet</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                    Get started by adding your first client to manage their details and team assignments.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => {
              const isActive = client.status === "active";
              return (
                <TableRow key={client._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                  <TableCell className="font-mono text-slate-500 dark:text-slate-400 text-sm">
                    {client.clientId}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                    {client.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[150px] text-slate-600 dark:text-slate-300">
                        {client.emails?.[0] || "-"}
                      </span>
                      {client.emails && client.emails.length > 1 && (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                          +{client.emails.length - 1}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-300">
                    {client.phone || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-default hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-md transition-colors text-slate-600 dark:text-slate-300">
                            <Users className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold text-sm">
                              {client.teamMembers?.length || 0}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="p-3 min-w-[150px] shadow-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        >
                          {client.teamMembers &&
                          client.teamMembers.length > 0 ? (
                            <div className="space-y-2">
                              <ul className="space-y-1.5">
                                {client.teamMembers.map((member, idx) => (
                                  <li key={idx} className="flex flex-col">
                                    <span className="font-medium text-sm">
                                      {idx + 1}. {member.name}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No team members assigned</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline" 
                      className={isActive 
                        ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50" 
                        : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50"
                      }
                    >
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100" asChild>
                        <Link href={`/clients/${client._id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {!isTelemarketer && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                          onClick={() => onEdit(client)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
