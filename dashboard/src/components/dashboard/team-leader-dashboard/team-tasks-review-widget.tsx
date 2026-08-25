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
import { Progress } from "@/components/ui/progress";
import {
  TaskItem,
  useReviewTaskMutation,
} from "@/redux/features/task/taskApi";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";

interface TeamTasksReviewWidgetProps {
  tasks: TaskItem[];
  isLoading?: boolean;
}

export function TeamTasksReviewWidget({ tasks, isLoading }: TeamTasksReviewWidgetProps) {
  const [reviewTask, { isLoading: isReviewing }] = useReviewTaskMutation();
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);

  // Filter review tasks first, then in-progress tasks
  const reviewTasks = React.useMemo(() => {
    const underReview = tasks.filter((t) => t.status === "under_review");
    const others = tasks.filter((t) => t.status !== "under_review" && t.status !== "completed");
    return [...underReview, ...others];
  }, [tasks]);

  const pendingReviewCount = tasks.filter((t) => t.status === "under_review").length;

  const handleApprove = async (taskId: string) => {
    setActiveTaskId(taskId);
    try {
      await reviewTask({
        taskId,
        data: { decision: "approve", note: "Approved by Team Leader" },
      }).unwrap();
      toast.success("Task approved and completed!");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to approve task");
    } finally {
      setActiveTaskId(null);
    }
  };

  const handleRequestRevision = async (taskId: string) => {
    setActiveTaskId(taskId);
    try {
      await reviewTask({
        taskId,
        data: { decision: "reject", note: "Needs revision. Please check details." },
      }).unwrap();
      toast.warning("Revision requested for task");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to request revision");
    } finally {
      setActiveTaskId(null);
    }
  };

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            Team Tasks & Reviews
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Submissions & active tasks assigned to your team
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          className={
            "px-2.5 py-0.5 " +
            (pendingReviewCount > 0
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              : "bg-muted text-muted-foreground")
          }
        >
          {pendingReviewCount} In Review
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Spinner />
          </div>
        ) : reviewTasks.length === 0 ? (
          <div className="h-[180px] flex flex-col items-center justify-center text-center p-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
              <CheckCircle2 className="size-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">No Tasks Pending</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All team assignments are up to date
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewTasks.slice(0, 4).map((task) => {
              const assignee = task.assignedTo as any;
              const assigneeName = assignee?.name || assignee?.userId?.name || "Team Member";
              const initials = assigneeName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              const subtasks = task.subtasks || [];
              const completedSubtasks = subtasks.filter((s) => s.completed).length;
              const progressPct =
                subtasks.length > 0
                  ? Math.round((completedSubtasks / subtasks.length) * 100)
                  : task.status === "completed"
                  ? 100
                  : 0;

              const isUnderReview = task.status === "under_review";
              const isWorking = activeTaskId === task._id;

              return (
                <div
                  key={task._id}
                  className="p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Avatar className="size-8 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-bold text-foreground truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span>{assigneeName}</span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span>Due {format(new Date(task.dueDate), "MMM dd")}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={
                        "text-[10px] capitalize shrink-0 " +
                        (isUnderReview
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 font-semibold"
                          : task.status === "in_progress"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {task.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {/* Subtask progress bar */}
                  {subtasks.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Checklist progress</span>
                        <span>
                          {completedSubtasks}/{subtasks.length} ({progressPct}%)
                        </span>
                      </div>
                      <Progress value={progressPct} className="h-1.5" />
                    </div>
                  )}

                  {/* Action row for under_review tasks */}
                  {isUnderReview && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200"
                        onClick={() => handleRequestRevision(task._id)}
                        disabled={isWorking}
                      >
                        <RefreshCw className="size-3 mr-1" /> Revision
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-3 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(task._id)}
                        disabled={isWorking}
                      >
                        {isWorking && isReviewing ? (
                          <Spinner />
                        ) : (
                          <>
                            <CheckCircle2 className="size-3 mr-1" /> Approve
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {reviewTasks.length > 4 && (
              <div className="pt-2 text-center">
                <Link
                  href="/tasks"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  View all tasks <ArrowRight className="size-3" />
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
