'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import {
    useUpdateTaskStatusMutation,
    useReviewTaskMutation,
    useDeleteTaskMutation,
} from '@/redux/features/task/taskApi';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
    Clock,
    Search,
    UserCircle2,
    CheckCircle2,
    XCircle,
    PlayCircle,
    Send,
    Trash2,
    Edit3,
    ExternalLink,
    Paperclip,
    FileText,
    MoreVertical,
    AlertCircle,
    ArrowRight,
    CircleDot,
    Loader2,
    CheckSquare,
    Zap,
    Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskItem {
    _id: string;
    title: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'under_review' | 'completed' | 'rejected';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueDate: string;
    assignedTo?: {
        _id?: string;
        userId?: {
            _id?: string;
            name?: string;
            email?: string;
            image?: string;
        };
        name?: string;
    };
    orderId?: any;
    submissionNote?: string;
    submissionAttachment?: string;
    reviewNote?: string;
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
        title: 'Pending / Backlog',
        icon: CircleDot,
        accentColor: 'border-slate-300 dark:border-slate-700',
        headerBg: 'bg-slate-100/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300',
        badgeBg: 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
        dropHighlight: 'ring-2 ring-slate-400/50 bg-slate-500/5',
    },
    {
        id: 'in_progress',
        title: 'In Progress',
        icon: Zap,
        accentColor: 'border-blue-400 dark:border-blue-600',
        headerBg: 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
        badgeBg: 'bg-blue-200 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200',
        dropHighlight: 'ring-2 ring-blue-400/50 bg-blue-500/5',
    },
    {
        id: 'under_review',
        title: 'Under Review',
        icon: FileText,
        accentColor: 'border-amber-400 dark:border-amber-600',
        headerBg: 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
        badgeBg: 'bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200',
        dropHighlight: 'ring-2 ring-amber-400/50 bg-amber-500/5',
    },
    {
        id: 'completed',
        title: 'Completed',
        icon: CheckSquare,
        accentColor: 'border-emerald-400 dark:border-emerald-600',
        headerBg: 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
        badgeBg: 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200',
        dropHighlight: 'ring-2 ring-emerald-400/50 bg-emerald-500/5',
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

    // Filter tasks based on search, staff, and priority
    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => {
            // Search filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const titleMatch = t.title.toLowerCase().includes(query);
                const descMatch = t.description?.toLowerCase().includes(query);
                const assigneeName = t.assignedTo?.userId?.name || t.assignedTo?.name || '';
                const staffMatch = assigneeName.toLowerCase().includes(query);
                if (!titleMatch && !descMatch && !staffMatch) return false;
            }

            // Staff filter
            if (selectedStaff !== 'all') {
                const assigneeId = t.assignedTo?._id || t.assignedTo?.userId?._id;
                if (assigneeId !== selectedStaff) return false;
            }

            // Priority filter
            if (selectedPriority !== 'all') {
                if (t.priority !== selectedPriority) return false;
            }

            return true;
        });
    }, [tasks, searchQuery, selectedStaff, selectedPriority]);

    // Handle drag and drop column change
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

            // Validate transition permissions
            if (targetStatus === 'completed' && !canManage) {
                toast.error('Only Managers / PMs can move tasks directly to Completed.');
                return;
            }

            if (targetStatus === 'under_review' && currentStatus !== 'in_progress') {
                toast.error('Tasks must be In Progress before submitting for review.');
                return;
            }

            await updateTaskStatus({ taskId, status: targetStatus, currentStatus }).unwrap();
            toast.success(`Task moved to ${targetStatus.replace('_', ' ')}`);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to update task status.');
        }
    };

    const handleQuickStatusMove = async (task: TaskItem, newStatus: string) => {
        try {
            await updateTaskStatus({
                taskId: task._id,
                status: newStatus,
                currentStatus: task.status,
            }).unwrap();
            toast.success(`Task status updated to ${newStatus.replace('_', ' ')}`);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Status transition restricted.');
        }
    };

    const handleReview = async (taskId: string, decision: 'approve' | 'reject') => {
        try {
            await reviewTask({
                taskId,
                data: { decision, note: `Task reviewed & ${decision}d.` },
            }).unwrap();
            toast.success(`Task ${decision}d successfully!`);
        } catch (err: any) {
            toast.error('Failed to submit review decision.');
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm('Are you sure you want to delete this task permanently?')) return;
        try {
            await deleteTask(taskId).unwrap();
            toast.success('Task removed from board.');
        } catch (err: any) {
            toast.error('Failed to delete task.');
        }
    };

    const getPriorityBadgeClass = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'urgent':
                return 'bg-red-500 text-white font-bold animate-pulse';
            case 'high':
                return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300';
            case 'medium':
                return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300';
            default:
                return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
        }
    };

    // Calculate column counts
    const getColumnTasks = (colId: string) => {
        return filteredTasks.filter((t) => {
            if (colId === 'pending') return t.status === 'pending' || t.status === 'rejected';
            return t.status === colId;
        });
    };

    return (
        <div className="space-y-6">
            {/* Top Toolbar: Search & Filters */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search tasks, descriptions, or assignees..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 font-medium bg-background/80"
                    />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground">Filters:</span>
                    </div>

                    {/* Staff Filter */}
                    <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                        <SelectTrigger className="h-10 text-xs font-bold w-40 bg-background/80">
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

                    {/* Priority Filter */}
                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                        <SelectTrigger className="h-10 text-xs font-bold w-36 bg-background/80">
                            <SelectValue placeholder="All Priorities" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="urgent">🔴 Urgent</SelectItem>
                            <SelectItem value="high">🟠 High</SelectItem>
                            <SelectItem value="medium">🟡 Medium</SelectItem>
                            <SelectItem value="low">🟢 Low</SelectItem>
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
                            className="h-10 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                            Reset
                        </Button>
                    )}
                </div>
            </div>

            {/* Kanban Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start overflow-x-auto pb-4">
                {COLUMNS.map((col) => {
                    const colTasks = getColumnTasks(col.id);
                    const IconComp = col.icon;
                    const isDragOver = dragOverColumn === col.id;

                    return (
                        <div
                            key={col.id}
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDrop={(e) => handleDrop(e, col.id)}
                            className={cn(
                                'flex flex-col min-h-[550px] rounded-xl border border-border/60 bg-muted/20 backdrop-blur-sm transition-all duration-200 overflow-hidden',
                                isDragOver && col.dropHighlight
                            )}
                        >
                            {/* Column Header */}
                            <div className={cn('flex items-center justify-between p-3.5 border-b border-border/40 font-bold', col.headerBg)}>
                                <div className="flex items-center gap-2">
                                    <IconComp className="h-4 w-4" />
                                    <span className="text-xs uppercase tracking-wider font-extrabold">{col.title}</span>
                                </div>
                                <Badge variant="secondary" className={cn('font-black text-xs px-2 py-0.5 rounded-full', col.badgeBg)}>
                                    {colTasks.length}
                                </Badge>
                            </div>

                            {/* Cards Drop Area */}
                            <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[750px]">
                                <AnimatePresence mode="popLayout">
                                    {colTasks.length === 0 ? (
                                        <div className="h-36 flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-lg text-muted-foreground/60 p-4 text-center">
                                            <IconComp className="h-6 w-6 opacity-30 mb-1" />
                                            <span className="text-xs font-medium">No tasks here</span>
                                        </div>
                                    ) : (
                                        colTasks.map((task) => {
                                            const isOverdue = isPast(new Date(task.dueDate)) && task.status !== 'completed';
                                            const isBeingDragged = draggingTaskId === task._id;

                                            return (
                                                <motion.div
                                                    key={task._id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.96 }}
                                                    animate={{ opacity: isBeingDragged ? 0.4 : 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ duration: 0.2 }}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task)}
                                                    onDragEnd={() => handleDragEnd()}
                                                    className={cn(
                                                        'group relative bg-card border border-border/60 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-grab active:cursor-grabbing space-y-3',
                                                        isOverdue && 'border-rose-300 dark:border-rose-900/60 bg-rose-500/5'
                                                    )}
                                                >
                                                    {/* Card Header: Priority & Action Dropdown */}
                                                    <div className="flex items-center justify-between">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                'text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5',
                                                                getPriorityBadgeClass(task.priority)
                                                            )}
                                                        >
                                                            {task.priority}
                                                        </Badge>

                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                                                >
                                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-44 font-medium text-xs">
                                                                {canManage && onEditTask && (
                                                                    <DropdownMenuItem onClick={() => onEditTask(task)}>
                                                                        <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Task
                                                                    </DropdownMenuItem>
                                                                )}

                                                                {/* Status Moves */}
                                                                {task.status === 'pending' && (
                                                                    <DropdownMenuItem onClick={() => handleQuickStatusMove(task, 'in_progress')}>
                                                                        <PlayCircle className="mr-2 h-3.5 w-3.5 text-blue-500" /> Start Working
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {task.status === 'in_progress' && onSubmitTask && (
                                                                    <DropdownMenuItem onClick={() => onSubmitTask(task)}>
                                                                        <Send className="mr-2 h-3.5 w-3.5 text-amber-500" /> Submit Output
                                                                    </DropdownMenuItem>
                                                                )}

                                                                {canManage && task.status === 'under_review' && (
                                                                    <>
                                                                        <DropdownMenuItem onClick={() => handleReview(task._id, 'approve')}>
                                                                            <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-500" /> Approve Pass
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleReview(task._id, 'reject')}>
                                                                            <XCircle className="mr-2 h-3.5 w-3.5 text-rose-500" /> Reject / Revision
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}

                                                                {canManage && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            onClick={() => handleDelete(task._id)}
                                                                            className="text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-950/30"
                                                                        >
                                                                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Task
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>

                                                    {/* Card Title & Description */}
                                                    <div>
                                                        <h4 className="font-bold text-sm text-foreground tracking-tight line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                                                            {task.title}
                                                        </h4>
                                                        {task.description && (
                                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                                                {task.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Deliverables / Submission Banner if Under Review or Rejected */}
                                                    {task.submissionNote && (
                                                        <div className="p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 space-y-1 text-xs">
                                                            <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300 text-[10px] uppercase">
                                                                <Paperclip className="h-3 w-3" /> Output Logged
                                                            </div>
                                                            <p className="text-blue-900 dark:text-blue-200 text-xs italic font-medium line-clamp-2">
                                                                "{task.submissionNote}"
                                                            </p>
                                                            {task.submissionAttachment && (
                                                                <a
                                                                    href={task.submissionAttachment}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 font-bold text-[10px] text-blue-600 underline hover:text-blue-800 mt-0.5"
                                                                >
                                                                    <ExternalLink className="h-3 w-3" /> View Asset Link
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}

                                                    {task.status === 'rejected' && task.reviewNote && (
                                                        <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300">
                                                            <div className="flex items-center gap-1 font-bold text-[10px] uppercase text-rose-600">
                                                                <AlertCircle className="h-3 w-3" /> Revision Requested
                                                            </div>
                                                            <p className="text-xs font-medium mt-0.5 line-clamp-2">{task.reviewNote}</p>
                                                        </div>
                                                    )}

                                                    {/* Footer: Assignee & Deadline */}
                                                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                                                        {/* Assignee */}
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-6 w-6 border shadow-xs">
                                                                <AvatarImage src={task.assignedTo?.userId?.image} />
                                                                <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-black">
                                                                    {(task.assignedTo?.userId?.name || task.assignedTo?.name || '?')
                                                                        .substring(0, 2)
                                                                        .toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-xs font-medium text-foreground truncate max-w-[90px]">
                                                                {task.assignedTo?.userId?.name?.split(' ')[0] || task.assignedTo?.name || 'Unassigned'}
                                                            </span>
                                                        </div>

                                                        {/* Deadline */}
                                                        <div
                                                            className={cn(
                                                                'flex items-center gap-1 text-[11px] font-bold',
                                                                isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
                                                            )}
                                                        >
                                                            <Clock className="h-3 w-3" />
                                                            <span>{formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}</span>
                                                        </div>
                                                    </div>

                                                    {/* Quick Action Button for Status Transition */}
                                                    <div className="pt-1">
                                                        {task.status === 'pending' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleQuickStatusMove(task, 'in_progress')}
                                                                className="w-full h-8 text-xs font-bold gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950/40"
                                                            >
                                                                <PlayCircle className="h-3.5 w-3.5" /> Start Work
                                                            </Button>
                                                        )}
                                                        {task.status === 'in_progress' && onSubmitTask && (
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                onClick={() => onSubmitTask(task)}
                                                                className="w-full h-8 text-xs font-bold gap-1 bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                                                            >
                                                                <Send className="h-3.5 w-3.5" /> Submit Work
                                                            </Button>
                                                        )}
                                                        {canManage && task.status === 'under_review' && (
                                                            <div className="flex gap-1.5">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleReview(task._id, 'approve')}
                                                                    className="flex-1 h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                >
                                                                    Approve
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleReview(task._id, 'reject')}
                                                                    className="flex-1 h-7 text-[11px] font-bold text-rose-600 border-rose-200 hover:bg-rose-50"
                                                                >
                                                                    Reject
                                                                </Button>
                                                            </div>
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
