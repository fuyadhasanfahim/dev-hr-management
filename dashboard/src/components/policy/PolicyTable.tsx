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
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Info, Pencil, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { StackedAvatars } from "@/components/policy/StackedAvatars";
import type { IPolicy } from "@/types/policy.type";

interface PolicyTableProps {
  policies: IPolicy[];
  isLoading: boolean;
  isAdmin: boolean;
  isToggling: boolean;
  onView: (policy: IPolicy) => void;
  onEdit: (policy: IPolicy) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
}

export function PolicyTable({
  policies,
  isLoading,
  isAdmin,
  isToggling,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
}: PolicyTableProps) {
  const colCount = isAdmin ? 6 : 4;

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
            Title
          </TableHead>
          {isAdmin ? (
            <>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Targeting
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Accepted By
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
            </>
          ) : (
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </TableHead>
          )}
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Created
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
              {isAdmin ? (
                <>
                  <TableCell><Skeleton className="h-3.5 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[90px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[70px]" /></TableCell>
                </>
              ) : (
                <TableCell><Skeleton className="h-3.5 w-[220px]" /></TableCell>
              )}
              <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
              <TableCell className="pr-6">
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-7 w-7 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))
        ) : policies.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colCount} className="h-40 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-brand-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No policies found matching your criteria.
                </p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          policies.map((policy) => (
            <TableRow key={policy._id} className="cursor-pointer" onClick={() => onView(policy)}>
              {/* Title */}
              <TableCell className="pl-6">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-foreground truncate max-w-[220px]">{policy.title}</span>
                  {policy.requiresAcceptance && (
                    <Badge variant="secondary" className="w-fit text-[10px] font-normal">
                      Requires Acceptance
                    </Badge>
                  )}
                </div>
              </TableCell>

              {isAdmin ? (
                <>
                  {/* Targeting */}
                  <TableCell>
                    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      <span>
                        Branch: {policy.branchId ? (policy.branchId as { name: string }).name : "Global"}
                      </span>
                      <span>Dept: {policy.department || "All"}</span>
                    </div>
                  </TableCell>

                  {/* Accepted By */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-1.5">
                      <StackedAvatars
                        users={policy.acceptedBy.map((a) => ({
                          _id: a.user._id,
                          name: a.user.name,
                          avatar: a.user.avatar,
                        }))}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {policy.acceptedBy.length} users accepted
                      </span>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Switch
                        title={policy.isActive ? "Deactivate" : "Activate"}
                        checked={policy.isActive}
                        onCheckedChange={() => onToggleStatus(policy._id, policy.isActive)}
                        disabled={isToggling}
                      />
                      <span className="text-xs text-muted-foreground">
                        {policy.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                </>
              ) : (
                <TableCell>
                  <p className="text-sm text-muted-foreground line-clamp-1 max-w-[400px]">
                    {policy.description}
                  </p>
                </TableCell>
              )}

              {/* Created */}
              <TableCell>
                <span className="text-muted-foreground text-sm whitespace-nowrap">
                  {format(new Date(policy.createdAt), "PPP")}
                </span>
              </TableCell>

              {/* Actions */}
              <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="View Content"
                    onClick={() => onView(policy)}
                    className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </Button>

                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit Policy"
                        onClick={() => onEdit(policy)}
                        className="h-7 w-7 text-muted-foreground hover:text-brand-accent hover:bg-brand-accent/10"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete Policy"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently
                              delete the policy and all acceptance records.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(policy._id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
