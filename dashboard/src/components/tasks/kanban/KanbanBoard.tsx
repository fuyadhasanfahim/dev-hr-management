"use client";

import { useState, useMemo } from "react";
import {
    useUpdateTaskStatusMutation,
    useReviewTaskMutation,
    useDeleteTaskMutation,
} from "@/redux/features/task/taskApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow, isPast } from "date-fns";
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
    Paperclip,
    ExternalLink,
    AlertCircle,
    Circle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface TaskItem {
    _id: string;
    title: string;
    description?: string;
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
        badgeVariant: 'outline' as const,
        dotClass: 'bg-muted-foreground',
    },
    {
        id: 'in_progress',
        title: 'In Progress',
        badgeVariant: 'secondary' as const,
        dotClass: 'bg-primary',
    },
    {
        id: 'under_review',
        title: 'Under Review',
        badgeVariant: 'secondary' as const,
        dotClass: 'bg-foreground',
    },
    {
        id: 'completed',
        title: 'Completed',
        badgeVariant: 'default' as const,
        dotClass: 'bg-primary',
    },
];

export function KanbanBoard({
    tasks,
    canManage,
    onEditTask,
    onSubmitTask,
    staffs = [],
}: KanbanBoardProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<string>('all');
    const [selectedPriority, setSelectedPriority] = useState<string>('all');
    const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    const [updateTaskStatus] = useUpdateTaskStatusMutation();
    const [reviewTask] = useReviewTaskMutation();
    const [deleteTask] = useDeleteTaskMutation();

    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => {
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
    }, [tasks, searchQuery, selectedStaff, selectedPriority]);

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
        setDraggingTaskId(null);

        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;

        try {
            const { taskId, currentStatus } = JSON.parse(rawData);
            if (currentStatus === targetStatus) return;

            if (targetStatus === 'completed' && !canManage) {
                toast.error('Only Managers can move tasks directly to Completed.');
                return;
            }

            if (targetStatus === 'under_review' && currentStatus !== 'in_progress') {
                toast.error('Tasks must be In Progress before submitting for review.');
                return;
            }

            await updateTaskStatus({ taskId, status: targetStatus, currentStatus }).unwrap();
            toast.success(`Task status updated`);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to update status');
        }
    };

    const handleQuickStatusMove = async (task: TaskItem, newStatus: string) => {
        try {
            await updateTaskStatus({
                taskId: task._id,
                status: newStatus,
                currentStatus: task.status,
            }).unwrap();
            toast.success(`Task status updated`);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Transition failed');
        }
    };

    const handleReview = async (taskId: string, decision: 'approve' | 'reject') => {
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
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await deleteTask(taskId).unwrap();
            toast.success('Task removed');
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

    return (
        <div className="space-y-6">
            {/* Minimalist Filter Bar */}
            <Card className="border shadow-xs">
                <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search tasks or assignees..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            <Filter className="h-3.5 w-3.5" />
                            <span>Filters:</span>
                        </div>

                        <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                            <SelectTrigger className="h-9 text-xs w-36">
                                <SelectValue placeholder="All Assignees" />
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

                        <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                            <SelectTrigger className="h-9 text-xs w-32">
                                <SelectValue placeholder="All Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priority</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>

                        {(searchQuery || selectedStaff !== 'all' || selectedPriority !== 'all') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedStaff('all');
                                    setSelectedPriority('all');
                                }}
                                className="h-9 text-xs"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Kanban Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start pb-6">
                {COLUMNS.map((col) => {
                    const colTasks = getColumnTasks(col.id);
                    const isDragOver = dragOverColumn === col.id;

                    return (
                        <div
                            key={col.id}
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDrop={(e) => handleDrop(e, col.id)}
                            className={cn(
                                "flex flex-col min-h-[500px] rounded-xl border bg-muted/30 p-3 space-y-3 transition-colors",
                                isDragOver && "border-primary bg-accent/50"
                            )}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between px-1 py-0.5">
                                <div className="flex items-center gap-2">
                                    <span className={cn("h-2 w-2 rounded-full", col.dotClass)} />
                                    <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
                                        {col.title}
                                    </span>
                                </div>
                                <Badge variant={col.badgeVariant} className="text-[10px] font-bold px-2 py-0.5">
                                    {colTasks.length}
                                </Badge>
                            </div>

                            {/* Cards Area */}
                            <div className="flex-1 space-y-3 overflow-y-auto max-h-[700px] pr-0.5">
                                <AnimatePresence mode="popLayout">
                                    {colTasks.length === 0 ? (
                                        <div className="h-28 flex items-center justify-center border border-dashed rounded-lg text-muted-foreground/60 text-xs font-medium">
                                            No tasks
                                        </div>
                                    ) : (
                                        colTasks.map((task) => {
                                            const isOverdue = isPast(new Date(task.dueDate)) && task.status !== 'completed';
                                            const isBeingDragged = draggingTaskId === task._id;

                                            return (
                                                <motion.div
                                                    key={task._id}
                                                    layout
                                                    initial={{ opacity: 0, y: 4 }}
                                                    animate={{ opacity: isBeingDragged ? 0.4 : 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    transition={{ duration: 0.15 }}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task)}
                                                    onDragEnd={() => handleDragEnd()}
                                                >
                                                    <Card className={cn(
                                                        "shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing border-border",
                                                        isOverdue && "border-destructive/50"
                                                    )}>
                                                        <CardContent className="p-3.5 space-y-3">
                                                            {/* Priority & Dropdown */}
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Badge variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'secondary' : 'outline'} className="text-[10px] uppercase font-bold px-1.5 py-0">
                                                                        {task.priority}
                                                                    </Badge>
                                                                    {typeof task.orderId === 'object' && task.orderId?.orderNumber && (
                                                                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-muted-foreground">
                                                                            #{task.orderId.orderNumber}
                                                                        </Badge>
                                                                    )}
                                                                </div>

                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-40 text-xs font-medium">
                                                                        {canManage && onEditTask && (
                                                                            <DropdownMenuItem onClick={() => onEditTask(task)}>
                                                                                <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Task
                                                                            </DropdownMenuItem>
                                                                        )}

                                                                        {task.status === 'pending' && (
                                                                            <DropdownMenuItem onClick={() => handleQuickStatusMove(task, 'in_progress')}>
                                                                                <PlayCircle className="mr-2 h-3.5 w-3.5" /> Start Work
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {task.status === 'in_progress' && onSubmitTask && (
                                                                            <DropdownMenuItem onClick={() => onSubmitTask(task)}>
                                                                                <Send className="mr-2 h-3.5 w-3.5" /> Submit Work
                                                                            </DropdownMenuItem>
                                                                        )}

                                                                        {canManage && task.status === 'under_review' && (
                                                                            <>
                                                                                <DropdownMenuItem onClick={() => handleReview(task._id, 'approve')}>
                                                                                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Approve
                                                                                </DropdownMenuItem>
                                                                                <DropdownMenuItem onClick={() => handleReview(task._id, 'reject')}>
                                                                                    <XCircle className="mr-2 h-3.5 w-3.5 text-destructive" /> Request Revision
                                                                                </DropdownMenuItem>
                                                                            </>
                                                                        )}

                                                                        {canManage && (
                                                                            <>
                                                                                <DropdownMenuSeparator />
                                                                                <DropdownMenuItem onClick={() => handleDelete(task._id)} className="text-destructive">
                                                                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                                                                </DropdownMenuItem>
                                                                            </>
                                                                        )}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>

                                                            {/* Title & Description */}
                                                            <div>
                                                                <h4 className="font-semibold text-xs text-foreground leading-snug line-clamp-2">
                                                                    {task.title}
                                                                </h4>
                                                                {task.description && (
                                                                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                                                        {task.description}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Output / Deliverable summary */}
                                                            {task.submissionNote && (
                                                                <div className="p-2 rounded-md bg-muted/50 border text-[11px] space-y-1">
                                                                    <div className="font-semibold flex items-center gap-1 text-muted-foreground text-[10px] uppercase">
                                                                        <Paperclip className="h-3 w-3" /> Output Logged
                                                                    </div>
                                                                    <p className="italic line-clamp-2 text-foreground">{task.submissionNote}</p>
                                                                    {task.submissionAttachment && (
                                                                        <a href={task.submissionAttachment} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary underline text-[10px]">
                                                                            <ExternalLink className="h-3 w-3" /> View Asset
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {task.status === 'rejected' && task.reviewNote && (
                                                                <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20 text-[11px] space-y-1">
                                                                    <div className="font-semibold flex items-center gap-1 text-destructive text-[10px] uppercase">
                                                                        <AlertCircle className="h-3 w-3" /> Revision Needed
                                                                    </div>
                                                                    <p className="text-foreground">{task.reviewNote}</p>
                                                                </div>
                                                            )}

                                                            {/* Assignee & Deadline */}
                                                            <div className="pt-2 border-t flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Avatar className="h-5 w-5">
                                                                        <AvatarImage src={task.assignedTo?.userId?.image} />
                                                                        <AvatarFallback className="text-[9px] font-bold bg-muted">
                                                                            {(task.assignedTo?.userId?.name || task.assignedTo?.name || '?').substring(0, 2).toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[80px]">
                                                                        {task.assignedTo?.userId?.name?.split(' ')[0] || task.assignedTo?.name || 'Unassigned'}
                                                                    </span>
                                                                </div>

                                                                <div className={cn("flex items-center gap-1 text-[10px] font-medium", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                                                                    <Clock className="h-3 w-3" />
                                                                    <span>{formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}</span>
                                                                </div>
                                                            </div>

                                                            {/* Quick Action Button */}
                                                            {task.status === 'pending' && (
                                                                <Button size="sm" variant="outline" onClick={() => handleQuickStatusMove(task, 'in_progress')} className="w-full h-7 text-xs font-semibold">
                                                                    <PlayCircle className="mr-1 h-3.5 w-3.5" /> Start Work
                                                                </Button>
                                                            )}
                                                            {task.status === 'in_progress' && onSubmitTask && (
                                                                <Button size="sm" variant="default" onClick={() => onSubmitTask(task)} className="w-full h-7 text-xs font-semibold">
                                                                    <Send className="mr-1 h-3.5 w-3.5" /> Submit Work
                                                                </Button>
                                                            )}
                                                            {canManage && task.status === 'under_review' && (
                                                                <div className="flex gap-2">
                                                                    <Button size="sm" variant="default" onClick={() => handleReview(task._id, 'approve')} className="flex-1 h-7 text-xs font-semibold">
                                                                        Approve
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" onClick={() => handleReview(task._id, 'reject')} className="flex-1 h-7 text-xs font-semibold text-destructive">
                                                                        Reject
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
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
