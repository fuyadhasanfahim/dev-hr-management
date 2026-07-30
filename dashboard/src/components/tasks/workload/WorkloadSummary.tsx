'use client';

import { cn } from '@/lib/utils';
import { ClipboardList, Zap, ShieldAlert, AlarmClockOff, UserCheck } from 'lucide-react';

interface WorkloadSummaryProps {
    totalTasks: number;
    inProgress: number;
    blocked: number;
    overdue: number;
    availableMembers: number;
}

function MetricCard({
    label,
    value,
    icon: Icon,
    tone,
}: {
    label: string;
    value: number;
    icon: React.ElementType;
    tone: 'default' | 'primary' | 'destructive' | 'warning' | 'success';
}) {
    return (
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border bg-card">
            <div
                className={cn(
                    'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
                    tone === 'default' && 'bg-muted text-muted-foreground',
                    tone === 'primary' && 'bg-primary/10 text-primary',
                    tone === 'destructive' && 'bg-destructive/10 text-destructive',
                    tone === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    tone === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                )}
            >
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
                <p className="text-lg font-semibold leading-none">{value}</p>
                <p className="text-[11px] text-muted-foreground font-medium truncate mt-1">{label}</p>
            </div>
        </div>
    );
}

export function WorkloadSummary({ totalTasks, inProgress, blocked, overdue, availableMembers }: WorkloadSummaryProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard label="Total Tasks" value={totalTasks} icon={ClipboardList} tone="default" />
            <MetricCard label="In Progress" value={inProgress} icon={Zap} tone="primary" />
            <MetricCard label="Blocked" value={blocked} icon={ShieldAlert} tone="destructive" />
            <MetricCard label="Overdue" value={overdue} icon={AlarmClockOff} tone="warning" />
            <MetricCard label="Available Members" value={availableMembers} icon={UserCheck} tone="success" />
        </div>
    );
}
