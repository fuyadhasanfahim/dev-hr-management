'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, differenceInCalendarDays } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useUpdateTaskMutation } from '@/redux/features/task/taskApi';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
    getTaskProgress,
    getOrderLabel,
    isTaskOverdue,
    STATUS_LABEL,
    PRIORITY_LABEL,
    type TaskItem,
    type WorkloadStatus,
} from '@/lib/task-progress';
import { Eye, ArrowRightLeft, UserRound } from 'lucide-react';

export interface MemberRow {
    staffId: string;
    name: string;
    designationLabel: string;
    currentTask: TaskItem | null;
    activeCount: number;
    totalCount: number;
    workloadStatus: WorkloadStatus;
}

interface WorkloadTableProps {
    members: MemberRow[];
    allMembers: MemberRow[];
}

const AVAILABILITY_META: Record<WorkloadStatus, { label: string; dot: string; badge: string }> = {
    available: { label: 'Available', dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent' },
    busy: { label: 'Busy', dot: 'bg-primary', badge: 'bg-primary/10 text-primary border-transparent' },
    at_capacity: { label: 'At Capacity', dot: 'bg-destructive', badge: 'bg-destructive/10 text-destructive border-transparent' },
};

const STATUS_BADGE_CLASS: Record<TaskItem['status'], string> = {
    pending: 'bg-muted text-muted-foreground border-transparent',
    in_progress: 'bg-primary/10 text-primary border-transparent',
    under_review: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent',
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent',
    rejected: 'bg-destructive/10 text-destructive border-transparent',
};

const PRIORITY_BADGE_CLASS: Record<TaskItem['priority'], string> = {
    low: 'bg-muted text-muted-foreground border-transparent',
    medium: 'bg-primary/10 text-primary border-transparent',
    high: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent',
    urgent: 'bg-destructive/10 text-destructive border-transparent',
};

function DueDate({ task }: { task: TaskItem }) {
    const overdue = isTaskOverdue(task);
    const due = new Date(task.dueDate);
    const days = Math.abs(differenceInCalendarDays(new Date(), due));

    return (
        <div className={cn('text-xs', overdue ? 'text-destructive font-semibold' : 'text-foreground')}>
            <div>{format(due, 'MMM dd')}</div>
            {overdue && <div className="text-[10px] font-normal">{days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} overdue`}</div>}
        </div>
    );
}

function MemberCell({ row }: { row: MemberRow }) {
    const meta = AVAILABILITY_META[row.workloadStatus];
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 border shrink-0">
                <AvatarFallback className="text-[10px] font-bold bg-muted">
                    {row.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate max-w-[140px]">{row.name}</span>
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dot)} title={meta.label} />
                </div>
                <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{row.designationLabel}</p>
            </div>
        </div>
    );
}

function CurrentTaskCell({ row }: { row: MemberRow }) {
    if (!row.currentTask) {
        return <span className="text-xs text-muted-foreground">No active task</span>;
    }
    const orderLabel = getOrderLabel(row.currentTask.orderId);
    const extra = Math.max(0, row.activeCount - 1);
    return (
        <div className="min-w-0 max-w-[220px]">
            <p className="text-xs font-semibold truncate">{row.currentTask.title}</p>
            <p className="text-[11px] text-muted-foreground truncate font-mono">
                {orderLabel || '—'}
                {extra > 0 && <span className="ml-1.5 text-primary font-medium">+{extra} more</span>}
            </p>
        </div>
    );
}

function MemberRowActions({ row, allMembers }: { row: MemberRow; allMembers: MemberRow[] }) {
    const [reassignTo, setReassignTo] = useState<string>('');
    const [open, setOpen] = useState(false);
    const [updateTask, { isLoading: isUpdating }] = useUpdateTaskMutation();

    const handleReassign = async () => {
        if (!row.currentTask || !reassignTo) return;
        
        try {
            await updateTask({ 
                taskId: row.currentTask._id, 
                data: { assignedTo: reassignTo } 
            }).unwrap();
            
            toast.success("Task reassigned successfully");
            setOpen(false);
        } catch (error: any) {
            toast.error(error?.data?.message || "Failed to reassign task");
        }
    };

    return (
        <div className="flex items-center justify-end gap-1.5">
            <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (val) setReassignTo(''); }}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Reassign">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        <span className="sr-only">Reassign</span>
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reassign Task</DialogTitle>
                        <DialogDescription>
                            {row.currentTask ? `Reassign "${row.currentTask.title}" to another team member.` : `Assign a task to ${row.name}.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Combobox
                            options={allMembers
                                .filter(m => m.staffId !== row.staffId)
                                .map(m => ({
                                    value: String(m.staffId),
                                    label: m.name,
                                    description: m.designationLabel
                                }))
                            }
                            value={reassignTo}
                            onChange={setReassignTo}
                            placeholder="Select member..."
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button 
                            disabled={!reassignTo || isUpdating}
                            onClick={handleReassign}
                        >
                            {isUpdating ? 'Reassigning...' : 'Confirm Reassign'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Button asChild variant="outline" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="View">
                <Link href={`/tasks/member/${row.staffId}`}>
                    <Eye className="h-3.5 w-3.5" />
                    <span className="sr-only">View</span>
                </Link>
            </Button>
        </div>
    );
}

export function WorkloadTable({ members, allMembers }: WorkloadTableProps) {
    if (members.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2 bg-card border border-dashed rounded-lg">
                <UserRound className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No team members match the current filters.</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop table */}
            <div className="hidden md:block bg-card border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[220px]">Member</TableHead>
                            <TableHead>Current Task</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[140px]">Progress</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Workload</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((row) => {
                            const progress = row.currentTask ? getTaskProgress(row.currentTask) : null;
                            const availMeta = AVAILABILITY_META[row.workloadStatus];
                            return (
                                <TableRow key={row.staffId}>
                                    <TableCell>
                                        <MemberCell row={row} />
                                    </TableCell>
                                    <TableCell>
                                        <CurrentTaskCell row={row} />
                                    </TableCell>
                                    <TableCell>
                                        {row.currentTask ? (
                                            <Badge className={cn('capitalize', STATUS_BADGE_CLASS[row.currentTask.status])}>
                                                {row.currentTask.status === 'rejected' ? 'Blocked' : STATUS_LABEL[row.currentTask.status]}
                                            </Badge>
                                        ) : (
                                            <Badge className={availMeta.badge}>{availMeta.label}</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {progress ? (
                                            <div className="flex items-center gap-2 w-[120px]">
                                                <Progress value={progress.pct} className="h-1.5 flex-1" />
                                                <span className="text-[11px] font-mono text-muted-foreground w-8 shrink-0">
                                                    {progress.pct}%
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {row.currentTask ? (
                                            <Badge variant="outline" className={cn('capitalize', PRIORITY_BADGE_CLASS[row.currentTask.priority])}>
                                                {PRIORITY_LABEL[row.currentTask.priority]}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {row.currentTask ? <DueDate task={row.currentTask} /> : <span className="text-xs text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs font-medium">
                                            {row.workloadStatus === 'at_capacity' ? (
                                                <span className="text-destructive">At Capacity</span>
                                            ) : (
                                                `${row.activeCount} Active`
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <MemberRowActions row={row} allMembers={allMembers} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
                {members.map((row) => {
                    const progress = row.currentTask ? getTaskProgress(row.currentTask) : null;
                    const availMeta = AVAILABILITY_META[row.workloadStatus];
                    return (
                        <div key={row.staffId} className="p-3.5 rounded-lg border bg-card space-y-2.5">
                            <MemberCell row={row} />

                            {row.currentTask ? (
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold truncate">{row.currentTask.title}</p>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Badge className={cn('capitalize', STATUS_BADGE_CLASS[row.currentTask.status])}>
                                            {row.currentTask.status === 'rejected' ? 'Blocked' : STATUS_LABEL[row.currentTask.status]}
                                        </Badge>
                                        <Badge variant="outline" className={cn('capitalize', PRIORITY_BADGE_CLASS[row.currentTask.priority])}>
                                            {PRIORITY_LABEL[row.currentTask.priority]}
                                        </Badge>
                                    </div>
                                    {progress && (
                                        <div className="flex items-center gap-2">
                                            <Progress value={progress.pct} className="h-1.5 flex-1" />
                                            <span className="text-[11px] font-mono text-muted-foreground w-8 shrink-0">{progress.pct}%</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Badge className={availMeta.badge}>{availMeta.label}</Badge>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t text-xs">
                                <div className="flex items-center gap-3">
                                    {row.currentTask && <DueDate task={row.currentTask} />}
                                    <span className="font-medium text-muted-foreground">
                                        {row.workloadStatus === 'at_capacity' ? (
                                            <span className="text-destructive">At Capacity</span>
                                        ) : (
                                            `${row.activeCount} Active`
                                        )}
                                    </span>
                                </div>
                                <MemberRowActions row={row} allMembers={allMembers} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
