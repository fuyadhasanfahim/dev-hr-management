'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { useSession } from '@/lib/auth-client';
import { Role } from '@/constants/role';
import { DESIGNATION_LABELS, type Designation } from '@/constants/designation';
import { useGetMyTasksQuery, useSubmitTaskMutation } from '@/redux/features/task/taskApi';
import { useGetStaffsQuery } from '@/redux/features/staff/staffApi';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { KanbanBoard } from '@/components/tasks/kanban/KanbanBoard';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import { TaskDetailSheet } from '@/components/tasks/detail/TaskDetailSheet';
import {
    getCurrentTask,
    getTaskProgress,
    getOrderLabel,
    isTaskOverdue,
    countActiveTasks,
    getWorkloadStatus,
    STATUS_LABEL,
    PRIORITY_LABEL,
    type TaskItem,
    type WorkloadStatus,
} from '@/lib/task-progress';
import { cn } from '@/lib/utils';
import { ArrowLeft, CalendarClock, Send, UserRound } from 'lucide-react';

const AVAILABILITY_META: Record<WorkloadStatus, { label: string; badge: string }> = {
    available: { label: 'Available', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent' },
    busy: { label: 'Busy', badge: 'bg-primary/10 text-primary border-transparent' },
    at_capacity: { label: 'At Capacity', badge: 'bg-destructive/10 text-destructive border-transparent' },
};

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

export default function TeamMemberTaskDetailsPage() {
    const params = useParams<{ staffId: string }>();
    const staffId = params.staffId;

    const { data: session } = useSession();
    const role = session?.user?.role;
    const canManage = useMemo(
        () => role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.HR_MANAGER || role === Role.TEAM_LEADER,
        [role]
    );

    const { data: tasksRes, isLoading: isTasksLoading } = useGetMyTasksQuery(undefined);
    const { data: staffsData, isLoading: isStaffsLoading } = useGetStaffsQuery({ limit: 100 });
    const [submitTask, { isLoading: isSubmitting }] = useSubmitTaskMutation();

    const [editTaskData, setEditTaskData] = useState<any>(null);
    const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [submissionLink, setSubmissionLink] = useState('');
    const [submissionNote, setSubmissionNote] = useState('');

    const staff = useMemo(
        () => (staffsData?.staffs || []).find((s: any) => s._id === staffId),
        [staffsData, staffId]
    );

    const memberTasks: TaskItem[] = useMemo(() => {
        const all: TaskItem[] = tasksRes?.data || [];
        return all.filter((t) => {
            const assigneeId = typeof t.assignedTo === 'object' ? t.assignedTo?._id : t.assignedTo;
            return assigneeId === staffId;
        });
    }, [tasksRes, staffId]);

    const currentTask = useMemo(() => getCurrentTask(memberTasks), [memberTasks]);
    // Re-derived from the live query cache every render so the sheet always
    // reflects the latest checklist/status instead of a frozen snapshot.
    const detailTask = useMemo(() => memberTasks.find((t) => t._id === detailTaskId) || null, [memberTasks, detailTaskId]);
    const activeCount = countActiveTasks(memberTasks);
    const workloadStatus = getWorkloadStatus(activeCount);
    const completedCount = memberTasks.filter((t) => t.status === 'completed').length;
    const overdueCount = memberTasks.filter((t) => isTaskOverdue(t)).length;
    const completionRate = memberTasks.length > 0 ? Math.round((completedCount / memberTasks.length) * 100) : 0;

    const handleOpenSubmit = (task: any) => {
        setSelectedTask(task);
        setSubmissionLink('');
        setSubmissionNote('');
        setIsSubmitModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!submissionNote.trim()) {
            toast.error('Please enter a brief submission note.');
            return;
        }
        try {
            await submitTask({
                taskId: selectedTask._id,
                data: { note: submissionNote, attachment: submissionLink || undefined },
            }).unwrap();
            toast.success('Deliverables submitted for review!');
            setIsSubmitModalOpen(false);
            setDetailTaskId(null);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to submit task work.');
        }
    };

    if (isTasksLoading || isStaffsLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6 max-w-6xl">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-96 rounded-xl" />
            </div>
        );
    }

    if (!staff) {
        return (
            <div className="container mx-auto p-6 max-w-6xl">
                <Link href="/tasks" className="text-xs font-medium text-primary flex items-center gap-1 mb-4">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Team Workload
                </Link>
                <div className="flex flex-col items-center justify-center py-20 text-center gap-2 bg-card border border-dashed rounded-lg">
                    <UserRound className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">Team member not found.</p>
                </div>
            </div>
        );
    }

    const name = staff.user?.name || staff.name || 'Team Member';
    const designationLabel = DESIGNATION_LABELS[staff.designation as Designation] || staff.designation || 'Team Member';
    const availMeta = AVAILABILITY_META[workloadStatus];

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-6xl">
            <Link href="/tasks" className="text-xs font-medium text-primary flex items-center gap-1 w-fit">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Team Workload
            </Link>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b">
                <div className="flex items-center gap-3.5">
                    <Avatar className="h-14 w-14 border">
                        <AvatarFallback className="text-base font-bold bg-muted">
                            {name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-semibold">{name}</h1>
                            <Badge className={availMeta.badge}>{availMeta.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{designationLabel}</p>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4 sm:gap-6 text-center">
                    <div>
                        <p className="text-lg font-semibold">{activeCount}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</p>
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{completedCount}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completed</p>
                    </div>
                    <div>
                        <p className={cn('text-lg font-semibold', overdueCount > 0 ? 'text-destructive' : '')}>{overdueCount}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overdue</p>
                    </div>
                    <div>
                        <p className="text-lg font-semibold">{completionRate}%</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completion</p>
                    </div>
                </div>
            </div>

            {/* Current Work */}
            <div className="space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Work</h2>
                {currentTask ? (
                    (() => {
                        const progress = getTaskProgress(currentTask);
                        const orderLabel = getOrderLabel(currentTask.orderId);
                        const overdue = isTaskOverdue(currentTask);
                        return (
                            <div className="p-4 bg-card border rounded-lg space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge className={cn('capitalize', STATUS_BADGE_CLASS[currentTask.status])}>
                                                {currentTask.status === 'rejected' ? 'Blocked' : STATUS_LABEL[currentTask.status]}
                                            </Badge>
                                            <Badge variant="outline" className={cn('capitalize', PRIORITY_BADGE_CLASS[currentTask.priority])}>
                                                {PRIORITY_LABEL[currentTask.priority]}
                                            </Badge>
                                            {overdue && <Badge className="bg-destructive/10 text-destructive border-transparent">Overdue</Badge>}
                                        </div>
                                        <p className="text-sm font-semibold truncate">{currentTask.title}</p>
                                        {orderLabel && <p className="text-[11px] text-muted-foreground font-mono">{orderLabel}</p>}
                                    </div>
                                    <div className={cn('flex items-center gap-1 text-xs shrink-0', overdue ? 'text-destructive font-semibold' : 'text-muted-foreground')}>
                                        <CalendarClock className="h-3.5 w-3.5" />
                                        {format(new Date(currentTask.dueDate), 'MMM dd')}
                                    </div>
                                </div>

                                {progress.total > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Progress value={progress.pct} className="h-1.5 flex-1" />
                                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                                            {progress.completed}/{progress.total} · {progress.pct}%
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 pt-1">
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDetailTaskId(currentTask._id)}>
                                        Open Task
                                    </Button>
                                    {progress.total > 0 && (
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetailTaskId(currentTask._id)}>
                                            Update Progress
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div className="p-4 bg-card border border-dashed rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">No active task — this member is available for new work.</p>
                    </div>
                )}
            </div>

            {/* Member Kanban */}
            <div className="space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Tasks</h2>
                {memberTasks.length === 0 ? (
                    <div className="p-8 bg-card border border-dashed rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">No tasks have been assigned to {name.split(' ')[0]} yet.</p>
                    </div>
                ) : (
                    <KanbanBoard
                        tasks={memberTasks}
                        canManage={canManage}
                        onEditTask={setEditTaskData}
                        onSubmitTask={handleOpenSubmit}
                        onOpenDetail={(task) => setDetailTaskId(task._id)}
                    />
                )}
            </div>

            {/* Submit Modal */}
            <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                            <Send className="h-4 w-4 text-primary" />
                            Submit Work Deliverables
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Attach reference links and detailed notes for review.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Reference Link (GitHub, Drive, Figma)</Label>
                            <Input
                                type="url"
                                placeholder="https://..."
                                value={submissionLink}
                                onChange={(e) => setSubmissionLink(e.target.value)}
                                className="h-9 text-xs font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">
                                Notes / Completion Summary <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                placeholder="Summary of work completed..."
                                value={submissionNote}
                                onChange={(e) => setSubmissionNote(e.target.value)}
                                className="min-h-[90px] text-xs resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsSubmitModalOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !submissionNote.trim()}>
                            {isSubmitting ? 'Submitting...' : 'Submit Work'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <TaskDetailSheet
                task={detailTask}
                open={!!detailTaskId}
                onOpenChange={(open) => !open && setDetailTaskId(null)}
                canManage={canManage}
                onEdit={(task) => {
                    setDetailTaskId(null);
                    setEditTaskData(task);
                }}
                onSubmit={(task) => {
                    setDetailTaskId(null);
                    handleOpenSubmit(task);
                }}
            />

            <EditTaskModal
                open={!!editTaskData}
                onOpenChange={(open) => !open && setEditTaskData(null)}
                task={editTaskData}
            />
        </div>
    );
}
