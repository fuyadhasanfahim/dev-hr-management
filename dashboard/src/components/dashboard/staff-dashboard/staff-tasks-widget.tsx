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
        <Card className="h-full flex flex-col shadow-sm hover:shadow-md transition-shadow border-muted/50 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 bg-muted/5">
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
                        <Button variant="ghost" size="sm" className="text-[10px] text-primary font-bold uppercase tracking-wider h-6 px-2 gap-1 hover:bg-primary/10 rounded-full">
                            View All <ArrowRight className="h-3 w-3" />
                        </Button>
                    </Link>
                )}
            </CardHeader>

            <CardContent className="p-0 flex-1 flex flex-col justify-between">
                {!hasActiveTasks ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground px-4 flex-1">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-80" />
                        <p className="font-bold text-foreground text-sm">All Caught Up</p>
                        <p className="text-xs">No pending deadlines for you!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-muted/30 border-t border-muted/30">
                        {activeTasks.slice(0, 4).map((task: any) => {
                            const dueDate = new Date(task.dueDate);
                            const isOverdue = isPast(dueDate) && task.status !== 'under_review';
                            
                            return (
                                <Link href="/tasks" key={task._id} className="group block relative transition-all hover:bg-muted/30">
                                    {/* Priority Indicator Line */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${getPriorityStyles(task.priority)} opacity-70 transition-all group-hover:w-[4px] group-hover:opacity-100`} />
                                    
                                    <div className="pl-4 pr-4 py-3 flex flex-col gap-1">
                                        <div className="flex items-start justify-between w-full gap-2">
                                            <span className="text-xs font-bold text-foreground/90 leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                                                {task.title}
                                            </span>
                                            <div className={`shrink-0 flex items-center gap-1 text-[10px] font-bold tracking-tight whitespace-nowrap ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(dueDate, { addSuffix: true }).replace('about ', '')}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <span className="font-bold text-[9px] text-foreground/60 uppercase">#{task.orderId?.orderNumber || 'N/A'}</span>
                                                <span className="truncate font-normal">• {task.orderId?.quotationSnapshot?.clientName || 'Dev Task'}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 shrink-0">
                                                {task.status === 'under_review' && (
                                                    <Badge variant="outline" className="bg-amber-100/50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 text-[9px] font-bold h-4 px-1.5">
                                                        Review
                                                    </Badge>
                                                )}
                                                {isOverdue && (
                                                    <Badge variant="destructive" className="h-4 px-1.5 text-[9px] font-bold uppercase">
                                                        LATE
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {activeTasks.length > 4 && (
                    <Link href="/tasks" className="block w-full py-2.5 border-t border-muted/30 text-center text-[10px] font-bold tracking-wide text-muted-foreground hover:bg-muted/30 hover:text-primary transition-colors bg-muted/5 mt-auto">
                        + {activeTasks.length - 4} More Tasks
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}
