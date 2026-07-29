"use client";

import { useState, useMemo, useEffect } from "react";
import {
    useUpdateTaskStatusMutation,
    useReviewTaskMutation,
    useDeleteTaskMutation,
    useUpdateTaskMutation,
    useToggleSubtaskMutation,
} from "@/redux/features/task/taskApi";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Search,
    Filter,
    MoreVertical,
    Clock,
    CheckCircle2,
    XCircle,
    Trash2,
    Edit3,
    Send,
    PlayCircle,
    CheckSquare,
    ChevronDown,
    ChevronUp,
    User,
    Zap,
    Plus,
    AlertCircle,
    UserCheck,
    Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface SubTaskItem {
    _id: string;
    title: string;
    completed: boolean;
    completedAt?: string;
    isSubFeature?: boolean;
    parentName?: string;
}

export interface TaskItem {
    _id: string;
    title: string;
    description?: string;
    subtasks?: SubTaskItem[];
    status: "pending" | "in_progress" | "under_review" | "completed" | "rejected";
    priority: "low" | "medium" | "high" | "urgent";
    assignedTo?: {
        _id: string;
        name?: string;
        designation?: string;
        userId?: {
            _id: string;
            name: string;
            email: string;
            image?: string;
        };
    };
    orderId?: {
        _id: string;
        orderNumber: string;
        quotationSnapshot?: { clientName?: string };
    } | string;
    dueDate: string;
    submissionNote?: string;
    submissionAttachment?: string;
    reviewNote?: string;
    createdAt: string;
}

interface DeveloperBoardProps {
    tasks: TaskItem[];
    staffs: any[];
    canManage: boolean;
    onEditTask?: (task: TaskItem) => void;
    onSubmitTask?: (task: TaskItem) => void;
    onAssignTaskToStaff?: (staffId: string) => void;
}

function getTaskSubtasks(task: TaskItem): SubTaskItem[] {
    if (task.subtasks && task.subtasks.length > 0) {
        return task.subtasks;
    }
    if (task.description && task.description.includes("Selected Features & Sub-Features:\n- ")) {
        const parts = task.description.split("\n\nInstructions:\n");
        const featPart = parts[0];
        const lines = featPart.replace("Selected Features & Sub-Features:\n- ", "").split("\n- ");
        return lines
            .map((line, idx) => ({
                _id: `fallback_${idx}`,
                title: line.trim(),
                completed: task.status === 'completed',
            }))
            .filter((s) => s.title);
    }
    return [];
}

export function DeveloperBoard({
    tasks,
    staffs = [],
    canManage,
    onEditTask,
    onSubmitTask,
    onAssignTaskToStaff,
}: DeveloperBoardProps) {
    const [localTasks, setLocalTasks] = useState<TaskItem[]>(tasks);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPriority, setSelectedPriority] = useState<string>('all');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [assigneeMenuId, setAssigneeMenuId] = useState<string | null>(null);
    const [collapsedStaffs, setCollapsedStaffs] = useState<Record<string, boolean>>({});

    const [updateTaskStatus] = useUpdateTaskStatusMutation();
    const [reviewTask] = useReviewTaskMutation();
    const [deleteTask] = useDeleteTaskMutation();
    const [updateTask] = useUpdateTaskMutation();
    const [toggleSubtask] = useToggleSubtaskMutation();

    useEffect(() => {
        setLocalTasks(tasks);
    }, [tasks]);

    // Close open menus when clicking anywhere outside
    useEffect(() => {
        const handleClickOutside = () => {
            setActiveMenuId(null);
            setAssigneeMenuId(null);
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Filter tasks based on search & filters
    const filteredTasks = useMemo(() => {
        return localTasks.filter((t) => {
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const titleMatch = t.title.toLowerCase().includes(query);
                const descMatch = t.description?.toLowerCase().includes(query);
                const assigneeName = t.assignedTo?.userId?.name || t.assignedTo?.name || '';
                const staffMatch = assigneeName.toLowerCase().includes(query);
                if (!titleMatch && !descMatch && !staffMatch) return false;
            }

            if (selectedPriority !== 'all' && t.priority !== selectedPriority) {
                return false;
            }

            if (selectedStatusFilter !== 'all') {
                if (selectedStatusFilter === 'pending' && (t.status !== 'pending' && t.status !== 'rejected')) return false;
                if (selectedStatusFilter !== 'pending' && t.status !== selectedStatusFilter) return false;
            }

            return true;
        });
    }, [localTasks, searchQuery, selectedPriority, selectedStatusFilter]);

    // Group tasks by Staff Member ID
    const groupedByStaff = useMemo(() => {
        const groups: Map<string, { staff: any; tasks: TaskItem[] }> = new Map();

        // Initialize entries for all active staff members
        staffs.forEach((staff) => {
            groups.set(staff._id, { staff, tasks: [] });
        });

        // Unassigned entry
        const UNASSIGNED_ID = 'unassigned';
        groups.set(UNASSIGNED_ID, {
            staff: { _id: UNASSIGNED_ID, name: 'Unassigned Tasks', designation: 'Needs Staff Allocation' },
            tasks: [],
        });

        filteredTasks.forEach((task) => {
            const staffId = task.assignedTo?._id || (task.assignedTo as any) || UNASSIGNED_ID;
            if (groups.has(staffId)) {
                groups.get(staffId)!.tasks.push(task);
            } else {
                // If task belongs to staff not in initial list, add dynamic entry
                const sName = task.assignedTo?.userId?.name || task.assignedTo?.name || 'Developer';
                groups.set(staffId, {
                    staff: {
                        _id: staffId,
                        name: sName,
                        designation: task.assignedTo?.designation || 'Developer',
                        user: task.assignedTo?.userId,
                    },
                    tasks: [task],
                });
            }
        });

        // Convert to array and filter out empty unassigned group if no unassigned tasks
        const result = Array.from(groups.values());
        return result.filter(g => g.staff._id !== UNASSIGNED_ID || g.tasks.length > 0);
    }, [staffs, filteredTasks]);

    const toggleCollapseStaff = (staffId: string) => {
        setCollapsedStaffs((prev) => ({
            ...prev,
            [staffId]: !prev[staffId],
        }));
    };

    const handleQuickStatusMove = async (task: TaskItem, newStatus: string) => {
        setActiveMenuId(null);
        const previousTasks = [...localTasks];
        setLocalTasks((prev) =>
            prev.map((t) => (t._id === task._id ? { ...t, status: newStatus as any } : t))
        );

        try {
            await updateTaskStatus({
                taskId: task._id,
                status: newStatus,
                currentStatus: task.status,
            }).unwrap();
            toast.success('Task status updated');
        } catch (err: any) {
            setLocalTasks(previousTasks);
            toast.error(err?.data?.message || 'Transition failed');
        }
    };

    const handleToggleSubtask = async (taskId: string, subtaskId: string, currentCompleted: boolean) => {
        const previousTasks = [...localTasks];
        const nextCompleted = !currentCompleted;

        setLocalTasks((prev) =>
            prev.map((t) => {
                if (t._id === taskId) {
                    const existingSubtasks = getTaskSubtasks(t);
                    const updatedSubtasks = existingSubtasks.map((st) =>
                        st._id === subtaskId 
                            ? { ...st, completed: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : undefined } 
                            : st
                    );
                    return {
                        ...t,
                        subtasks: updatedSubtasks,
                    };
                }
                return t;
            })
        );

        if (!subtaskId.startsWith("fallback_")) {
            try {
                await toggleSubtask({ taskId, subtaskId, completed: nextCompleted }).unwrap();
            } catch (err: any) {
                setLocalTasks(previousTasks);
                toast.error(err?.data?.message || 'Failed to toggle subtask');
            }
        }
    };

    const handleAssigneeChange = async (task: TaskItem, newStaffId: string) => {
        setAssigneeMenuId(null);
        const previousTasks = [...localTasks];
        const targetStaff = staffs.find((s: any) => s._id === newStaffId);

        setLocalTasks((prev) =>
            prev.map((t) => (t._id === task._id ? {
                ...t,
                assignedTo: targetStaff ? {
                    _id: targetStaff._id,
                    name: targetStaff.user?.name || targetStaff.name,
                    designation: targetStaff.designation,
                    userId: targetStaff.user || targetStaff.userId,
                } : t.assignedTo
            } : t))
        );

        try {
            await updateTask({
                taskId: task._id,
                data: { assignedTo: newStaffId },
            }).unwrap();
            toast.success('Task reassigned');
        } catch (err: any) {
            setLocalTasks(previousTasks);
            toast.error(err?.data?.message || 'Failed to reassign staff.');
        }
    };

    const handleReview = async (taskId: string, decision: 'approve' | 'reject') => {
        setActiveMenuId(null);
        try {
            await reviewTask({
                taskId,
                data: { decision, note: `Task ${decision}d.` },
            }).unwrap();
            toast.success(`Task ${decision}d`);
        } catch (err: any) {
            toast.error('Failed to submit review');
        }
    };

    const handleDelete = async (taskId: string) => {
        setActiveMenuId(null);
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await deleteTask(taskId).unwrap();
            toast.success('Task deleted');
        } catch (err: any) {
            toast.error('Failed to delete task');
        }
    };

    return (
        <div className="space-y-6">
            {/* Search & Filter Header Bar */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search developer name or task titles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <Filter className="h-3.5 w-3.5" />
                        <span>Filter By:</span>
                    </div>

                    <select
                        value={selectedStatusFilter}
                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                        className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                        <option value="all">All Task Statuses</option>
                        <option value="in_progress">⚡ Active / In Progress</option>
                        <option value="under_review">Under Review</option>
                        <option value="pending">Pending / Backlog</option>
                        <option value="completed">Completed</option>
                    </select>

                    <select
                        value={selectedPriority}
                        onChange={(e) => setSelectedPriority(e.target.value)}
                        className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                        <option value="all">All Priority</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>

                    {(searchQuery || selectedPriority !== 'all' || selectedStatusFilter !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedPriority('all');
                                setSelectedStatusFilter('all');
                            }}
                            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Developer Workload Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {groupedByStaff.map(({ staff, tasks: staffTasks }) => {
                    const isUnassigned = staff._id === 'unassigned';
                    const staffName = staff.user?.name || staff.name || 'Developer';
                    const staffDesignation = staff.designation || (isUnassigned ? 'Unallocated' : 'Developer');
                    const staffEmail = staff.user?.email || '';
                    const isCollapsed = !!collapsedStaffs[staff._id];

                    // Compute Developer Metrics
                    const totalAssigned = staffTasks.length;
                    const inProgressTasks = staffTasks.filter(t => t.status === 'in_progress');
                    const activeTask = inProgressTasks[0]; // The task currently being worked on
                    const underReviewCount = staffTasks.filter(t => t.status === 'under_review').length;
                    const pendingCount = staffTasks.filter(t => t.status === 'pending' || t.status === 'rejected').length;
                    const completedCount = staffTasks.filter(t => t.status === 'completed').length;
                    const overdueCount = staffTasks.filter(t => isPast(new Date(t.dueDate)) && t.status !== 'completed').length;

                    const activeWorkloadCount = inProgressTasks.length + pendingCount + underReviewCount;

                    return (
                        <div
                            key={staff._id}
                            className={cn(
                                "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all",
                                isUnassigned && "border-amber-300 dark:border-amber-800/60 bg-amber-50/10 dark:bg-amber-950/10"
                            )}
                        >
                            {/* Developer Profile Header Card */}
                            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        "h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border shadow-2xs",
                                        isUnassigned 
                                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40"
                                            : "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40"
                                    )}>
                                        {staffName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="space-y-0.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-snug">
                                                {staffName}
                                            </h3>
                                            {!isUnassigned && (
                                                <span className={cn(
                                                    "px-2 py-0.5 text-[10px] font-semibold rounded-full border",
                                                    activeWorkloadCount === 0 
                                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                                                        : activeWorkloadCount > 3
                                                        ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/40"
                                                        : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40"
                                                )}>
                                                    {activeWorkloadCount === 0 ? "Available" : `${activeWorkloadCount} Active`}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {staffDesignation}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => toggleCollapseStaff(staff._id)}
                                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        title={isCollapsed ? "Expand Lane" : "Collapse Lane"}
                                    >
                                        {isCollapsed ? <ChevronDown className="h-4 w-4 text-blue-500" /> : <ChevronUp className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Workload Stats & Badges Bar */}
                            <div className="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-center text-xs">
                                <div>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">In Dev</span>
                                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{inProgressTasks.length}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Review</span>
                                    <span className="text-xs font-bold text-amber-500">{underReviewCount}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Pending</span>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{pendingCount}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Done</span>
                                    <span className="text-xs font-bold text-emerald-500">{completedCount}</span>
                                </div>
                            </div>

                            {/* Active Task Highlight Banner (⚡ Currently Working On) */}
                            {activeTask && (
                                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-1 relative overflow-hidden">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                        <span className="flex items-center gap-1.5">
                                            <Zap className="h-3.5 w-3.5 fill-blue-500 text-blue-500 animate-pulse" />
                                            Active Task Right Now
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-600 dark:text-blue-300 font-mono">
                                            In Progress
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                                        {activeTask.title}
                                    </p>
                                    {typeof activeTask.orderId === 'object' && activeTask.orderId?.orderNumber && (
                                        <div className="text-[10px] text-slate-500 font-mono">
                                            Order #{activeTask.orderId.orderNumber}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Staff Task List Section */}
                            {!isCollapsed && (
                                <div className="space-y-3 pt-1">
                                    {staffTasks.length === 0 ? (
                                        <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                                            <UserCheck className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                No tasks currently assigned.
                                            </p>
                                            {canManage && onAssignTaskToStaff && !isUnassigned && (
                                                <button
                                                    type="button"
                                                    onClick={() => onAssignTaskToStaff(staff._id)}
                                                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Assign Task Now
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                                            {staffTasks.map((task) => {
                                                const isOverdue = isPast(new Date(task.dueDate)) && task.status !== 'completed';
                                                const subtasks = getTaskSubtasks(task);
                                                const completedSubtasks = subtasks.filter(s => s.completed).length;
                                                const subtaskPct = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

                                                return (
                                                    <div
                                                        key={task._id}
                                                        className={cn(
                                                            "bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 hover:border-blue-400/60 dark:hover:border-blue-500/40 transition-all relative",
                                                            task.status === 'in_progress' && "border-blue-500/80 bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-blue-500/20",
                                                            isOverdue && "border-red-300 dark:border-red-800/60"
                                                        )}
                                                    >
                                                        {/* Task Card Top Line: Priority & Status Pill & Actions */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 text-[9px] font-bold uppercase rounded tracking-wider",
                                                                    task.status === 'completed' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
                                                                    task.status === 'in_progress' && "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
                                                                    task.status === 'under_review' && "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
                                                                    (task.status === 'pending' || task.status === 'rejected') && "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                                )}>
                                                                    {task.status.replace('_', ' ')}
                                                                </span>

                                                                <span className={cn(
                                                                    "px-1.5 py-0.5 text-[9px] font-semibold rounded uppercase",
                                                                    task.priority === 'urgent' && "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
                                                                    task.priority === 'high' && "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
                                                                    task.priority === 'medium' && "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
                                                                    task.priority === 'low' && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                                )}>
                                                                    {task.priority}
                                                                </span>

                                                                {isOverdue && (
                                                                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 rounded">
                                                                        Overdue
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Actions Dropdown */}
                                                            <div className="relative">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveMenuId(activeMenuId === task._id ? null : task._id);
                                                                    }}
                                                                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                                >
                                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                                </button>

                                                                {activeMenuId === task._id && (
                                                                    <div 
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="absolute right-0 top-6 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 z-50 text-xs"
                                                                    >
                                                                        {canManage && onEditTask && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setActiveMenuId(null);
                                                                                    onEditTask(task);
                                                                                }}
                                                                                className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                                                                            >
                                                                                <Edit3 className="h-3.5 w-3.5 text-blue-500" /> Edit Task / Reassign
                                                                            </button>
                                                                        )}

                                                                        {task.status !== 'completed' && (
                                                                            <button
                                                                                onClick={() => handleQuickStatusMove(task, 'completed')}
                                                                                className="w-full text-left px-3 py-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2 font-medium"
                                                                            >
                                                                                <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Completed
                                                                            </button>
                                                                        )}

                                                                        {task.status !== 'in_progress' && task.status !== 'completed' && (
                                                                            <button
                                                                                onClick={() => handleQuickStatusMove(task, 'in_progress')}
                                                                                className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                                                                            >
                                                                                <PlayCircle className="h-3.5 w-3.5 text-blue-500" /> Set Active In Progress
                                                                            </button>
                                                                        )}

                                                                        {task.status === 'in_progress' && onSubmitTask && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setActiveMenuId(null);
                                                                                    onSubmitTask(task);
                                                                                }}
                                                                                className="w-full text-left px-3 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                                                                            >
                                                                                <Send className="h-3.5 w-3.5 text-blue-500" /> Submit for Review
                                                                            </button>
                                                                        )}

                                                                        {task.status === 'under_review' && canManage && (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => handleReview(task._id, 'approve')}
                                                                                    className="w-full text-left px-3 py-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2"
                                                                                >
                                                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve Deliverables
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleReview(task._id, 'reject')}
                                                                                    className="w-full text-left px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2"
                                                                                >
                                                                                    <XCircle className="h-3.5 w-3.5" /> Reject Task
                                                                                </button>
                                                                            </>
                                                                        )}

                                                                        {canManage && (
                                                                            <button
                                                                                onClick={() => handleDelete(task._id)}
                                                                                className="w-full text-left px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" /> Delete Task
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Task Title & Order Info */}
                                                        <div>
                                                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                                                {task.title}
                                                            </h4>
                                                            {typeof task.orderId === 'object' && task.orderId?.orderNumber && (
                                                                <span className="text-[10px] text-slate-500 font-mono">
                                                                    Order #{task.orderId.orderNumber}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Subtask Checklist Progress */}
                                                        {subtasks.length > 0 && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium font-mono">
                                                                    <span>Checklist ({completedSubtasks}/{subtasks.length})</span>
                                                                    <span>{subtaskPct}%</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                    <div 
                                                                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                                                        style={{ width: `${subtaskPct}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Bottom Info Bar: Reassign Staff & Due Date */}
                                                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] gap-2">
                                                            {/* Custom Reassign Popover */}
                                                            <div className="relative">
                                                                <button
                                                                    type="button"
                                                                    disabled={!canManage}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAssigneeMenuId(assigneeMenuId === task._id ? null : task._id);
                                                                    }}
                                                                    className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                                                >
                                                                    <User className="h-3 w-3 text-blue-500" />
                                                                    <span>Reassign</span>
                                                                </button>

                                                                {assigneeMenuId === task._id && (
                                                                    <div 
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="absolute left-0 bottom-6 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1 z-50 text-xs max-h-48 overflow-y-auto"
                                                                    >
                                                                        <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                                                            Select Developer
                                                                        </div>
                                                                        {staffs.map((s: any) => {
                                                                            const sName = s.user?.name || s.name || 'Staff Member';
                                                                            const isSelected = (task.assignedTo?._id || task.assignedTo) === s._id;

                                                                            return (
                                                                                <button
                                                                                    key={s._id}
                                                                                    type="button"
                                                                                    onClick={() => handleAssigneeChange(task, s._id)}
                                                                                    className={cn(
                                                                                        "w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                                                                                        isSelected && "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold"
                                                                                    )}
                                                                                >
                                                                                    <span className="truncate">{sName}</span>
                                                                                    {isSelected && <span className="text-blue-600 text-xs font-bold">✓</span>}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className={cn("flex items-center gap-1 font-mono text-[10px]", isOverdue ? "text-red-600 font-bold" : "text-slate-500")}>
                                                                <Clock className="h-3 w-3" />
                                                                <span>{format(new Date(task.dueDate), 'MMM dd')}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Quick Assign Button at bottom of developer card */}
                                    {canManage && onAssignTaskToStaff && !isUnassigned && (
                                        <button
                                            type="button"
                                            onClick={() => onAssignTaskToStaff(staff._id)}
                                            className="w-full py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl border border-dashed border-blue-200 dark:border-blue-800/40 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Assign Task to {staffName.split(' ')[0]}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
