'use client';

import { useState, useMemo } from 'react';
import { useSession } from '@/lib/auth-client';
import { Role } from '@/constants/role';
import {
    useGetMyTasksQuery,
    useSubmitTaskMutation,
} from '@/redux/features/task/taskApi';
import { useGetStaffsQuery } from '@/redux/features/staff/staffApi';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { format, isPast } from 'date-fns';
import { toast } from 'sonner';
import { KanbanBoard } from '@/components/tasks/kanban/KanbanBoard';
import { AssignTaskModal } from '@/components/tasks/AssignTaskModal';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import {
    ClipboardList,
    Send,
    CheckCircle2,
    LayoutGrid,
    List,
    Plus,
    Edit3,
    Clock,
    Paperclip,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MyTasksPage() {
    const { data: session } = useSession();
    const role = session?.user?.role;
    const canManage = useMemo(() => {
        return role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.HR_MANAGER || role === Role.TEAM_LEADER;
    }, [role]);

    const { data: tasksRes, isLoading } = useGetMyTasksQuery(undefined);
    const { data: staffsData } = useGetStaffsQuery({ limit: 100 });
    const staffs = staffsData?.staffs || [];

    const [submitTask, { isLoading: isSubmitting }] = useSubmitTaskMutation();

    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [editTaskData, setEditTaskData] = useState<any>(null);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [submissionLink, setSubmissionLink] = useState('');
    const [submissionNote, setSubmissionNote] = useState('');

    const tasks = tasksRes?.data || [];

    // Metrics computation
    const metrics = useMemo(() => {
        const total = tasks.length;
        const pending = tasks.filter((t: any) => t.status === 'pending' || t.status === 'rejected').length;
        const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
        const underReview = tasks.filter((t: any) => t.status === 'under_review').length;
        const completed = tasks.filter((t: any) => t.status === 'completed').length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, pending, inProgress, underReview, completed, pct };
    }, [tasks]);

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
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to submit task work.');
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <Skeleton className="h-12 w-64 rounded-xl" />
                <div className="grid gap-6">
                    <Skeleton className="h-28 rounded-xl" />
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6 max-w-7xl">
            {/* Header Section */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800/40">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                    Tasks & Board
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                    Manage task assignments, feature checklists, and active order deliverables.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setIsAssignModalOpen(true)}
                                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                            >
                                <Plus className="h-4 w-4" />
                                Assign Task
                            </button>
                        )}

                        {/* View Mode Toggle */}
                        <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/80">
                            <button
                                type="button"
                                onClick={() => setViewMode('kanban')}
                                className={cn(
                                    'h-7 px-3 text-xs font-medium gap-1.5 rounded-md flex items-center transition-colors',
                                    viewMode === 'kanban' 
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                )}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                Kanban
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    'h-7 px-3 text-xs font-medium gap-1.5 rounded-md flex items-center transition-colors',
                                    viewMode === 'list' 
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                )}
                            >
                                <List className="h-3.5 w-3.5" />
                                List View
                            </button>
                        </div>
                    </div>
                </div>

                {/* Clean Pure Tailwind Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Tasks</span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{metrics.total}</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">100%</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">In Progress</span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{metrics.inProgress}</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">Active</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Under Review</span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-2xl font-semibold text-amber-500">{metrics.underReview}</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">Pending</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Completed Pace</span>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                                <span>{metrics.completed} Done</span>
                                <span>{metrics.pct}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                    style={{ width: `${metrics.pct}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content View */}
            {viewMode === 'kanban' ? (
                <KanbanBoard
                    tasks={tasks}
                    canManage={canManage}
                    onEditTask={setEditTaskData}
                    onSubmitTask={handleOpenSubmit}
                    staffs={staffs}
                />
            ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6">
                    <CheckCircle2 className="h-10 w-10 text-slate-400 opacity-50" />
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">All caught up!</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            You currently have no active tasks needing action.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map((task: any) => {
                        const isOverdue = isPast(new Date(task.dueDate)) && task.status !== 'completed';
                        const assigneeName = task.assignedTo?.userId?.name || task.assignedTo?.name || 'Unassigned';

                        return (
                            <div
                                key={task._id}
                                className={cn(
                                    "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-xs",
                                    isOverdue && "border-red-300 dark:border-red-800/60 bg-red-50/10 dark:bg-red-950/10"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={cn(
                                                "px-2 py-0.5 text-[10px] font-medium rounded uppercase",
                                                task.priority === 'urgent' && "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
                                                task.priority === 'high' && "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
                                                task.priority === 'medium' && "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
                                                task.priority === 'low' && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                            )}>
                                                {task.priority}
                                            </span>
                                            {typeof task.orderId === 'object' && task.orderId?.orderNumber && (
                                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                                    #{task.orderId.orderNumber}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                            {task.title}
                                        </h3>
                                    </div>

                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() => setEditTaskData(task)}
                                            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0"
                                        >
                                            <Edit3 className="h-3.5 w-3.5" />
                                            Edit
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                    <div className="flex items-center justify-between">
                                        <span>Assigned to: <strong className="text-slate-900 dark:text-slate-100 font-semibold">{assigneeName}</strong></span>
                                        <span className="flex items-center gap-1 font-medium">
                                            <Clock className="h-3 w-3 text-slate-400" />
                                            {format(new Date(task.dueDate), 'MMM dd, hh:mm a')}
                                        </span>
                                    </div>

                                    {task.status === 'under_review' ? (
                                        <span className="inline-block px-2.5 py-1 text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded">
                                            Under Review
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenSubmit(task)}
                                            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5 transition-colors"
                                        >
                                            <Send className="h-3.5 w-3.5" />
                                            Submit Deliverables
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Submit Modal */}
            <Dialog open={isSubmitModalOpen} onOpenChange={setIsSubmitModalOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                            <Send className="h-4 w-4 text-blue-600" />
                            Submit Work Deliverables
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Attach reference links and detailed notes for review.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                Reference Link (GitHub, Drive, Figma)
                            </label>
                            <input
                                type="url"
                                placeholder="https://..."
                                value={submissionLink}
                                onChange={(e) => setSubmissionLink(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                Notes / Completion Summary <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                placeholder="Summary of work completed..."
                                value={submissionNote}
                                onChange={(e) => setSubmissionNote(e.target.value)}
                                className="w-full min-h-[90px] p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <button
                            type="button"
                            onClick={() => setIsSubmitModalOpen(false)}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !submissionNote.trim()}
                            className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Work'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Task Modal */}
            <EditTaskModal
                open={!!editTaskData}
                onOpenChange={(open) => !open && setEditTaskData(null)}
                task={editTaskData}
            />

            {/* Assign Task Modal */}
            <AssignTaskModal
                open={isAssignModalOpen}
                onOpenChange={setIsAssignModalOpen}
                existingTasks={tasks}
            />
        </div>
    );
}
