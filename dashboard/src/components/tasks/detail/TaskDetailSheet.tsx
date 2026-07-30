'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    useUpdateTaskStatusMutation,
    useReviewTaskMutation,
    useToggleSubtaskMutation,
    useDeleteTaskMutation,
} from '@/redux/features/task/taskApi';
import {
    getTaskSubtasks,
    getTaskProgress,
    isTaskOverdue,
    isTaskBlocked,
    getAssigneeName,
    getOrderLabel,
    STATUS_LABEL,
    PRIORITY_LABEL,
    type TaskItem,
} from '@/lib/task-progress';
import { cn } from '@/lib/utils';
import { CalendarClock, CheckCircle2, Edit3, PlayCircle, Send, Trash2, XCircle } from 'lucide-react';

interface TaskDetailSheetProps {
    task: TaskItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canManage: boolean;
    onEdit?: (task: TaskItem) => void;
    onSubmit?: (task: TaskItem) => void;
}

const STATUS_BADGE_CLASS: Record<TaskItem['status'], string> = {
    pending: 'bg-muted text-muted-foreground border-transparent',
    in_progress: 'bg-primary/10 text-primary border-transparent',
    under_review: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent',
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent',
    rejected: 'bg-destructive/10 text-destructive border-transparent',
};

const PRIORITY_BADGE_CLASS: Record<TaskItem['priority'], string> = {
    low: 'bg-muted text-muted-foreground border-transparent',
    medium: 'bg-primary/10 text-primary border-transparent',
    high: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent',
    urgent: 'bg-destructive/10 text-destructive border-transparent',
};

export function TaskDetailSheet({ task, open, onOpenChange, canManage, onEdit, onSubmit }: TaskDetailSheetProps) {
    const [updateTaskStatus] = useUpdateTaskStatusMutation();
    const [reviewTask] = useReviewTaskMutation();
    const [toggleSubtask] = useToggleSubtaskMutation();
    const [deleteTask] = useDeleteTaskMutation();

    const subtasks = useMemo(() => (task ? getTaskSubtasks(task) : []), [task]);
    const progress = useMemo(() => (task ? getTaskProgress(task) : { completed: 0, total: 0, pct: 0 }), [task]);

    if (!task) return null;

    const overdue = isTaskOverdue(task);
    const blocked = isTaskBlocked(task);
    const assigneeName = getAssigneeName(task.assignedTo);
    const roleLabel = typeof task.assignedTo === 'object' ? task.assignedTo?.designation : undefined;
    const orderLabel = getOrderLabel(task.orderId);
    const clientName =
        typeof task.orderId === 'object' ? task.orderId?.quotationSnapshot?.clientName : undefined;

    const handleQuickStatus = async (status: string) => {
        try {
            await updateTaskStatus({ taskId: task._id, status, currentStatus: task.status }).unwrap();
            toast.success('Task status updated');
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to update status');
        }
    };

    const handleReview = async (decision: 'approve' | 'reject') => {
        try {
            await reviewTask({ taskId: task._id, data: { decision, note: `Task ${decision}d.` } }).unwrap();
            toast.success(`Task ${decision}d`);
        } catch {
            toast.error('Failed to submit review');
        }
    };

    const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
        if (subtaskId.startsWith('fallback_')) return;
        try {
            await toggleSubtask({ taskId: task._id, subtaskId, completed: !completed }).unwrap();
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to toggle checklist item');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await deleteTask(task._id).unwrap();
            toast.success('Task deleted');
            onOpenChange(false);
        } catch {
            toast.error('Failed to delete task');
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader className="border-b">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn('capitalize', STATUS_BADGE_CLASS[task.status])}>
                            {blocked ? 'Blocked' : STATUS_LABEL[task.status]}
                        </Badge>
                        <Badge variant="outline" className={cn('capitalize', PRIORITY_BADGE_CLASS[task.priority])}>
                            {PRIORITY_LABEL[task.priority]}
                        </Badge>
                        {overdue && (
                            <Badge className="bg-destructive/10 text-destructive border-transparent">Overdue</Badge>
                        )}
                    </div>
                    <SheetTitle className="text-base leading-snug">{task.title}</SheetTitle>
                    {(orderLabel || clientName) && (
                        <SheetDescription className="font-mono text-xs">
                            {[orderLabel, clientName].filter(Boolean).join(' · ')}
                        </SheetDescription>
                    )}
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-4 space-y-5">
                    {/* Assignee */}
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                            <AvatarFallback className="text-xs font-bold bg-muted">
                                {assigneeName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{assigneeName}</p>
                            {roleLabel && <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>}
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 rounded-lg border bg-muted/30 space-y-0.5">
                            <span className="text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" /> Due
                            </span>
                            <p className={cn('font-semibold', overdue && 'text-destructive')}>
                                {format(new Date(task.dueDate), 'MMM dd, yyyy · hh:mm a')}
                            </p>
                        </div>
                        <div className="p-2.5 rounded-lg border bg-muted/30 space-y-0.5">
                            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Created</span>
                            <p className="font-semibold">{format(new Date(task.createdAt), 'MMM dd, yyyy')}</p>
                        </div>
                    </div>

                    {/* Progress */}
                    {subtasks.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-medium">
                                <span>
                                    Checklist ({progress.completed}/{progress.total})
                                </span>
                                <span className="font-mono text-muted-foreground">{progress.pct}%</span>
                            </div>
                            <Progress value={progress.pct} className="h-2" />
                            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                {subtasks.map((st) => (
                                    <label
                                        key={st._id}
                                        className={cn(
                                            'flex items-start gap-2 p-2 rounded-md border text-xs cursor-pointer select-none',
                                            st.completed
                                                ? 'bg-emerald-500/5 border-emerald-500/20'
                                                : 'bg-muted/20 border-border/60 hover:bg-muted/40'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={st.completed}
                                            onChange={() => handleToggleSubtask(st._id, st.completed)}
                                            className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary shrink-0"
                                        />
                                        <span className={cn(st.completed && 'line-through text-muted-foreground')}>
                                            {st.title}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {task.description && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Description
                            </span>
                            <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-line bg-muted/20 border rounded-lg p-3">
                                {task.description}
                            </p>
                        </div>
                    )}

                    {/* Submission / Review notes */}
                    {task.submissionNote && (
                        <div className="p-3 rounded-lg border-l-4 border-primary bg-primary/5 space-y-1">
                            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                                Submitted work
                            </span>
                            <p className="text-xs italic">&ldquo;{task.submissionNote}&rdquo;</p>
                            {task.submissionAttachment && (
                                <a
                                    href={task.submissionAttachment}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-medium text-primary underline underline-offset-2"
                                >
                                    View attachment
                                </a>
                            )}
                        </div>
                    )}
                    {blocked && task.reviewNote && (
                        <div className="p-3 rounded-lg border-l-4 border-destructive bg-destructive/5 space-y-1">
                            <span className="text-[10px] font-semibold text-destructive uppercase tracking-wider">
                                Revision note
                            </span>
                            <p className="text-xs">{task.reviewNote}</p>
                        </div>
                    )}
                </div>

                <SheetFooter className="border-t flex-row flex-wrap gap-2">
                    {canManage && onEdit && (
                        <Button variant="outline" size="sm" onClick={() => onEdit(task)} className="gap-1.5">
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                        </Button>
                    )}

                    {task.status !== 'in_progress' && task.status !== 'completed' && (
                        <Button size="sm" variant="outline" onClick={() => handleQuickStatus('in_progress')} className="gap-1.5">
                            <PlayCircle className="h-3.5 w-3.5" /> Start Progress
                        </Button>
                    )}

                    {task.status === 'in_progress' && onSubmit && (
                        <Button size="sm" onClick={() => onSubmit(task)} className="gap-1.5">
                            <Send className="h-3.5 w-3.5" /> Submit for Review
                        </Button>
                    )}

                    {task.status === 'under_review' && canManage && (
                        <>
                            <Button
                                size="sm"
                                onClick={() => handleReview('approve')}
                                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReview('reject')} className="gap-1.5 text-destructive">
                                <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                        </>
                    )}

                    {canManage && (
                        <Button size="sm" variant="ghost" onClick={handleDelete} className="gap-1.5 text-destructive ml-auto">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
