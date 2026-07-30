"use client";

import { useState, useMemo, useEffect } from "react";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    TouchSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
    useUpdateTaskStatusMutation,
    useReviewTaskMutation,
    useDeleteTaskMutation,
} from "@/redux/features/task/taskApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    getTaskProgress,
    getAssigneeName,
    getOrderLabel,
    isTaskOverdue,
    isTaskBlocked,
    PRIORITY_LABEL,
    type TaskItem as ProgressTaskItem,
} from "@/lib/task-progress";
import { DESIGNATION_LABELS, type Designation } from "@/constants/designation";
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
    ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SubTaskItem = { _id: string; title: string; completed: boolean; completedAt?: string };
export type TaskItem = ProgressTaskItem;

interface KanbanBoardProps {
    tasks: TaskItem[];
    canManage: boolean;
    onEditTask?: (task: TaskItem) => void;
    onSubmitTask?: (task: TaskItem) => void;
    onOpenDetail?: (task: TaskItem) => void;
    staffs?: any[];
}

const COLUMNS = [
    { id: 'pending', title: 'To Do', dotClass: 'bg-slate-400' },
    { id: 'in_progress', title: 'In Progress', dotClass: 'bg-primary' },
    { id: 'under_review', title: 'Review', dotClass: 'bg-amber-500' },
    { id: 'completed', title: 'Done', dotClass: 'bg-emerald-500' },
];

const PRIORITY_BADGE_CLASS: Record<TaskItem['priority'], string> = {
    low: 'bg-muted text-muted-foreground border-transparent',
    medium: 'bg-primary/10 text-primary border-transparent',
    high: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent',
    urgent: 'bg-destructive/10 text-destructive border-transparent',
};

function TaskCardContent({
    task,
    canManage,
    isOverdue,
    dragHandleProps,
    onOpenDetail,
    onEditTask,
    onSubmitTask,
    onQuickStatusMove,
    onReview,
    onDelete,
}: {
    task: TaskItem;
    canManage: boolean;
    isOverdue: boolean;
    dragHandleProps?: Record<string, any>;
    onOpenDetail?: (task: TaskItem) => void;
    onEditTask?: (task: TaskItem) => void;
    onSubmitTask?: (task: TaskItem) => void;
    onQuickStatusMove?: (task: TaskItem, status: string) => void;
    onReview?: (taskId: string, decision: 'approve' | 'reject') => void;
    onDelete?: (taskId: string) => void;
}) {
    const progress = getTaskProgress(task);
    const assigneeName = getAssigneeName(task.assignedTo);
    const orderLabel = getOrderLabel(task.orderId);
    const blocked = isTaskBlocked(task);

    return (
        <div
            {...dragHandleProps}
            onClick={() => onOpenDetail?.(task)}
            className={cn(
                "bg-card border rounded-lg p-3 space-y-2 hover:border-primary/40 transition-colors cursor-grab active:cursor-grabbing relative",
                isOverdue && "border-destructive/40 bg-destructive/5"
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <Badge variant="outline" className={cn("text-[10px] capitalize", PRIORITY_BADGE_CLASS[task.priority])}>
                        {PRIORITY_LABEL[task.priority]}
                    </Badge>
                    {blocked && (
                        <Badge className="text-[10px] bg-destructive/10 text-destructive border-transparent gap-1">
                            <ShieldAlert className="h-2.5 w-2.5" /> Blocked
                        </Badge>
                    )}
                    {isOverdue && !blocked && (
                        <Badge className="text-[10px] bg-destructive/10 text-destructive border-transparent">Overdue</Badge>
                    )}
                </div>

                {onEditTask && onQuickStatusMove && onReview && onDelete && (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                            >
                                <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-xs" onClick={(e) => e.stopPropagation()}>
                            {canManage && (
                                <DropdownMenuItem onClick={() => onEditTask(task)}>
                                    <Edit3 className="h-3.5 w-3.5 text-primary" /> Edit / Reassign
                                </DropdownMenuItem>
                            )}
                            {task.status !== 'completed' && (
                                <DropdownMenuItem onClick={() => onQuickStatusMove(task, 'completed')}>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Mark as Completed
                                </DropdownMenuItem>
                            )}
                            {task.status !== 'in_progress' && task.status !== 'completed' && (
                                <DropdownMenuItem onClick={() => onQuickStatusMove(task, 'in_progress')}>
                                    <PlayCircle className="h-3.5 w-3.5 text-primary" /> Start Progress
                                </DropdownMenuItem>
                            )}
                            {task.status === 'in_progress' && onSubmitTask && (
                                <DropdownMenuItem onClick={() => onSubmitTask(task)}>
                                    <Send className="h-3.5 w-3.5 text-primary" /> Submit for Review
                                </DropdownMenuItem>
                            )}
                            {task.status === 'under_review' && canManage && (
                                <>
                                    <DropdownMenuItem onClick={() => onReview(task._id, 'approve')}>
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onReview(task._id, 'reject')} variant="destructive">
                                        <XCircle className="h-3.5 w-3.5" /> Reject
                                    </DropdownMenuItem>
                                </>
                            )}
                            {canManage && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => onDelete(task._id)} variant="destructive">
                                        <Trash2 className="h-3.5 w-3.5" /> Delete Task
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            <h4 className="text-sm font-semibold leading-snug line-clamp-2">{task.title}</h4>

            {orderLabel && <div className="text-[11px] text-muted-foreground font-mono">{orderLabel}</div>}

            {progress.total > 0 && (
                <div className="flex items-center gap-2">
                    <Progress value={progress.pct} className="h-1.5 flex-1" />
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {progress.completed}/{progress.total}
                    </span>
                </div>
            )}

            <div className="pt-1.5 border-t flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar className="h-5 w-5 shrink-0">
                        <AvatarFallback className="text-[8px] font-bold bg-muted">
                            {assigneeName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[100px] text-muted-foreground">{assigneeName}</span>
                </div>
                <div className={cn("flex items-center gap-1 shrink-0", isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
                    <Clock className="h-3 w-3" />
                    <span>{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</span>
                </div>
            </div>
        </div>
    );
}

function DraggableTaskCard(props: {
    task: TaskItem;
    canManage: boolean;
    onOpenDetail?: (task: TaskItem) => void;
    onEditTask?: (task: TaskItem) => void;
    onSubmitTask?: (task: TaskItem) => void;
    onQuickStatusMove: (task: TaskItem, status: string) => void;
    onReview: (taskId: string, decision: 'approve' | 'reject') => void;
    onDelete: (taskId: string) => void;
}) {
    const { task } = props;
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task._id,
        data: { status: task.status },
    });

    const style = transform
        ? { transform: CSS.Translate.toString(transform), transition: isDragging ? undefined : 'transform 200ms ease' }
        : undefined;

    return (
        <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-30")}>
            <TaskCardContent
                task={task}
                canManage={props.canManage}
                isOverdue={isTaskOverdue(task)}
                dragHandleProps={{ ...attributes, ...listeners }}
                onOpenDetail={props.onOpenDetail}
                onEditTask={props.onEditTask}
                onSubmitTask={props.onSubmitTask}
                onQuickStatusMove={props.onQuickStatusMove}
                onReview={props.onReview}
                onDelete={props.onDelete}
            />
        </div>
    );
}

function DroppableColumn({
    id,
    title,
    dotClass,
    count,
    children,
}: {
    id: string;
    title: string;
    dotClass: string;
    count: number;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col min-h-[420px] rounded-lg border bg-muted/20 p-2.5 space-y-2.5 transition-colors duration-150 relative select-none",
                isOver && "border-primary/60 bg-primary/5 ring-2 ring-primary/20"
            )}
        >
            <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", dotClass)} />
                    <span className="font-semibold text-xs text-foreground/80 uppercase tracking-wider">{title}</span>
                </div>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                    {count}
                </span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden max-h-[680px] pr-0.5 [scrollbar-width:thin]">
                {children}
            </div>
        </div>
    );
}

export function KanbanBoard({
    tasks,
    canManage,
    onEditTask,
    onSubmitTask,
    onOpenDetail,
    staffs = [],
}: KanbanBoardProps) {
    const [localTasks, setLocalTasks] = useState<TaskItem[]>(tasks);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<string>('all');
    const [selectedPriority, setSelectedPriority] = useState<string>('all');
    const [selectedRole, setSelectedRole] = useState<string>('all');
    const [selectedProject, setSelectedProject] = useState<string>('all');
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

    const [updateTaskStatus] = useUpdateTaskStatusMutation();
    const [reviewTask] = useReviewTaskMutation();
    const [deleteTask] = useDeleteTaskMutation();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
    );

    useEffect(() => {
        setLocalTasks(tasks);
    }, [tasks]);

    const roleOptions = useMemo(() => {
        const set = new Set<string>();
        staffs.forEach((s: any) => s.designation && set.add(s.designation));
        return Array.from(set).map((d) => ({ value: d, label: DESIGNATION_LABELS[d as Designation] || d }));
    }, [staffs]);

    const projectOptions = useMemo(() => {
        const map = new Map<string, string>();
        localTasks.forEach((t) => {
            if (typeof t.orderId === 'object' && t.orderId?.orderNumber) {
                map.set(t.orderId._id, `#${t.orderId.orderNumber}`);
            }
        });
        return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
    }, [localTasks]);

    const filteredTasks = useMemo(() => {
        return localTasks.filter((t) => {
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const titleMatch = t.title.toLowerCase().includes(query);
                const assigneeName = getAssigneeName(t.assignedTo).toLowerCase();
                if (!titleMatch && !assigneeName.includes(query)) return false;
            }

            if (selectedStaff !== 'all') {
                const assigneeId = typeof t.assignedTo === 'object' ? t.assignedTo?._id : t.assignedTo;
                if (assigneeId !== selectedStaff) return false;
            }

            if (selectedPriority !== 'all' && t.priority !== selectedPriority) return false;

            if (selectedRole !== 'all') {
                const designation = typeof t.assignedTo === 'object' ? t.assignedTo?.designation : undefined;
                if (designation !== selectedRole) return false;
            }

            if (selectedProject !== 'all') {
                const orderId = typeof t.orderId === 'object' ? t.orderId?._id : t.orderId;
                if (orderId !== selectedProject) return false;
            }

            return true;
        });
    }, [localTasks, searchQuery, selectedStaff, selectedPriority, selectedRole, selectedProject]);

    const activeTask = useMemo(
        () => (activeTaskId ? localTasks.find((t) => t._id === activeTaskId) || null : null),
        [activeTaskId, localTasks]
    );

    const handleQuickStatusMove = async (task: TaskItem, newStatus: string) => {
        const previousTasks = [...localTasks];
        setLocalTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status: newStatus as any } : t)));
        try {
            await updateTaskStatus({ taskId: task._id, status: newStatus, currentStatus: task.status }).unwrap();
            toast.success('Task status updated');
        } catch (err: any) {
            setLocalTasks(previousTasks);
            toast.error(err?.data?.message || 'Transition failed');
        }
    };

    const handleReview = async (taskId: string, decision: 'approve' | 'reject') => {
        try {
            await reviewTask({ taskId, data: { decision, note: `Task ${decision}d.` } }).unwrap();
            toast.success(`Task ${decision}d`);
        } catch {
            toast.error('Failed to submit review');
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await deleteTask(taskId).unwrap();
            toast.success('Task deleted');
        } catch {
            toast.error('Failed to delete task');
        }
    };

    const getColumnTasks = (colId: string) => {
        return filteredTasks.filter((t) => {
            if (colId === 'pending') return t.status === 'pending' || t.status === 'rejected';
            return t.status === colId;
        });
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveTaskId(String(event.active.id));
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTaskId(null);
        if (!over) return;

        const taskId = String(active.id);
        const targetStatus = String(over.id);
        const currentStatus = (active.data.current?.status as string) || undefined;

        if (!currentStatus || currentStatus === targetStatus) return;

        if (targetStatus === 'under_review' && currentStatus !== 'in_progress') {
            toast.error('Tasks must be In Progress before submitting for review.');
            return;
        }

        const previousTasks = [...localTasks];
        setLocalTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: targetStatus as any } : t)));

        try {
            await updateTaskStatus({ taskId, status: targetStatus, currentStatus }).unwrap();
            toast.success('Task status updated');
        } catch (err: any) {
            setLocalTasks(previousTasks);
            toast.error(err?.data?.message || 'Failed to update status');
        }
    };

    return (
        <div className="space-y-4 overflow-x-hidden">
            {/* Filter Bar */}
            <div className="p-3 bg-card border rounded-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search tasks or assignees..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-9 text-xs"
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Filter className="h-3.5 w-3.5" />
                        <span>Filters:</span>
                    </div>

                    <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                        <SelectTrigger size="sm" className="h-9 text-xs w-[140px]">
                            <SelectValue placeholder="Assignee" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Assignees</SelectItem>
                            {staffs.map((s: any) => (
                                <SelectItem key={s._id} value={s._id}>
                                    {s.user?.name || s.name || 'Staff Member'}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {roleOptions.length > 0 && (
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger size="sm" className="h-9 text-xs w-[130px]">
                                <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                {roleOptions.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {projectOptions.length > 0 && (
                        <Select value={selectedProject} onValueChange={setSelectedProject}>
                            <SelectTrigger size="sm" className="h-9 text-xs w-[130px]">
                                <SelectValue placeholder="Project" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Projects</SelectItem>
                                {projectOptions.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                        <SelectTrigger size="sm" className="h-9 text-xs w-[120px]">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priority</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                    </Select>

                    {(searchQuery || selectedStaff !== 'all' || selectedPriority !== 'all' || selectedRole !== 'all' || selectedProject !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedStaff('all');
                                setSelectedPriority('all');
                                setSelectedRole('all');
                                setSelectedProject('all');
                            }}
                            className="px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Columns */}
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTaskId(null)}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-start pb-6 overflow-x-hidden">
                    {COLUMNS.map((col) => {
                        const colTasks = getColumnTasks(col.id);
                        return (
                            <DroppableColumn key={col.id} id={col.id} title={col.title} dotClass={col.dotClass} count={colTasks.length}>
                                {colTasks.length === 0 ? (
                                    <div className="h-24 flex items-center justify-center border border-dashed rounded-lg text-muted-foreground text-xs font-medium">
                                        No tasks
                                    </div>
                                ) : (
                                    colTasks.map((task) => (
                                        <DraggableTaskCard
                                            key={task._id}
                                            task={task}
                                            canManage={canManage}
                                            onOpenDetail={onOpenDetail}
                                            onEditTask={onEditTask}
                                            onSubmitTask={onSubmitTask}
                                            onQuickStatusMove={handleQuickStatusMove}
                                            onReview={handleReview}
                                            onDelete={handleDelete}
                                        />
                                    ))
                                )}
                            </DroppableColumn>
                        );
                    })}
                </div>

                <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
                    {activeTask ? (
                        <div className="shadow-xl rounded-lg rotate-2 w-[280px]">
                            <TaskCardContent task={activeTask} canManage={canManage} isOverdue={isTaskOverdue(activeTask)} />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
