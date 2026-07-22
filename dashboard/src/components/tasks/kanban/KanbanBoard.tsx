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
    ChevronsDownUp,
    ChevronsUpDown,
    User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface SubTaskItem {
    _id: string;
    title: string;
    completed: boolean;
    completedAt?: string;
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

interface KanbanBoardProps {
    tasks: TaskItem[];
    canManage: boolean;
    onEditTask?: (task: TaskItem) => void;
    onSubmitTask?: (task: TaskItem) => void;
    staffs?: any[];
}

const COLUMNS = [
    {
        id: 'pending',
        title: 'Backlog / Pending',
        dotClass: 'bg-slate-400',
    },
    {
        id: 'in_progress',
        title: 'In Progress',
        dotClass: 'bg-blue-500',
    },
    {
        id: 'under_review',
        title: 'Under Review',
        dotClass: 'bg-amber-500',
    },
    {
        id: 'completed',
        title: 'Completed',
        dotClass: 'bg-emerald-500',
    },
];

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

function formatDurationGap(start: Date, end: Date): string {
    const secs = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) {
        const rSecs = secs % 60;
        return rSecs > 0 ? `${mins}m ${rSecs}s` : `${mins}m`;
    }
    const hours = Math.floor(mins / 60);
    const rMins = mins % 60;
    return rMins > 0 ? `${hours}h ${rMins}m` : `${hours}h`;
}

function TaskChecklist({ 
    task, 
    onToggleSubtask 
}: { 
    task: TaskItem; 
    onToggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => void;
}) {
    const subtasks = useMemo(() => getTaskSubtasks(task), [task]);
    const [expanded, setExpanded] = useState(true);

    const subtaskTimeGaps = useMemo(() => {
        const gaps: Record<string, { timeStr: string; gapStr: string }> = {};
        let lastTime = new Date(task.createdAt || task.dueDate || Date.now());

        subtasks.forEach((st) => {
            if (st.completed) {
                const curTime = st.completedAt ? new Date(st.completedAt) : new Date();
                const timeStr = format(curTime, 'hh:mm a');
                const gapStr = formatDurationGap(lastTime, curTime);
                gaps[st._id] = { timeStr, gapStr };
                lastTime = curTime;
            }
        });

        return gaps;
    }, [subtasks, task.createdAt, task.dueDate]);

    if (subtasks.length === 0) return null;

    const completedCount = subtasks.filter((s) => s.completed).length;
    const progressPercent = Math.round((completedCount / subtasks.length) * 100);

    return (
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
            <div 
                onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(!expanded);
                }}
                className="flex items-center justify-between cursor-pointer select-none"
            >
                <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                    <CheckSquare className={cn("h-3.5 w-3.5", completedCount === subtasks.length ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400")} />
                    <span>Checklist ({completedCount}/{subtasks.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 font-mono">{progressPercent}%</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform duration-200", expanded && "rotate-180")} />
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                    className={cn(
                        "h-full transition-all duration-300 rounded-full", 
                        completedCount === subtasks.length ? "bg-emerald-500" : "bg-blue-600"
                    )}
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Subtasks List - Hierarchical Main Feature vs Sub-Feature */}
            {expanded && (
                <div className="pt-1.5 space-y-1.5 border-t border-slate-200 dark:border-slate-700/80 max-h-[360px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {subtasks.map((st) => {
                        const gapInfo = subtaskTimeGaps[st._id];

                        const isSub = !!(st as any).isSubFeature || 
                            st.title.startsWith("  ") || 
                            st.title.startsWith("\t") || 
                            st.title.includes("[Sub]") ||
                            st.title.toLowerCase().startsWith("sub:") ||
                            !!(st as any).parentName;

                        const cleanTitle = st.title
                            .replace(/^\[(Sub|Main)\]\s*/i, "")
                            .replace(/^-\s*/, "")
                            .trim();

                        return (
                            <div 
                                key={st._id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSubtask(task._id, st._id, st.completed);
                                }}
                                className={cn(
                                    "flex flex-col p-2 rounded text-xs transition-colors cursor-pointer border select-none",
                                    isSub 
                                        ? "ml-3.5 bg-slate-100/70 dark:bg-slate-800/40 border-dashed border-slate-200 dark:border-slate-700/60" 
                                        : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs",
                                    st.completed && "bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40"
                                )}
                            >
                                <div className="flex items-start gap-2">
                                    <input 
                                        type="checkbox"
                                        id={`st-${st._id}`}
                                        checked={st.completed}
                                        readOnly
                                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/20 cursor-pointer shrink-0 pointer-events-none"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                            <span className={cn(
                                                "text-[11px] leading-snug block transition-all", 
                                                isSub ? "font-medium text-slate-700 dark:text-slate-300" : "font-bold text-slate-900 dark:text-slate-100",
                                                st.completed && "line-through text-slate-500 dark:text-slate-400 font-medium"
                                            )}>
                                                {cleanTitle}
                                            </span>

                                            <span className={cn(
                                                "px-1.5 py-0.2 text-[8px] font-extrabold uppercase tracking-wider rounded border shrink-0",
                                                isSub
                                                    ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40"
                                                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40"
                                            )}>
                                                {isSub ? "Sub-Feature" : "Main Feature"}
                                            </span>
                                        </div>

                                        {st.completed && gapInfo && (
                                            <div className="flex items-center gap-1.5 mt-1 text-[9px] font-mono text-slate-500 dark:text-slate-400 flex-wrap">
                                                <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium border border-emerald-200 dark:border-emerald-800/40">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {gapInfo.timeStr}
                                                </span>
                                                <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium border border-amber-200 dark:border-amber-800/40">
                                                    ⚡ +{gapInfo.gapStr} pace
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function KanbanBoard({
    tasks,
    canManage,
    onEditTask,
    onSubmitTask,
    staffs = [],
}: KanbanBoardProps) {
    const [localTasks, setLocalTasks] = useState<TaskItem[]>(tasks);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<string>('all');
    const [selectedPriority, setSelectedPriority] = useState<string>('all');
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [assigneeMenuId, setAssigneeMenuId] = useState<string | null>(null);

    // Collapsible tasks state: map of taskId -> isCollapsed boolean
    const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});

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

    const toggleCollapseTask = (taskId: string) => {
        setCollapsedTasks((prev) => ({
            ...prev,
            [taskId]: !prev[taskId],
        }));
    };

    const toggleCollapseAll = () => {
        const allCollapsed = filteredTasks.every((t) => collapsedTasks[t._id]);
        const newState: Record<string, boolean> = {};
        filteredTasks.forEach((t) => {
            newState[t._id] = !allCollapsed;
        });
        setCollapsedTasks(newState);
    };

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

            if (selectedStaff !== 'all') {
                const assigneeId = t.assignedTo?._id || t.assignedTo?.userId?._id;
                if (assigneeId !== selectedStaff) return false;
            }

            if (selectedPriority !== 'all') {
                if (t.priority !== selectedPriority) return false;
            }

            return true;
        });
    }, [localTasks, searchQuery, selectedStaff, selectedPriority]);

    const handleDragStart = (e: React.DragEvent, task: TaskItem) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task._id, currentStatus: task.status }));
        e.dataTransfer.effectAllowed = 'move';
        setDraggingTaskId(task._id);
    };

    const handleDragEnd = () => {
        setDraggingTaskId(null);
        setDragOverColumn(null);
    };

    const handleDragOver = (e: React.DragEvent, colId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverColumn !== colId) {
            setDragOverColumn(colId);
        }
    };

    const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        setDragOverColumn(null);

        const rawData = e.dataTransfer.getData('text/plain');
        setDraggingTaskId(null);

        if (!rawData) return;

        try {
            const { taskId, currentStatus } = JSON.parse(rawData);
            if (currentStatus === targetStatus) return;

            if (targetStatus === 'under_review' && currentStatus !== 'in_progress') {
                toast.error('Tasks must be In Progress before submitting for review.');
                return;
            }

            const previousTasks = [...localTasks];
            setLocalTasks((prev) =>
                prev.map((t) => (t._id === taskId ? { ...t, status: targetStatus as any } : t))
            );

            try {
                await updateTaskStatus({ taskId, status: targetStatus, currentStatus }).unwrap();
                toast.success('Task status updated');
            } catch (err: any) {
                setLocalTasks(previousTasks);
                toast.error(err?.data?.message || 'Failed to update status');
            }
        } catch (err: any) {
            toast.error('Invalid drag operation');
        }
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
            toast.success('Staff reassigned');
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

    const getColumnTasks = (colId: string) => {
        return filteredTasks.filter((t) => {
            if (colId === 'pending') return t.status === 'pending' || t.status === 'rejected';
            return t.status === colId;
        });
    };

    const areAllCollapsed = useMemo(() => {
        if (filteredTasks.length === 0) return false;
        return filteredTasks.every((t) => collapsedTasks[t._id]);
    }, [filteredTasks, collapsedTasks]);

    return (
        <div className="space-y-6 overflow-x-hidden">
            {/* Filter Bar with Collapse All Toggle */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tasks or assignees..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Global Collapse/Expand All Button */}
                    <button
                        type="button"
                        onClick={toggleCollapseAll}
                        className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                    >
                        {areAllCollapsed ? (
                            <>
                                <ChevronsUpDown className="h-3.5 w-3.5 text-blue-500" />
                                <span>Expand All</span>
                            </>
                        ) : (
                            <>
                                <ChevronsDownUp className="h-3.5 w-3.5 text-blue-500" />
                                <span>Collapse All</span>
                            </>
                        )}
                    </button>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <Filter className="h-3.5 w-3.5" />
                        <span>Filters:</span>
                    </div>

                    <select
                        value={selectedStaff}
                        onChange={(e) => setSelectedStaff(e.target.value)}
                        className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                        <option value="all">All Assignees</option>
                        {staffs.map((s: any) => (
                            <option key={s._id} value={s._id}>
                                {s.user?.name || s.name || 'Staff Member'}
                            </option>
                        ))}
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

                    {(searchQuery || selectedStaff !== 'all' || selectedPriority !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedStaff('all');
                                setSelectedPriority('all');
                            }}
                            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Kanban Columns Grid - No Overflow Scrollbar Glitches */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start pb-6 overflow-x-hidden">
                {COLUMNS.map((col) => {
                    const colTasks = getColumnTasks(col.id);
                    const isDragOver = dragOverColumn === col.id;

                    return (
                        <div
                            key={col.id}
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDrop={(e) => handleDrop(e, col.id)}
                            className={cn(
                                "flex flex-col min-h-[520px] rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-3 space-y-3 transition-all duration-200 relative overflow-hidden select-none",
                                isDragOver && "border-blue-500/80 bg-blue-50/20 dark:bg-blue-950/20 ring-2 ring-blue-500/20 scale-[1.01]"
                            )}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between px-1 py-0.5">
                                <div className="flex items-center gap-2">
                                    <span className={cn("h-2 w-2 rounded-full", col.dotClass)} />
                                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        {col.title}
                                    </span>
                                </div>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                    {colTasks.length}
                                </span>
                            </div>

                            {/* Drop Zone Placeholder */}
                            <AnimatePresence>
                                {isDragOver && draggingTaskId && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="my-1 p-2.5 rounded-lg border-2 border-dashed border-blue-500/60 bg-blue-500/10 flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-medium text-xs"
                                    >
                                        <span>Drop to move here</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Cards Container with Clean Scrollbar */}
                            <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden max-h-[720px] pr-0.5 [scrollbar-width:thin]">
                                <AnimatePresence mode="popLayout">
                                    {colTasks.length === 0 && !isDragOver ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="h-28 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs font-medium"
                                        >
                                            No tasks
                                        </motion.div>
                                    ) : (
                                        colTasks.map((task) => {
                                            const isOverdue = isPast(new Date(task.dueDate)) && task.status !== 'completed';
                                            const isBeingDragged = draggingTaskId === task._id;
                                            const currentAssigneeId = task.assignedTo?._id || (task.assignedTo as any);
                                            const assigneeName = task.assignedTo?.userId?.name || task.assignedTo?.name || 'Unassigned';
                                            const isCollapsed = !!collapsedTasks[task._id];

                                            const subtasks = getTaskSubtasks(task);
                                            const completedCount = subtasks.filter((s) => s.completed).length;
                                            const pct = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

                                            return (
                                                <motion.div
                                                    key={task._id}
                                                    layout
                                                    layoutId={task._id}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{
                                                        opacity: isBeingDragged ? 0.4 : 1,
                                                        scale: isBeingDragged ? 1.01 : 1,
                                                        y: 0,
                                                        rotate: 0,
                                                    }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task)}
                                                    onDragEnd={() => handleDragEnd()}
                                                    className="touch-none"
                                                >
                                                    <div className={cn(
                                                        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-grab active:cursor-grabbing relative overflow-hidden",
                                                        isOverdue && "border-red-300 dark:border-red-800/60 bg-red-50/20 dark:bg-red-950/10",
                                                        isBeingDragged && "border-blue-500 ring-2 ring-blue-500/20 z-50",
                                                        isCollapsed && "p-2.5 space-y-0"
                                                    )}>
                                                        {/* Priority, Collapsible Toggle & Actions Header */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 text-[10px] font-medium rounded uppercase tracking-wider shrink-0",
                                                                    task.priority === 'urgent' && "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40",
                                                                    task.priority === 'high' && "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40",
                                                                    task.priority === 'medium' && "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40",
                                                                    task.priority === 'low' && "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                                                                )}>
                                                                    {task.priority}
                                                                </span>

                                                                {isOverdue && !isCollapsed && (
                                                                    <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded shrink-0">
                                                                        Overdue
                                                                    </span>
                                                                )}

                                                                {isCollapsed && (
                                                                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate ml-1">
                                                                        {task.title}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {/* Collapse / Expand Card Toggle Button */}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleCollapseTask(task._id);
                                                                    }}
                                                                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                    title={isCollapsed ? "Expand Task Card" : "Collapse Task Card"}
                                                                >
                                                                    {isCollapsed ? (
                                                                        <ChevronDown className="h-4 w-4 text-blue-500" />
                                                                    ) : (
                                                                        <ChevronUp className="h-4 w-4" />
                                                                    )}
                                                                </button>

                                                                {/* Card Actions Menu */}
                                                                {!isCollapsed && (
                                                                    <div className="relative">
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setActiveMenuId(activeMenuId === task._id ? null : task._id);
                                                                            }}
                                                                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                        >
                                                                            <MoreVertical className="h-4 w-4" />
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
                                                                                        <Edit3 className="h-3.5 w-3.5 text-blue-500" /> Edit / Staff Change
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
                                                                                        <PlayCircle className="h-3.5 w-3.5 text-blue-500" /> Start Progress
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
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Collapsed Mode Compact Summary Bar */}
                                                        {isCollapsed ? (
                                                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                                                                        {completedCount}/{subtasks.length} ({pct}%)
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
                                                                    <User className="h-3 w-3" />
                                                                    <span className="truncate max-w-[100px]">{assigneeName}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* Full Expanded Task Body */
                                                            <>
                                                                {/* Task Title */}
                                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                                                    {task.title}
                                                                </h4>

                                                                {/* Order reference if linked */}
                                                                {typeof task.orderId === 'object' && task.orderId?.orderNumber && (
                                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                                                                        <span>Order #{task.orderId.orderNumber}</span>
                                                                        {task.orderId.quotationSnapshot?.clientName && (
                                                                            <span>• {task.orderId.quotationSnapshot.clientName}</span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Checklist Sub-component */}
                                                                <TaskChecklist 
                                                                    task={task} 
                                                                    onToggleSubtask={handleToggleSubtask} 
                                                                />

                                                                {/* Custom Staff Select Dropdown - No Native Select Box! */}
                                                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs gap-2">
                                                                    <div className="relative">
                                                                        <button
                                                                            type="button"
                                                                            disabled={!canManage || staffs.length === 0}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setAssigneeMenuId(assigneeMenuId === task._id ? null : task._id);
                                                                            }}
                                                                            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                                                        >
                                                                            <div className="h-4 w-4 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                                                                                {assigneeName.substring(0, 2).toUpperCase()}
                                                                            </div>
                                                                            <span className="truncate max-w-[120px]">{assigneeName}</span>
                                                                            {canManage && staffs.length > 0 && (
                                                                                <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                                                                            )}
                                                                        </button>

                                                                        {/* Custom Popover Staff Selector */}
                                                                        {assigneeMenuId === task._id && (
                                                                            <div 
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="absolute left-0 bottom-7 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-1 z-50 text-xs max-h-48 overflow-y-auto"
                                                                            >
                                                                                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                                                                    Reassign Staff
                                                                                </div>
                                                                                {staffs.map((s: any) => {
                                                                                    const sName = s.user?.name || s.name || 'Staff Member';
                                                                                    const isSelected = currentAssigneeId === s._id;

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
                                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                                <div className="h-4 w-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                                                                                                    {sName.substring(0, 2).toUpperCase()}
                                                                                                </div>
                                                                                                <span className="truncate">{sName}</span>
                                                                                            </div>
                                                                                            {isSelected && <span className="text-blue-600 text-xs font-bold">✓</span>}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className={cn("text-[10px] font-medium flex items-center gap-1 shrink-0", isOverdue ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400")}>
                                                                        <Clock className="h-3 w-3" />
                                                                        <span>{format(new Date(task.dueDate), 'MMM dd')}</span>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        })
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
