'use client';

import { useState, useMemo } from 'react';
import { useSession } from '@/lib/auth-client';
import { Role } from '@/constants/role';
import {
    useGetMyTasksQuery,
    useSubmitTaskMutation,
} from '@/redux/features/task/taskApi';
import { useGetStaffsQuery } from '@/redux/features/staff/staffApi';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
    ClipboardList,
    Calendar,
    Send,
    ExternalLink,
    FileText,
    CheckCircle,
    Timer,
    AlertTriangle,
    LayoutGrid,
    List,
    Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
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
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [submissionLink, setSubmissionLink] = useState('');
    const [submissionNote, setSubmissionNote] = useState('');

    const tasks = tasksRes?.data || [];

    const handleOpenSubmit = (task: any) => {
        setSelectedTask(task);
        setSubmissionLink('');
        setSubmissionNote('');
        setIsSubmitModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!submissionNote) {
            toast.error('Please enter a brief submission note.');
            return;
        }
        try {
            await submitTask({
                taskId: selectedTask._id,
                data: { note: submissionNote, attachment: submissionLink },
            }).unwrap();
            toast.success('Mission work submitted for review!');
            setIsSubmitModalOpen(false);
        } catch (err) {
            toast.error('Failed to submit task work.');
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <Skeleton className="h-12 w-64" />
                <div className="grid gap-6">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                </div>
            </div>
        );
    }

    const getPriorityIcon = (p: string) => {
        switch (p) {
            case 'urgent':
                return <AlertTriangle className="h-4 w-4 text-destructive" />;
            case 'high':
                return <Timer className="h-4 w-4 text-secondary-foreground" />;
            default:
                return <ClipboardList className="h-4 w-4 opacity-50" />;
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <ClipboardList className="h-6 w-6 text-primary" />
                        Tasks & Board
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        Manage task assignments, feature checklists, and track completion across active orders.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {canManage && (
                        <Button
                            onClick={() => setIsAssignModalOpen(true)}
                            size="sm"
                            className="font-semibold gap-1.5 shadow-xs"
                        >
                            <Plus className="h-4 w-4" />
                            Assign Task
                        </Button>
                    )}

                    {/* View Mode Toggle */}
                    <div className="inline-flex items-center p-1 bg-muted rounded-lg border shadow-xs">
                        <Button
                            type="button"
                            variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('kanban')}
                            className="h-7 px-3 text-xs font-medium gap-1.5"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Kanban
                        </Button>
                        <Button
                            type="button"
                            variant={viewMode === 'list' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className="h-7 px-3 text-xs font-medium gap-1.5"
                        >
                            <List className="h-3.5 w-3.5" />
                            List
                        </Button>
                    </div>

                    <Badge variant="outline" className="text-xs px-3 py-1 font-semibold">
                        {tasks.filter((t: any) => ['pending', 'in_progress', 'rejected'].includes(t.status)).length} Active Tasks
                    </Badge>
                </div>
            </div>

            {viewMode === 'kanban' ? (
                <KanbanBoard
                    tasks={tasks}
                    canManage={canManage}
                    onSubmitTask={handleOpenSubmit}
                    staffs={staffs}
                />
            ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card border border-dashed rounded-2xl">
                    <div className="p-4 bg-muted rounded-full">
                        <CheckCircle className="h-12 w-12 text-muted-foreground opacity-30" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold">
                            You are all caught up!
                        </h3>
                        <p className="text-muted-foreground max-w-sm">
                            You currently have no assigned tasks needing action.
                            Take a coffee!
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {tasks.map((task: any) => {
                        const isOverdue =
                            isPast(new Date(task.dueDate)) &&
                            task.status !== 'completed';
                        return (
                            <Card
                                key={task._id}
                                className={`relative overflow-hidden border-l-4 ${isOverdue ? 'border-l-red-500' : 'border-l-primary/50'} shadow-md hover:shadow-lg transition-shadow duration-300`}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className="capitalize font-bold text-[10px] tracking-wider bg-muted/50"
                                                >
                                                    {task.priority}
                                                </Badge>
                                                {isOverdue && (
                                                    <Badge
                                                        variant="destructive"
                                                        className="text-[9px] font-black uppercase tracking-widest"
                                                    >
                                                        Overdue
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardTitle className="text-xl font-black leading-snug pt-1">
                                                {task.title}
                                            </CardTitle>
                                        </div>
                                        <div className="bg-muted/30 p-2 rounded-lg">
                                            {getPriorityIcon(task.priority)}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground font-medium">
                                            Order:
                                        </p>
                                        <Link
                                            href={`/orders/${task.orderId?._id}`}
                                            className="flex items-center gap-2 p-2 bg-accent/50 hover:bg-accent rounded-lg transition-colors group"
                                        >
                                            <div className="p-1.5 bg-background rounded border">
                                                <FileText className="h-4 w-4 opacity-70" />
                                            </div>
                                            <div className="flex flex-col text-left flex-1">
                                                <span className="text-xs font-bold text-foreground leading-tight">
                                                    {task.orderId
                                                        ?.quotationSnapshot
                                                        ?.clientName ||
                                                        'Active Order'}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                    {task.orderId
                                                        ?.orderNumber ||
                                                        'Unknown'}
                                                </span>
                                            </div>
                                            <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
                                        </Link>
                                    </div>

                                    <div className="bg-muted/20 p-3 rounded-lg text-sm leading-relaxed whitespace-pre-line border italic">
                                        {task.description ||
                                            'No detailed instructions provided.'}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t mt-4">
                                        <div className="flex flex-col text-xs">
                                            <span className="text-muted-foreground flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />{' '}
                                                Target Delivery
                                            </span>
                                            <span
                                                className={`font-bold mt-0.5 ${isOverdue ? 'text-red-600' : 'text-foreground'}`}
                                            >
                                                {format(
                                                    new Date(task.dueDate),
                                                    'MMM d, yyyy h:mm a',
                                                )}
                                            </span>
                                        </div>

                                        {task.status === 'under_review' ? (
                                            <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-bold">
                                                Under Review
                                            </Badge>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className="font-bold shadow-sm"
                                                onClick={() =>
                                                    handleOpenSubmit(task)
                                                }
                                            >
                                                <Send className="mr-2 h-3.5 w-3.5" />
                                                Submit Deliverables
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Submit Modal */}
            <Dialog
                open={isSubmitModalOpen}
                onOpenChange={setIsSubmitModalOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <Send className="h-5 w-5 text-primary" />
                            Submit Mission Outcomes
                        </DialogTitle>
                        <DialogDescription>
                            Attach proof of work or a description of the
                            deliverables for Admin review.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="font-bold">
                                Reference Link (GitHub, Drive, Figma)
                            </Label>
                            <Input
                                placeholder="https://..."
                                value={submissionLink}
                                onChange={(e) =>
                                    setSubmissionLink(e.target.value)
                                }
                                className="font-mono text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold">
                                Notes / Summary of Completion{' '}
                                <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                placeholder="What did you implement? Any blockers fixed?"
                                value={submissionNote}
                                onChange={(e) =>
                                    setSubmissionNote(e.target.value)
                                }
                                className="min-h-[100px] text-sm"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsSubmitModalOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="font-bold"
                        >
                            {isSubmitting ? 'Uploading...' : 'Send to Review'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Task Modal */}
            <AssignTaskModal
                open={isAssignModalOpen}
                onOpenChange={setIsAssignModalOpen}
                existingTasks={tasks}
            />
        </div>
    );
}
