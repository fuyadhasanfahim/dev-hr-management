'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { Role } from '@/constants/role';
import { DESIGNATION_LABELS, type Designation } from '@/constants/designation';
import {
    useGetMyTasksQuery,
    useSubmitTaskMutation,
} from '@/redux/features/task/taskApi';
import { useGetStaffsQuery, useGetMeQuery } from '@/redux/features/staff/staffApi';
import { usePermissions } from '@/hooks/use-permissions';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
import { AssignTaskModal } from '@/components/tasks/AssignTaskModal';
import { EditTaskModal } from '@/components/tasks/EditTaskModal';
import { TaskDetailSheet } from '@/components/tasks/detail/TaskDetailSheet';
import { WorkloadSummary } from '@/components/tasks/workload/WorkloadSummary';
import { WorkloadFilters, type WorkloadFiltersState } from '@/components/tasks/workload/WorkloadFilters';
import { WorkloadTable, type MemberRow } from '@/components/tasks/workload/WorkloadTable';
import {
    getCurrentTask,
    countActiveTasks,
    getWorkloadStatus,
    isTaskBlocked,
    isTaskOverdue,
    type TaskItem,
} from '@/lib/task-progress';
import { ClipboardList, LayoutGrid, LayoutList, Plus, Send } from 'lucide-react';

const DEFAULT_FILTERS: WorkloadFiltersState = {
    search: '',
    role: 'all',
    status: 'all',
    priority: 'all',
    availability: 'all',
    project: 'all',
};

export default function TeamWorkloadPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const role = session?.user?.role;
    const { data: meData } = useGetMeQuery(undefined, { skip: !session });

    useEffect(() => {
        if (role && role !== Role.SUPER_ADMIN && role !== Role.ADMIN) {
            if (meData?.staff?._id) {
                router.replace(`/tasks/member/${meData.staff._id}`);
            }
        }
    }, [role, meData, router]);

    const { can } = usePermissions();
    const canManage = useMemo(() => {
        return role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.HR_MANAGER || role === Role.TEAM_LEADER;
    }, [role]);
    const canCreateTask = can('task.create');

    const { data: tasksRes, isLoading } = useGetMyTasksQuery(undefined);
    const { data: staffsData } = useGetStaffsQuery({ limit: 100 });
    const staffs = staffsData?.staffs || [];

    const [submitTask, { isLoading: isSubmitting }] = useSubmitTaskMutation();

    const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
    const [filters, setFilters] = useState<WorkloadFiltersState>(DEFAULT_FILTERS);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [editTaskData, setEditTaskData] = useState<any>(null);
    const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [submissionLink, setSubmissionLink] = useState('');
    const [submissionNote, setSubmissionNote] = useState('');

    const tasks: TaskItem[] = tasksRes?.data || [];

    // Re-derived from the live query cache every render so toggling a checklist
    // item or changing status inside the sheet reflects immediately instead of
    // being frozen at the snapshot captured when the sheet was opened.
    const detailTask = useMemo(() => tasks.find((t) => t._id === detailTaskId) || null, [tasks, detailTaskId]);

    // Group tasks by staff member (source of truth for the workload table)
    const allMembers: MemberRow[] = useMemo(() => {
        const tasksByStaff = new Map<string, TaskItem[]>();
        tasks.forEach((t) => {
            const staffId = typeof t.assignedTo === 'object' ? t.assignedTo?._id : t.assignedTo;
            if (!staffId) return;
            if (!tasksByStaff.has(staffId)) tasksByStaff.set(staffId, []);
            tasksByStaff.get(staffId)!.push(t);
        });

        return staffs.map((staff: any) => {
            const staffTasks = tasksByStaff.get(staff._id) || [];
            const currentTask = getCurrentTask(staffTasks);
            const activeCount = countActiveTasks(staffTasks);
            return {
                staffId: staff._id,
                name: staff.user?.name || staff.name || 'Team Member',
                designationLabel: DESIGNATION_LABELS[staff.designation as Designation] || staff.designation || 'Team Member',
                designationValue: staff.designation,
                currentTask,
                activeCount,
                totalCount: staffTasks.length,
                workloadStatus: getWorkloadStatus(activeCount),
            } as MemberRow & { designationValue: string };
        });
    }, [tasks, staffs]);

    const roleOptions = useMemo(() => {
        const set = new Set<string>();
        staffs.forEach((s: any) => s.designation && set.add(s.designation));
        return Array.from(set).map((d) => ({ value: d, label: DESIGNATION_LABELS[d as Designation] || d }));
    }, [staffs]);

    const projectOptions = useMemo(() => {
        const map = new Map<string, string>();
        tasks.forEach((t) => {
            if (typeof t.orderId === 'object' && t.orderId?.orderNumber) {
                map.set(t.orderId._id, `#${t.orderId.orderNumber}`);
            }
        });
        return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
    }, [tasks]);

    const filteredMembers = useMemo(() => {
        return allMembers.filter((m: any) => {
            if (filters.search.trim()) {
                const q = filters.search.toLowerCase();
                const nameMatch = m.name.toLowerCase().includes(q);
                const taskMatch = m.currentTask?.title?.toLowerCase().includes(q);
                if (!nameMatch && !taskMatch) return false;
            }
            if (filters.role !== 'all' && m.designationValue !== filters.role) return false;
            if (filters.availability !== 'all' && m.workloadStatus !== filters.availability) return false;
            if (filters.status !== 'all') {
                if (!m.currentTask) return false;
                if (filters.status === 'rejected') {
                    if (m.currentTask.status !== 'rejected') return false;
                } else if (m.currentTask.status !== filters.status) return false;
            }
            if (filters.priority !== 'all') {
                if (!m.currentTask || m.currentTask.priority !== filters.priority) return false;
            }
            if (filters.project !== 'all') {
                const orderId = typeof m.currentTask?.orderId === 'object' ? m.currentTask.orderId?._id : m.currentTask?.orderId;
                if (orderId !== filters.project) return false;
            }
            return true;
        });
    }, [allMembers, filters]);

    // Summary metrics — derived from the same real task/staff data as the table
    const metrics = useMemo(() => {
        const total = tasks.length;
        const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
        const blocked = tasks.filter((t) => isTaskBlocked(t)).length;
        const overdue = tasks.filter((t) => isTaskOverdue(t)).length;
        const availableMembers = allMembers.filter((m) => m.workloadStatus === 'available').length;
        return { total, inProgress, blocked, overdue, availableMembers };
    }, [tasks, allMembers]);

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

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <Skeleton className="h-12 w-64 rounded-xl" />
                <div className="grid gap-4">
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-96 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-5 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg border border-primary/20">
                        <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Team Workload</h1>
                        <p className="text-xs text-muted-foreground font-normal">
                            Track current assignments, progress, capacity, and task status across your team.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {canManage && canCreateTask && (
                        <Button size="sm" onClick={() => setIsAssignModalOpen(true)} className="gap-1.5">
                            <Plus className="h-4 w-4" />
                            Assign Task
                        </Button>
                    )}

                    <div className="inline-flex items-center p-1 bg-muted rounded-lg border">
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            onClick={() => setViewMode('table')}
                            className="h-7 px-3 text-xs gap-1.5"
                        >
                            <LayoutList className="h-3.5 w-3.5" />
                            List
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                            onClick={() => setViewMode('kanban')}
                            className="h-7 px-3 text-xs gap-1.5"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Kanban
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <WorkloadSummary
                totalTasks={metrics.total}
                inProgress={metrics.inProgress}
                blocked={metrics.blocked}
                overdue={metrics.overdue}
                availableMembers={metrics.availableMembers}
            />

            {viewMode === 'table' ? (
                <div className="space-y-4">
                    <WorkloadFilters value={filters} onChange={setFilters} roleOptions={roleOptions} projectOptions={projectOptions} />
                    <WorkloadTable members={filteredMembers} allMembers={allMembers} />
                </div>
            ) : (
                <KanbanBoard
                    tasks={tasks}
                    canManage={canManage}
                    onEditTask={setEditTaskData}
                    onSubmitTask={handleOpenSubmit}
                    onOpenDetail={(task) => setDetailTaskId(task._id)}
                    staffs={staffs}
                />
            )}

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

            {/* Task Detail Sheet (Kanban card click) */}
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
