'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export interface WorkloadFiltersState {
    search: string;
    role: string;
    status: string;
    priority: string;
    availability: string;
    project: string;
}

interface WorkloadFiltersProps {
    value: WorkloadFiltersState;
    onChange: (next: WorkloadFiltersState) => void;
    roleOptions: { value: string; label: string }[];
    projectOptions?: { value: string; label: string }[];
}

const STATUS_OPTIONS = [
    { value: 'in_progress', label: 'In Progress' },
    { value: 'under_review', label: 'Review' },
    { value: 'pending', label: 'Pending' },
    { value: 'rejected', label: 'Blocked' },
    { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
];

const AVAILABILITY_OPTIONS = [
    { value: 'available', label: 'Available' },
    { value: 'busy', label: 'Busy' },
    { value: 'at_capacity', label: 'At Capacity' },
];

export function WorkloadFilters({ value, onChange, roleOptions, projectOptions }: WorkloadFiltersProps) {
    const isDirty =
        !!value.search || value.role !== 'all' || value.status !== 'all' || value.priority !== 'all' || value.availability !== 'all' || value.project !== 'all';

    const set = (patch: Partial<WorkloadFiltersState>) => onChange({ ...value, ...patch });

    return (
        <div className="p-3 bg-card border rounded-lg flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Search member or task..."
                    value={value.search}
                    onChange={(e) => set({ search: e.target.value })}
                    className="pl-8 h-9 text-xs"
                />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <Select value={value.role} onValueChange={(v) => set({ role: v })}>
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

                <Select value={value.status} onValueChange={(v) => set({ status: v })}>
                    <SelectTrigger size="sm" className="h-9 text-xs w-[130px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                                {s.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={value.priority} onValueChange={(v) => set({ priority: v })}>
                    <SelectTrigger size="sm" className="h-9 text-xs w-[120px]">
                        <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        {PRIORITY_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                                {p.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={value.availability} onValueChange={(v) => set({ availability: v })}>
                    <SelectTrigger size="sm" className="h-9 text-xs w-[130px]">
                        <SelectValue placeholder="Availability" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Availability</SelectItem>
                        {AVAILABILITY_OPTIONS.map((a) => (
                            <SelectItem key={a.value} value={a.value}>
                                {a.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {projectOptions && projectOptions.length > 0 && (
                    <Select value={value.project} onValueChange={(v) => set({ project: v })}>
                        <SelectTrigger size="sm" className="h-9 text-xs w-[140px]">
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

                {isDirty && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 text-xs gap-1"
                        onClick={() =>
                            onChange({ search: '', role: 'all', status: 'all', priority: 'all', availability: 'all', project: 'all' })
                        }
                    >
                        <X className="h-3.5 w-3.5" /> Reset
                    </Button>
                )}
            </div>
        </div>
    );
}
