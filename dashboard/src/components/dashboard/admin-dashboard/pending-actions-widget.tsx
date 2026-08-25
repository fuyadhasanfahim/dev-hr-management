"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  useGetPendingLeavesQuery,
  useApproveLeaveMutation,
  useRejectLeaveMutation,
} from "@/redux/features/leave/leaveApi";
import { CheckCircle2, XCircle, Calendar, ArrowRight, PlaneTakeoff } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";

export function PendingActionsWidget() {
  const { data: pendingLeavesData, isLoading: isLeavesLoading } = useGetPendingLeavesQuery(undefined, {
    pollingInterval: 30000,
  });

  const [approveLeave, { isLoading: isApproving }] = useApproveLeaveMutation();
  const [rejectLeave, { isLoading: isRejecting }] = useRejectLeaveMutation();
  const [actionId, setActionId] = React.useState<string | null>(null);

  const pendingLeaves = pendingLeavesData?.data || [];
  const totalPending = pendingLeaves.length;

  const handleApprove = async (id: string, requestedDates?: string[]) => {
    setActionId(id);
    try {
      await approveLeave({
        id,
        data: {
          approvedDates: requestedDates && requestedDates.length > 0 ? requestedDates : undefined,
          comment: "Approved via Dashboard Quick Action",
        },
      }).unwrap();
      toast.success("Leave approved successfully");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to approve leave");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionId(id);
    try {
      await rejectLeave({ id, comment: "Rejected via Dashboard Action Center" }).unwrap();
      toast.success("Leave rejected");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to reject leave");
    } finally {
      setActionId(null);
    }
  };

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <PlaneTakeoff className="size-5 text-primary" />
            Pending Leave Approvals
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Staff leave applications awaiting HR & Admin action
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className={
            "px-2.5 py-0.5 " +
            (totalPending > 0
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              : "bg-muted text-muted-foreground border-border")
          }
        >
          {totalPending} Pending
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {isLeavesLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Spinner />
          </div>
        ) : pendingLeaves.length === 0 ? (
          <div className="h-[180px] flex flex-col items-center justify-center text-center p-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
              <CheckCircle2 className="size-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">All Clear!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No leave requests currently require approval
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingLeaves.slice(0, 4).map((leave) => {
              const staff = leave.staffId as any;
              const staffName = staff?.userId?.name || staff?.name || "Staff Member";
              const initials = staffName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              const startDateStr = leave.startDate ? format(new Date(leave.startDate), "MMM dd") : "";
              const endDateStr = leave.endDate ? format(new Date(leave.endDate), "MMM dd") : "";
              const daysCount = leave.requestedDates?.length || 1;
              const isWorking = actionId === leave._id;

              return (
                <div
                  key={leave._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 gap-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{staffName}</span>
                        <Badge variant="secondary" className="text-[10px] capitalize px-1.5 py-0">
                          {leave.leaveType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="size-3 text-muted-foreground" />
                        <span>
                          {startDateStr} - {endDateStr} ({daysCount} {daysCount === 1 ? "day" : "days"})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/50"
                      onClick={() => handleReject(leave._id)}
                      disabled={isWorking}
                    >
                      <XCircle className="size-3.5 mr-1 text-rose-500" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleApprove(leave._id, leave.requestedDates)}
                      disabled={isWorking}
                    >
                      {isWorking && isApproving ? (
                        <Spinner />
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}

            {pendingLeaves.length > 4 && (
              <div className="pt-2 text-center">
                <Link
                  href="/leave/manage"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  View all {pendingLeaves.length} pending requests <ArrowRight className="size-3" />
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
