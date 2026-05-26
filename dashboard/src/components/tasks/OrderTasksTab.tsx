'use client';

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
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
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { AssignTaskModal } from './AssignTaskModal';
import { EditTaskModal } from './EditTaskModal';
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
    Edit3,
    ChevronRight,
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
import { cn } from '@/lib/utils';

interface OrderTasksTabProps {
    order: any;
    canManage: boolean; 
}

export function OrderTasksTab({ order, canManage }: OrderTasksTabProps) {
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [editTaskData, setEditTaskData] = useState<any>(null);
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

    const handleSetTeamLeader = async (leaderId: string) => {
        try {
            await updateTeam({
                id: order._id,
                data: {
                    teamLeader: leaderId === 'none' ? undefined : leaderId,
                },
            }).unwrap();
            toast.success('Project Owner assigned.');
        } catch (err: any) {
            toast.error('Failed to update Project Owner.');
        }
    };

    const handleReview = async (
        taskId: string,
        decision: 'approve' | 'reject',
    ) => {
        try {
            await reviewTask({
                taskId,
                data: { decision, note: `Task reviewed & ${decision}d.` },
            }).unwrap();
            toast.success(`Task explicitly ${decision}d.`);
        } catch (err) {
            toast.error('Failed to record review logic.');
        }
    };

    const handleUpdateStatus = async (
        taskId: string,
        status: string,
        currentStatus: string,
    ) => {
        try {
            await updateTaskStatus({ taskId, status, currentStatus }).unwrap();
            toast.success(`Marked as ${status.replace('_', ' ')}`);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Status jump restricted.');
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
            toast.success('Milestone successfully submitted for review!');
            setSubmitModalTask(null);
            setSubmitNote('');
            setSubmitAttachment('');
        } catch (err: any) {
            toast.error(err?.data?.message || 'Submission error.');
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm('Permanently eject this milestone from the pipeline?'))
            return;
        try {
            await deleteTask(taskId).unwrap();
            toast.success('Pipeline phase eradicated.');
        } catch (err) {
            toast.error('Failed deletion cascade.');
        }
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200/50';
            case 'under_review':
                return 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-200/50';
            case 'in_progress':
                return 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200/50';
            case 'rejected':
                return 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-200/50';
            default:
                return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getPriorityStyles = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'urgent':
                return 'bg-red-500 text-white border-transparent dark:bg-red-600';
            case 'high':
                return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300';
            case 'medium':
                return 'bg-blue-50 text-blue-700 border-blue-100';
            default:
                return 'bg-slate-50 text-slate-500 border-slate-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="h-4 w-4" />;
            case 'under_review':
                return <FileText className="h-4 w-4" />;
            case 'in_progress':
                return <Loader2 className="h-4 w-4 animate-spin" />;
            case 'rejected':
                return <XCircle className="h-4 w-4" />;
            default:
                return <CircleDot className="h-4 w-4" />;
        }
    };

    const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
    const totalTasks = tasks.length;
    const completionPct = totalTasks > 0 ? Math.floor((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Dynamic Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Card className="shadow-sm border-border/40 h-full">
                        <CardHeader className="p-5 pb-2">
                            <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <div className="p-1 bg-primary/10 rounded">
                                    <UserCog className="h-3.5 w-3.5 text-primary" />
                                </div>
                                Pipeline Commander
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 pt-1 flex flex-col justify-center h-full min-h-[60px]">
                            {canManage ? (
                                <Select
                                    disabled={isUpdatingTeam}
                                    value={order.teamLeader?._id || order.teamLeader || ''}
                                    onValueChange={handleSetTeamLeader}
                                >
                                    <SelectTrigger className="h-11 font-bold border border-muted-foreground/20 hover:border-primary/40 shadow-none bg-transparent transition-all">
                                        <SelectValue placeholder="Nominate Lead..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" className="text-muted-foreground italic">Remove Lead</SelectItem>
                                        {staffs.map((s: any) => (
                                            <SelectItem key={s._id} value={s._id}>
                                                {s.user?.name || s.name || 'System User'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="flex items-center gap-3 mt-1">
                                    <Avatar className="h-8 w-8 border shadow-sm">
                                        <AvatarFallback className="text-[10px] bg-primary/5 text-primary font-bold">
                                            <ShieldAlert className="h-3.5 w-3.5" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="font-bold text-sm">
                                        {order.teamLeader
                                            ? staffs.find((s: any) => s._id === (order.teamLeader?._id || order.teamLeader))?.user?.name || 'Assigned Supervisor'
                                            : 'Not Assigned'}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    className="md:col-span-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    <Card className="shadow-sm border-border/40 bg-gradient-to-br from-background via-background to-indigo-500/5 relative overflow-hidden h-full">
                        <div className="absolute top-0 right-0 opacity-10 p-2 transform translate-x-1/4 -translate-y-1/4">
                            <Workflow className="h-32 w-32 text-indigo-500" />
                        </div>
                        <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                            <div className="space-y-0.5">
                                <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Workflow className="h-3.5 w-3.5 text-indigo-500" />
                                    Project Phase Sync
                                </CardTitle>
                            </div>
                            <div className="text-2xl font-black text-indigo-600 flex items-baseline">
                                {completionPct}<span className="text-xs opacity-60 ml-0.5">%</span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-5 pt-2 pb-6">
                            <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden backdrop-blur-sm relative">
                                <motion.div
                                    className="absolute h-full bg-indigo-600"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${completionPct}%` }}
                                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mt-2.5 text-muted-foreground/80">
                                <span className="flex items-center gap-1.5 text-emerald-600">
                                    <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
                                    {completedTasks} Secured
                                </span>
                                <span>{totalTasks} Global Targets</span>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Execution Pipeline Module */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
            >
                <Card className="border-border/50 shadow-xl bg-card overflow-hidden ring-1 ring-black/5">
                    <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-primary to-indigo-500 w-full" />
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/5 py-5 px-6 border-b border-border/40">
                        <div>
                            <CardTitle className="text-lg font-black flex items-center gap-2.5 text-foreground tracking-tight">
                                <div className="p-1.5 bg-primary text-primary-foreground rounded shadow-md">
                                    <ClipboardList className="h-4 w-4" />
                                </div>
                                Pipeline Chronology
                            </CardTitle>
                        </div>
                        {canManage && (
                            <Button
                                onClick={() => setIsAssignModalOpen(true)}
                                size="sm"
                                className="font-bold shadow-md gap-2 h-9 px-5 bg-foreground hover:bg-foreground/90 text-background"
                            >
                                <PlusCircle className="h-3.5 w-3.5" />
                                Add Node
                            </Button>
                        )}
                    </CardHeader>

                    <CardContent className="p-0">
                        {isTasksLoading ? (
                            <div className="p-6 space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                                ))}
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="py-24 text-center flex flex-col items-center justify-center bg-muted/10">
                                <div className="p-6 bg-background rounded-full shadow-inner mb-4 border border-dashed">
                                    <Workflow className="h-10 w-10 opacity-20 text-muted-foreground" />
                                </div>
                                <h3 className="font-bold text-lg">Pipeline is currently vacant</h3>
                                <p className="text-muted-foreground text-sm mb-6 max-w-sm">Assign deliverables to kickstart tracking.</p>
                                {canManage && (
                                    <Button onClick={() => setIsAssignModalOpen(true)} className="font-bold gap-2 px-6 shadow-lg">
                                        <PlusCircle className="h-4 w-4" /> Initialize Workflow
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Accordion type="single" collapsible className="w-full divide-y divide-border/40">
                                <AnimatePresence mode="popLayout">
                                    {tasks.map((task: any, index: number) => {
                                        const isActive = task.status === 'in_progress';
                                        
                                        return (
                                            <motion.div 
                                                key={task._id} 
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                            >
                                                <AccordionItem value={task._id} className="border-none group relative">
                                                    {/* Active indicator light */}
                                                    {isActive && <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 shadow-[2px_0_8px_rgba(59,130,246,0.5)] z-10" />}
                                                    
                                                    <AccordionTrigger className="px-6 py-5 hover:bg-muted/30 transition-all text-left flex items-center hover:no-underline data-[state=open]:bg-muted/20 [&>svg]:hidden">
                                                        <div className="flex flex-1 items-center gap-4">
                                                            {/* Visual Status Node */}
                                                            <div className={cn(
                                                                "h-9 w-9 rounded-full flex items-center justify-center border-2 flex-shrink-0 shadow-sm group-data-[state=open]:scale-110 transition-transform duration-300",
                                                                task.status === 'completed' ? "bg-emerald-500/10 border-emerald-500 text-emerald-600" : 
                                                                task.status === 'in_progress' ? "bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]" :
                                                                task.status === 'rejected' ? "bg-rose-500/10 border-rose-500 text-rose-600" :
                                                                task.status === 'under_review' ? "bg-amber-500/10 border-amber-500 text-amber-600" : 
                                                                "bg-slate-100 border-slate-300 text-slate-400"
                                                            )}>
                                                                {getStatusIcon(task.status)}
                                                            </div>

                                                            {/* Main Row Information */}
                                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-x-6 gap-y-1">
                                                                <div className="flex flex-col justify-center">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-black text-[15px] tracking-tight text-foreground group-hover:text-primary transition-colors">
                                                                            {task.title}
                                                                        </span>
                                                                        <Badge variant="outline" className={cn("font-bold text-[9px] h-5 leading-none px-2 uppercase tracking-wider", getPriorityStyles(task.priority))}>
                                                                            {task.priority}
                                                                        </Badge>
                                                                    </div>
                                                                    <span className={cn("text-xs font-bold mt-1 capitalize", 
                                                                        task.status === 'completed' ? "text-emerald-600" : 
                                                                        task.status === 'in_progress' ? "text-blue-600" :
                                                                        "text-muted-foreground"
                                                                    )}>
                                                                        {task.status.replace('_', ' ')}
                                                                    </span>
                                                                </div>

                                                                {/* Assigned */}
                                                                <div className="hidden md:flex items-center gap-2.5">
                                                                    <Avatar className="h-7 w-7 border ring-2 ring-background ring-offset-1 ring-offset-muted/20">
                                                                        <AvatarImage src={task.assignedTo?.userId?.image} />
                                                                        <AvatarFallback className="bg-muted text-[9px] font-black">
                                                                            {(task.assignedTo?.userId?.name || '?').substring(0, 2).toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">Expert</span>
                                                                        <span className="text-xs font-bold text-foreground leading-tight truncate max-w-[100px]">
                                                                            {task.assignedTo?.userId?.name?.split(' ')[0] || 'Unassigned'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Clock / Deadline */}
                                                                <div className="hidden md:flex flex-col justify-center items-end text-right pr-4">
                                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                                                        <Clock className="h-3 w-3" /> 
                                                                        Expires
                                                                    </span>
                                                                    <span className={cn("text-xs font-bold mt-0.5", 
                                                                        new Date(task.dueDate) < new Date() && task.status !== 'completed' ? "text-rose-600" : "text-foreground"
                                                                    )}>
                                                                        {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-data-[state=open]:rotate-90 transition-transform duration-300 shrink-0 mr-1" />
                                                        </div>
                                                    </AccordionTrigger>

                                                    <AccordionContent className="bg-muted/10 px-6 pt-2 pb-6">
                                                        <motion.div 
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="pl-[52px]"
                                                        >
                                                            <div className="h-px bg-border/60 mb-6" />
                                                            
                                                            <div className="grid md:grid-cols-12 gap-6">
                                                                {/* Left Content Column */}
                                                                <div className="md:col-span-8 space-y-5">
                                                                    {task.description && (
                                                                        <div className="space-y-1.5">
                                                                            <h6 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Directive Scope</h6>
                                                                            <p className="text-sm text-foreground/90 leading-relaxed bg-card p-4 rounded-lg border shadow-sm font-medium">
                                                                                {task.description}
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    {/* Activity Timeline Inject (Submission / Review) */}
                                                                    {(task.submissionNote || task.reviewNote) && (
                                                                        <div className="space-y-3">
                                                                             {task.submissionNote && (
                                                                                <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 rounded p-4 space-y-2 shadow-sm">
                                                                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-black text-[10px] uppercase tracking-wider">
                                                                                        <Paperclip className="h-3.5 w-3.5" /> Artifact Delivered
                                                                                    </div>
                                                                                    <p className="text-sm italic text-blue-900 dark:text-blue-200 font-medium">"{task.submissionNote}"</p>
                                                                                    {task.submissionAttachment && (
                                                                                        <a href={task.submissionAttachment} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 bg-white border px-3 py-1.5 rounded shadow-sm hover:bg-blue-50 mt-1 transition-colors">
                                                                                            <ExternalLink className="h-3 w-3" /> Fetch Assets
                                                                                        </a>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            {task.status === 'rejected' && task.reviewNote && (
                                                                                <div className="bg-rose-50 dark:bg-rose-950/30 border-l-4 border-rose-500 rounded p-4 space-y-2 shadow-sm">
                                                                                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-black text-[10px] uppercase tracking-wider">
                                                                                        <AlertCircle className="h-3.5 w-3.5" /> Revision Memo
                                                                                    </div>
                                                                                    <p className="text-sm text-rose-900 dark:text-rose-200 font-medium">{task.reviewNote}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Right Meta & Control Column */}
                                                                <div className="md:col-span-4 flex flex-col gap-4 border-l border-dashed pl-6">
                                                                    <div className="space-y-3.5">
                                                                        <div className="flex items-center justify-between text-xs border-b pb-2 border-muted">
                                                                            <span className="text-muted-foreground font-medium flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Hard Deadline</span>
                                                                            <span className="font-black">{format(new Date(task.dueDate), 'MMM dd, yyyy')}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between text-xs border-b pb-2 border-muted">
                                                                            <span className="text-muted-foreground font-medium flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Sequence ID</span>
                                                                            <span className="font-mono text-[10px] opacity-70">{task._id.substring(18)}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Action Buttons Grid */}
                                                                    <div className="mt-auto pt-4 grid grid-cols-1 gap-2">
                                                                        {/* Operator Actions */}
                                                                        {(task.status === 'pending' || task.status === 'rejected') && (
                                                                            <Button size="sm" variant="default" onClick={() => handleUpdateStatus(task._id, 'in_progress', task.status)} className="w-full font-bold bg-blue-600 hover:bg-blue-700 shadow-md gap-2 h-9">
                                                                                <PlayCircle className="h-3.5 w-3.5" /> Initiate Execution
                                                                            </Button>
                                                                        )}
                                                                        {task.status === 'in_progress' && (
                                                                            <Button size="sm" variant="default" onClick={() => { setSubmitModalTask(task); setSubmitNote(''); setSubmitAttachment(''); }} className="w-full font-bold bg-amber-500 hover:bg-amber-600 shadow-md gap-2 h-9 text-white">
                                                                                <Send className="h-3.5 w-3.5" /> Ship Deliverable
                                                                            </Button>
                                                                        )}

                                                                        {/* Commander / Management Actions */}
                                                                        {canManage && task.status === 'under_review' && (
                                                                            <div className="flex gap-2 w-full">
                                                                                <Button size="sm" className="flex-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-1.5 h-9" onClick={() => handleReview(task._id, 'approve')}>
                                                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Pass
                                                                                </Button>
                                                                                <Button size="sm" variant="outline" className="flex-1 font-bold text-rose-600 border-rose-200 hover:bg-rose-50 shadow-sm gap-1.5 h-9" onClick={() => handleReview(task._id, 'reject')}>
                                                                                    <XCircle className="h-3.5 w-3.5" /> Fail
                                                                                </Button>
                                                                            </div>
                                                                        )}

                                                                        {/* Dynamic Controls Trigger */}
                                                                        {canManage && (
                                                                            <div className="pt-2 border-t border-dashed flex gap-2">
                                                                                 <Button variant="outline" size="sm" onClick={() => setEditTaskData(task)} className="flex-1 text-xs font-bold gap-1.5 hover:border-indigo-300 hover:text-indigo-700 transition-colors">
                                                                                    <Edit3 className="h-3 w-3" /> Edit
                                                                                </Button>
                                                                                <Button variant="outline" size="sm" onClick={() => handleDelete(task._id)} className="flex-1 text-xs font-bold text-rose-600 border-rose-100 hover:bg-rose-50 transition-colors">
                                                                                    <Trash2 className="h-3 w-3" /> Wipe
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </Accordion>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Modals Suite */}
            <AssignTaskModal
                open={isAssignModalOpen}
                onOpenChange={setIsAssignModalOpen}
                orderId={order._id}
                phases={order.quotationSnapshot?.scopeOfWork}
                existingTasks={tasks}
            />
            
            <EditTaskModal
                open={!!editTaskData}
                onOpenChange={(open) => !open && setEditTaskData(null)}
                task={editTaskData}
            />

            <Dialog open={!!submitModalTask} onOpenChange={(open) => !open && setSubmitModalTask(null)}>
                <DialogContent className="sm:max-w-[460px] overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500" />
                    <DialogHeader className="pt-2">
                        <DialogTitle className="flex items-center gap-2.5 text-xl font-black text-foreground tracking-tight">
                            <div className="p-1.5 bg-amber-100 text-amber-600 rounded">
                                <Send className="h-5 w-5" />
                            </div>
                            Logistical Delivery
                        </DialogTitle>
                        <DialogDescription className="font-medium">Formally commit deliverable outputs to central review authority.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-3">
                        <div className="space-y-2">
                            <Label htmlFor="url-input" className="font-bold flex items-center gap-1.5 text-foreground"><Paperclip className="h-4 w-4 text-muted-foreground" /> Output Matrix Link</Label>
                            <Input id="url-input" type="url" placeholder="Figma, Github, Vercel URL etc..." value={submitAttachment} onChange={(e) => setSubmitAttachment(e.target.value)} className="h-11 shadow-sm font-medium" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="note-input" className="font-bold flex items-center gap-1.5 text-foreground"><FileText className="h-4 w-4 text-muted-foreground" /> Narrative Log <span className="text-rose-500">*</span></Label>
                            <Textarea id="note-input" placeholder="Abstract of resolved items..." value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} className="min-h-[120px] resize-none shadow-sm leading-relaxed" />
                        </div>
                    </div>
                    <DialogFooter className="bg-muted/30 -mx-6 -mb-6 px-6 py-4 mt-2 border-t flex gap-2">
                        <Button variant="ghost" onClick={() => setSubmitModalTask(null)} disabled={isSubmitting} className="font-bold">Cancel</Button>
                        <Button onClick={handleSubmitForReview} disabled={isSubmitting || !submitNote.trim()} className="font-bold bg-amber-500 hover:bg-amber-600 text-white px-6 shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Engage Transfer"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
