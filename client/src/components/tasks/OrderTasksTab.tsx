'use client';

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
    useGetOrderTasksQuery,
    useDeleteTaskMutation,
    useReviewTaskMutation,
    useUpdateTaskStatusMutation,
    useSubmitTaskMutation,
} from '@/redux/features/task/taskApi';
import { useUpdateOrderTeamMutation } from '@/redux/features/order/orderApi';
import { useGetStaffsQuery } from '@/redux/features/staff/staffApi';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { AssignTaskModal } from './AssignTaskModal';
import {
    ClipboardList,
    UserCog,
    PlusCircle,
    MoreHorizontal,
    Trash2,
    CheckCircle2,
    XCircle,
    ExternalLink,
    Calendar,
    ShieldAlert,
    PlayCircle,
    Send,
    Clock,
    AlertCircle,
    FileText,
    Paperclip,
    Workflow,
    CircleDot,
    Loader2,
    History,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OrderTasksTabProps {
    order: any;
    canManage: boolean; // Higher tier roles: Admin, SuperAdmin, HR, TL
}

export function OrderTasksTab({ order, canManage }: OrderTasksTabProps) {
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [submitModalTask, setSubmitModalTask] = useState<any>(null);
    const [submitNote, setSubmitNote] = useState('');
    const [submitAttachment, setSubmitAttachment] = useState('');
    const { data: tasksRes, isLoading: isTasksLoading } = useGetOrderTasksQuery(
        order._id,
    );
    const [deleteTask] = useDeleteTaskMutation();
    const [reviewTask] = useReviewTaskMutation();
    const [updateTaskStatus] = useUpdateTaskStatusMutation();
    const [submitTask, { isLoading: isSubmitting }] = useSubmitTaskMutation();
    const [updateTeam, { isLoading: isUpdatingTeam }] =
        useUpdateOrderTeamMutation();
    const { data: staffsRes } = useGetStaffsQuery({ limit: 100 });

    const tasks = tasksRes?.data || [];
    const staffs = staffsRes?.staffs || [];

    // Setup handling for Team Leader nomination
    const handleSetTeamLeader = async (leaderId: string) => {
        try {
            await updateTeam({
                id: order._id,
                data: {
                    teamLeader: leaderId === 'none' ? undefined : leaderId,
                },
            }).unwrap();
            toast.success('Team Leader updated successfully.');
        } catch (err: any) {
            toast.error('Failed to update Team Leader.');
        }
    };

    const handleReview = async (
        taskId: string,
        decision: 'approve' | 'reject',
    ) => {
        try {
            await reviewTask({
                taskId,
                data: { decision, note: `Task ${decision}d by management.` },
            }).unwrap();
            toast.success(`Task successfully ${decision}d.`);
        } catch (err) {
            toast.error('Failed to record review decision.');
        }
    };

    const handleUpdateStatus = async (
        taskId: string,
        status: string,
        currentStatus: string,
    ) => {
        try {
            await updateTaskStatus({ taskId, status, currentStatus }).unwrap();
            toast.success(`Task marked as ${status.replace('_', ' ')}`);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to update status.');
        }
    };

    const handleSubmitForReview = async () => {
        if (!submitModalTask) return;
        try {
            await submitTask({
                taskId: submitModalTask._id,
                data: {
                    note: submitNote,
                    attachment: submitAttachment || undefined,
                },
            }).unwrap();
            toast.success('Task submitted for review!');
            setSubmitModalTask(null);
            setSubmitNote('');
            setSubmitAttachment('');
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to submit task.');
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm('Are you sure you want to remove this task assignment?'))
            return;
        try {
            await deleteTask(taskId).unwrap();
            toast.success('Task assignment deleted.');
        } catch (err) {
            toast.error('Failed to delete task.');
        }
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200';
            case 'under_review':
                return 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 border-amber-200';
            case 'in_progress':
                return 'bg-blue-500/15 text-blue-600 hover:bg-blue-500/20 border-blue-200';
            case 'rejected':
                return 'bg-red-500/15 text-red-600 hover:bg-red-500/20 border-red-200';
            default:
                return 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200';
        }
    };

    const getPriorityStyles = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'urgent':
                return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300';
            case 'high':
                return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300';
            case 'medium':
                return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300';
            case 'low':
                return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    const getStatusNodeStyles = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-950';
            case 'under_review':
                return 'bg-amber-50 border-amber-500 text-amber-600 dark:bg-amber-950';
            case 'in_progress':
                return 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-950 animate-pulse duration-[3000ms]';
            case 'rejected':
                return 'bg-red-50 border-red-500 text-red-600 dark:bg-red-950';
            default:
                return 'bg-muted/50 border-muted-foreground/30 text-muted-foreground';
        }
    };

    const getStatusAccentColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-emerald-500';
            case 'under_review':
                return 'bg-amber-500';
            case 'in_progress':
                return 'bg-blue-500';
            case 'rejected':
                return 'bg-red-500';
            default:
                return 'bg-muted-foreground/30';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="h-5 w-5" />;
            case 'under_review':
                return <FileText className="h-5 w-5" />;
            case 'in_progress':
                return <PlayCircle className="h-5 w-5" />;
            case 'rejected':
                return <XCircle className="h-5 w-5" />;
            default:
                return <CircleDot className="h-5 w-5" />;
        }
    };

    // Calculate progress summary
    const completedTasks = tasks.filter(
        (t: any) => t.status === 'completed',
    ).length;
    const totalTasks = tasks.length;
    const completionPct =
        totalTasks > 0 ? Math.floor((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Management Header Control Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="shadow-sm border-muted/60 backdrop-blur-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <UserCog className="h-4 w-4" /> Project Owner
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        {canManage ? (
                            <Select
                                disabled={isUpdatingTeam}
                                value={
                                    order.teamLeader?._id ||
                                    order.teamLeader ||
                                    ''
                                }
                                onValueChange={handleSetTeamLeader}
                            >
                                <SelectTrigger className="h-10 mt-1 font-bold border-dashed bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 transition-colors">
                                    <SelectValue placeholder="Assign Owner" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        value="none"
                                        className="text-muted-foreground italic"
                                    >
                                        Unassigned
                                    </SelectItem>
                                    {staffs.map((s: any) => (
                                        <SelectItem key={s._id} value={s._id}>
                                            {s.user?.name ||
                                                s.name ||
                                                'Unknown'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="flex items-center gap-2 mt-2 font-bold">
                                <ShieldAlert className="h-4 w-4 text-primary" />
                                {order.teamLeader
                                    ? staffs.find(
                                          (s: any) =>
                                              s._id ===
                                              (order.teamLeader?._id ||
                                                  order.teamLeader),
                                      )?.user?.name || 'Assigned Supervisor'
                                    : 'Not Assigned'}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 shadow-sm border-muted/60 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent border-l-4 border-l-indigo-500">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Workflow className="h-4 w-4 text-indigo-500" />{' '}
                                Pipeline Completion
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Real-time progression tracking
                            </CardDescription>
                        </div>
                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/40 px-2 rounded">
                            {completionPct}%
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                        <div className="w-full bg-muted h-3 rounded-full overflow-hidden relative shadow-inner border border-muted/40">
                            <div
                                className="absolute h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-1000 ease-out shadow-sm"
                                style={{ width: `${completionPct}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[11px] mt-2 text-muted-foreground font-semibold">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />{' '}
                                {completedTasks} Done
                            </span>
                            <span>{totalTasks} Active Milestones</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pipeline View Container */}
            <Card className="shadow-md border-t-4 border-t-primary/70 overflow-visible">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10 pb-4 pt-5 px-6">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-foreground">
                            <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            Execution Pipeline
                        </CardTitle>
                        <CardDescription className="text-xs pl-10">
                            Comprehensive overview of iterative progress and
                            deliverables.
                        </CardDescription>
                    </div>
                    {canManage && (
                        <Button
                            onClick={() => setIsAssignModalOpen(true)}
                            size="sm"
                            className="font-bold shadow-sm gap-2 h-9 px-4 bg-primary hover:bg-primary/90"
                        >
                            <PlusCircle className="h-4 w-4" />
                            Create Milestone
                        </Button>
                    )}
                </CardHeader>

                <CardContent className="p-6 sm:p-8 bg-slate-50/50 dark:bg-transparent">
                    {isTasksLoading ? (
                        <div className="space-y-8 pl-4 relative border-l-2 border-muted ml-5">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="relative">
                                    <div className="absolute -left-[29px] top-0 w-6 h-6 rounded-full bg-muted animate-pulse" />
                                    <Skeleton className="h-32 w-full rounded-xl" />
                                </div>
                            ))}
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="py-16 text-center flex flex-col items-center gap-4 bg-white dark:bg-card rounded-2xl border border-dashed border-muted-foreground/20 shadow-sm">
                            <div className="p-5 bg-primary/5 text-primary rounded-full ring-8 ring-primary/5">
                                <Workflow className="h-10 w-10 opacity-70" />
                            </div>
                            <div className="space-y-2 max-w-sm">
                                <h3 className="font-bold text-xl">
                                    No steps in this pipeline
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    This order has not been broken down into
                                    iterative pipeline milestones yet.
                                </p>
                            </div>
                            {canManage && (
                                <Button
                                    variant="default"
                                    size="lg"
                                    onClick={() => setIsAssignModalOpen(true)}
                                    className="mt-4 font-bold gap-2 px-6"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                    Setup Workflow Now
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {tasks.map((task: any, index: number) => (
                                <div
                                    key={task._id}
                                    className="relative pl-12 pb-10 last:pb-0 group/item"
                                >
                                    {/* Vertical Timeline Connector */}
                                    {index !== tasks.length - 1 && (
                                        <div className="absolute left-[19px] top-[40px] w-[2px] h-[calc(100%-32px)] bg-muted-foreground/20 group-hover/item:bg-primary/30 border-dashed border-l-2 transition-colors duration-300" />
                                    )}

                                    {/* Status Circle Node */}
                                    <div
                                        className={`absolute left-0 top-0 w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-sm z-10 transition-transform group-hover/item:scale-110 ${getStatusNodeStyles(task.status)}`}
                                    >
                                        {getStatusIcon(task.status)}
                                    </div>

                                    {/* Main Card Content */}
                                    <div className="bg-card border rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20 relative overflow-hidden group/card">
                                        {/* Side decorative stripe */}
                                        <div
                                            className={`absolute top-0 left-0 w-1.5 h-full ${getStatusAccentColor(task.status)} transition-all`}
                                        />

                                        <div className="p-5 sm:p-6 pl-7">
                                            {/* Header Row */}
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                                <div className="space-y-1.5 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="text-lg font-extrabold text-foreground tracking-tight">
                                                            {task.title}
                                                        </h4>
                                                        <div className="flex gap-1.5">
                                                            <Badge
                                                                variant="outline"
                                                                className={`${getStatusVariant(task.status)} uppercase font-bold text-[10px] px-2 py-0.5 rounded-full tracking-wider`}
                                                            >
                                                                {task.status.replace(
                                                                    '_',
                                                                    ' ',
                                                                )}
                                                            </Badge>
                                                            <Badge
                                                                variant="outline"
                                                                className={`${getPriorityStyles(task.priority)} uppercase font-bold text-[10px] px-2 py-0.5 rounded-full tracking-wider`}
                                                            >
                                                                {task.priority}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    {task.description && (
                                                        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                                                            {task.description}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Dropdown Actions */}
                                                <div className="shrink-0 flex self-start">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                            asChild
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-9 w-9 bg-muted/30 hover:bg-muted border opacity-80 hover:opacity-100"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent
                                                            align="end"
                                                            className="w-56 shadow-lg border-muted/40"
                                                        >
                                                            {/* Flow Actions based on status */}
                                                            {(task.status ===
                                                                'pending' ||
                                                                task.status ===
                                                                    'rejected') && (
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        handleUpdateStatus(
                                                                            task._id,
                                                                            'in_progress',
                                                                            task.status,
                                                                        )
                                                                    }
                                                                    className="text-blue-600 font-bold cursor-pointer py-2.5"
                                                                >
                                                                    <PlayCircle className="h-4 w-4 mr-2.5" />
                                                                    Begin Work
                                                                </DropdownMenuItem>
                                                            )}

                                                            {task.status ===
                                                                'in_progress' && (
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        setSubmitModalTask(
                                                                            task,
                                                                        );
                                                                        setSubmitNote(
                                                                            '',
                                                                        );
                                                                        setSubmitAttachment(
                                                                            '',
                                                                        );
                                                                    }}
                                                                    className="text-amber-600 font-bold cursor-pointer py-2.5"
                                                                >
                                                                    <Send className="h-4 w-4 mr-2.5" />
                                                                    Submit for
                                                                    Approval
                                                                </DropdownMenuItem>
                                                            )}

                                                            {canManage &&
                                                                task.status ===
                                                                    'under_review' && (
                                                                    <>
                                                                        <DropdownMenuItem
                                                                            onClick={() =>
                                                                                handleReview(
                                                                                    task._id,
                                                                                    'approve',
                                                                                )
                                                                            }
                                                                            className="text-emerald-600 font-bold cursor-pointer py-2.5"
                                                                        >
                                                                            <CheckCircle2 className="h-4 w-4 mr-2.5" />
                                                                            Approve
                                                                            Milestone
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onClick={() =>
                                                                                handleReview(
                                                                                    task._id,
                                                                                    'reject',
                                                                                )
                                                                            }
                                                                            className="text-orange-600 font-bold cursor-pointer py-2.5"
                                                                        >
                                                                            <XCircle className="h-4 w-4 mr-2.5" />
                                                                            Request
                                                                            Revision
                                                                        </DropdownMenuItem>
                                                                        <div className="h-px bg-muted my-1" />
                                                                    </>
                                                                )}

                                                            {(task.submissionAttachment ||
                                                                task.submissionNote) && (
                                                                <DropdownMenuItem
                                                                    asChild
                                                                    className="py-2.5"
                                                                >
                                                                    <div className="flex items-center pointer-events-none opacity-50 text-xs">
                                                                        <History className="h-4 w-4 mr-2.5" />{' '}
                                                                        Timeline
                                                                        Event
                                                                        Found
                                                                    </div>
                                                                </DropdownMenuItem>
                                                            )}

                                                            {canManage && (
                                                                <>
                                                                    <div className="h-px bg-muted my-1" />
                                                                    <DropdownMenuItem
                                                                        onClick={() =>
                                                                            handleDelete(
                                                                                task._id,
                                                                            )
                                                                        }
                                                                        className="text-destructive hover:text-white hover:bg-destructive focus:text-destructive cursor-pointer py-2.5 font-medium"
                                                                    >
                                                                        <Trash2 className="h-4 w-4 mr-2.5" />
                                                                        Remove
                                                                        Milestone
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>

                                            {/* Attributes Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 bg-slate-50 dark:bg-muted/20 -mx-7 px-7 py-4 border-t border-b border-muted/30">
                                                {/* Assigned Developer */}
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border-2 border-white shadow-sm dark:border-slate-800">
                                                        <AvatarImage
                                                            src={
                                                                task.assignedTo
                                                                    ?.userId
                                                                    ?.image ||
                                                                task.assignedTo
                                                                    ?.avatar
                                                            }
                                                        />
                                                        <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 font-bold">
                                                            {(
                                                                task.assignedTo
                                                                    ?.userId
                                                                    ?.name ||
                                                                task.assignedTo
                                                                    ?.name ||
                                                                '?'
                                                            )
                                                                .substring(0, 2)
                                                                .toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col justify-center">
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            Assigned Talent
                                                        </span>
                                                        <span className="font-bold text-sm text-foreground truncate max-w-[120px]">
                                                            {task.assignedTo
                                                                ?.userId
                                                                ?.name ||
                                                                task.assignedTo
                                                                    ?.name ||
                                                                'N/A'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Due Date */}
                                                <div className="flex items-center gap-3 border-l-0 md:border-l border-muted/30 md:pl-5">
                                                    <div className="h-9 w-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-muted/30 flex items-center justify-center text-muted-foreground">
                                                        <Calendar className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex flex-col justify-center">
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            Due Date
                                                        </span>
                                                        <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                                                            {format(
                                                                new Date(
                                                                    task.dueDate,
                                                                ),
                                                                'MMM d, yyyy',
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Countdown/Time Remaining */}
                                                <div className="flex items-center gap-3 border-l-0 md:border-l border-muted/30 md:pl-5">
                                                    <div className="h-9 w-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-muted/30 flex items-center justify-center text-muted-foreground">
                                                        <Clock className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex flex-col justify-center">
                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                            Timeline
                                                        </span>
                                                        <span className="text-xs font-medium text-foreground/80 italic">
                                                            {formatDistanceToNow(
                                                                new Date(
                                                                    task.dueDate,
                                                                ),
                                                                {
                                                                    addSuffix: true,
                                                                },
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Delivery / Submission Section */}
                                            {(task.submissionNote ||
                                                task.submissionAttachment ||
                                                task.reviewNote) && (
                                                <div className="mt-4 space-y-3 animate-in slide-in-from-top-1 duration-300">
                                                    {/* Proof of Deliverables */}
                                                    {(task.submissionNote ||
                                                        task.submissionAttachment) && (
                                                        <div className="bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-4 shadow-sm">
                                                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
                                                                <Paperclip className="h-3.5 w-3.5" />
                                                                <h5 className="text-[11px] font-black uppercase tracking-wider">
                                                                    Delivered
                                                                    Assets
                                                                </h5>
                                                            </div>

                                                            {task.submissionNote && (
                                                                <div className="mb-3 pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                                                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium italic">
                                                                        "
                                                                        {
                                                                            task.submissionNote
                                                                        }
                                                                        "
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {task.submissionAttachment && (
                                                                <a
                                                                    href={
                                                                        task.submissionAttachment
                                                                    }
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-2 text-xs bg-white dark:bg-slate-900 text-primary font-bold px-4 py-2 border border-slate-200 dark:border-slate-700 shadow-sm rounded-md hover:bg-primary hover:text-white transition-all hover:-translate-y-0.5"
                                                                >
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                    Access
                                                                    Deliverable
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Manager's Revision Feedback */}
                                                    {task.status ===
                                                        'rejected' &&
                                                        task.reviewNote && (
                                                            <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-lg p-4 shadow-sm">
                                                                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
                                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                                    <h5 className="text-[11px] font-black uppercase tracking-wider">
                                                                        Revision
                                                                        Required
                                                                    </h5>
                                                                </div>
                                                                <p className="text-sm text-red-900/80 dark:text-red-300 font-medium bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-100/50 dark:border-red-900/50">
                                                                    {
                                                                        task.reviewNote
                                                                    }
                                                                </p>
                                                            </div>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal Dialogs */}
            <AssignTaskModal
                open={isAssignModalOpen}
                onOpenChange={setIsAssignModalOpen}
                orderId={order._id}
                phases={order.quotationSnapshot?.scopeOfWork}
                existingTasks={tasks}
            />

            {/* Submit for Review Modal */}
            <Dialog
                open={!!submitModalTask}
                onOpenChange={(open) => {
                    if (!open) {
                        setSubmitModalTask(null);
                        setSubmitNote('');
                        setSubmitAttachment('');
                    }
                }}
            >
                <DialogContent className="sm:max-w-[460px] overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500" />
                    <DialogHeader className="pt-2">
                        <DialogTitle className="flex items-center gap-2.5 text-xl font-bold">
                            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-md">
                                <Send className="h-5 w-5" />
                            </div>
                            Submit to Review
                        </DialogTitle>
                        <DialogDescription>
                            Formally deliver this milestone for management
                            verification.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-3">
                        {/* Deliverable Link */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="asset-url"
                                className="text-sm font-bold flex items-center gap-1.5 text-foreground"
                            >
                                <Paperclip className="h-4 w-4 text-muted-foreground" />
                                Asset URL / Link
                            </Label>
                            <Input
                                id="asset-url"
                                type="url"
                                placeholder="e.g. https://github.com/..., Figma, Loom URL"
                                value={submitAttachment}
                                onChange={(e) =>
                                    setSubmitAttachment(e.target.value)
                                }
                                className="h-10"
                            />
                        </div>

                        {/* Detailed Note */}
                        <div className="space-y-2">
                            <Label className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                Delivery Note{' '}
                                <span className="text-red-500 font-black">
                                    *
                                </span>
                            </Label>
                            <Textarea
                                placeholder="Briefly state what has been accomplished or provide instructions for the reviewer..."
                                value={submitNote}
                                onChange={(e) => setSubmitNote(e.target.value)}
                                className="min-h-[110px] resize-none shadow-inner"
                            />
                        </div>
                    </div>

                    <DialogFooter className="bg-muted/30 -mx-6 -mb-6 px-6 py-4 mt-2 border-t flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setSubmitModalTask(null)}
                            disabled={isSubmitting}
                            className="font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmitForReview}
                            disabled={isSubmitting || !submitNote.trim()}
                            className="font-bold px-6 shadow-md bg-amber-500 hover:bg-amber-600 text-white transition-all"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Transmit Deliverable'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
