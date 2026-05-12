'use client';

import { useGetMyTasksQuery } from '@/redux/features/task/taskApi';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ClipboardList,
    Calendar,
    ArrowRight,
    AlertCircle,
    CheckCircle2,
    Clock,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow, isPast } from 'date-fns';

export function StaffTasksWidget() {
    const { data: tasksRes, isLoading } = useGetMyTasksQuery(undefined);
    const tasks = tasksRes?.data || [];

    // Show only incomplete and not-under-review tasks ideally, or all pending tasks
    const activeTasks = tasks.filter((t: any) => t.status !== 'completed');

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
        );
    }

    const getPriorityStyles = (p: string) => {
        switch (p?.toLowerCase()) {
            case 'urgent': return 'bg-red-500 dark:bg-red-500';
            case 'high': return 'bg-orange-500 dark:bg-orange-400';
            case 'medium': return 'bg-blue-500 dark:bg-blue-400';
            default: return 'bg-slate-400 dark:bg-slate-600';
        }
    };

    const hasActiveTasks = activeTasks.length > 0;

    return (
        <Card className="h-full flex flex-col border-muted/50 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b bg-muted/5 backdrop-blur-sm">
                <div className="space-y-0.5">
                    <CardTitle className="text-base font-extrabold flex items-center gap-2 tracking-tight text-foreground">
                        <div className="p-1 bg-primary/10 rounded text-primary">
                            <ClipboardList className="h-3.5 w-3.5" />
                        </div>
                        Deadlines
                    </CardTitle>
                </div>
                {hasActiveTasks && (
                    <Link href="/tasks" passHref>
                        <Button variant="ghost" size="sm" className="text-[10px] text-primary font-black uppercase tracking-wider h-6 px-2 gap-1 hover:bg-primary/10 rounded-full">
                            View Queue <ArrowRight className="h-3 w-3" />
                        </Button>
                    </Link>
                )}
            </CardHeader>

            <CardContent className="p-0 flex-1">
                {!hasActiveTasks ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground px-4">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-1.5 opacity-80" />
                        <p className="font-bold text-foreground text-xs">Zero pending</p>
                    </div>
                ) : (
                    <div className="divide-y divide-muted/40">
                        {activeTasks.slice(0, 3).map((task: any) => {
                            const dueDate = new Date(task.dueDate);
                            const isOverdue = isPast(dueDate) && task.status !== 'under_review';
                            
                            return (
                                <Link href="/tasks" key={task._id} className="group block relative transition-all hover:bg-accent/40 active:scale-[0.99]">
                                    {/* Priority Indicator */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${getPriorityStyles(task.priority)} transition-all group-hover:w-[4px]`} />
                                    
                                    <div className="pl-4 pr-4 py-2.5 flex flex-col gap-1">
                                        <div className="flex items-center justify-between w-full gap-2">
                                            <span className="text-xs font-bold text-foreground leading-tight truncate max-w-[70%] group-hover:text-primary transition-colors">
                                                {task.title}
                                            </span>
                                            <div className={`shrink-0 flex items-center gap-1 text-[10px] font-black tracking-tighter whitespace-nowrap ${isOverdue ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-muted-foreground'}`}>
                                                <Clock className="h-2.5 w-2.5" />
                                                {formatDistanceToNow(dueDate, { addSuffix: true }).replace('about ', '')}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground/80">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <span className="font-bold text-[9px] bg-muted px-1.5 py-0.5 rounded text-foreground/70 uppercase">#{task.orderId?.orderNumber || 'N/A'}</span>
                                                <span className="truncate italic">{task.orderId?.quotationSnapshot?.clientName || 'Dev Task'}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 shrink-0">
                                                {task.status === 'under_review' && (
                                                    <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[8px] font-black uppercase px-1.5 rounded-full leading-none py-0.5 flex items-center">
                                                        Review
                                                    </span>
                                                )}
                                                {isOverdue && (
                                                    <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[8px] font-black uppercase px-1.5 rounded-full leading-none py-0.5 flex items-center">
                                                        LATE
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {activeTasks.length > 3 && (
                    <Link href="/tasks" className="block w-full py-1.5 border-t text-center text-[9px] font-black tracking-widest uppercase text-muted-foreground hover:bg-muted/20 hover:text-primary transition-colors">
                        + {activeTasks.length - 3} More Active Tasks
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}
