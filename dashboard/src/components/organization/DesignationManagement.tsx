'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
    Search,
    Briefcase,
    CheckCircle2,
    XCircle,
    Edit2,
    Trash2,
    RotateCcw,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

import {
    useGetAllDesignationsQuery,
    useToggleDesignationStatusMutation,
    useDeleteDesignationMutation,
} from '@/redux/features/designation/designationApi';
import { useGetAllDepartmentsQuery } from '@/redux/features/department/departmentApi';
import type { IDesignation } from '@/types/designation.type';
import CreateDesignationDialog from './CreateDesignationDialog';
import EditDesignationDialog from './EditDesignationDialog';

export default function DesignationManagement() {
    const { data, isLoading } = useGetAllDesignationsQuery();
    const { data: deptData } = useGetAllDepartmentsQuery();
    const [toggleStatus, { isLoading: isToggling }] = useToggleDesignationStatusMutation();
    const [deleteDesignation, { isLoading: isDeleting }] = useDeleteDesignationMutation();

    const [search, setSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [editingDesignation, setEditingDesignation] = useState<IDesignation | null>(null);
    const [deletingDesignation, setDeletingDesignation] = useState<IDesignation | null>(null);

    const designations = useMemo(() => data?.designations || [], [data]);
    const departments = useMemo(() => deptData?.departments || [], [deptData]);

    const totalCount = designations.length;
    const activeCount = designations.filter((d) => d.isActive).length;
    const inactiveCount = totalCount - activeCount;

    const filteredDesignations = useMemo(() => {
        return designations.filter((desig) => {
            const matchesSearch =
                search.trim() === '' ||
                desig.name.toLowerCase().includes(search.toLowerCase()) ||
                desig.code.toLowerCase().includes(search.toLowerCase()) ||
                (desig.department && desig.department.toLowerCase().includes(search.toLowerCase())) ||
                (desig.description && desig.description.toLowerCase().includes(search.toLowerCase()));

            const matchesDept =
                deptFilter === 'all' ||
                (deptFilter === 'none' && !desig.department) ||
                desig.department?.toLowerCase() === deptFilter.toLowerCase();

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && desig.isActive) ||
                (statusFilter === 'inactive' && !desig.isActive);

            return matchesSearch && matchesDept && matchesStatus;
        });
    }, [designations, search, deptFilter, statusFilter]);

    const handleToggleStatus = async (desig: IDesignation) => {
        try {
            await toggleStatus(desig._id).unwrap();
            toast.success(`Designation "${desig.name}" ${desig.isActive ? 'deactivated' : 'activated'}`);
        } catch (error: any) {
            toast.error(error?.data?.message || 'Failed to toggle status');
        }
    };

    const handleDelete = async () => {
        if (!deletingDesignation) return;

        try {
            await deleteDesignation(deletingDesignation._id).unwrap();
            toast.success(`Designation "${deletingDesignation.name}" deleted successfully`);
            setDeletingDesignation(null);
        } catch (error: any) {
            toast.error(error?.data?.message || (error as Error).message || 'Failed to delete designation');
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="border-border/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Total Designations
                            </p>
                            <h3 className="text-2xl font-bold mt-1">{totalCount}</h3>
                        </div>
                        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Briefcase className="size-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Active Designations
                            </p>
                            <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                                {activeCount}
                            </h3>
                        </div>
                        <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 className="size-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Inactive Designations
                            </p>
                            <h3 className="text-2xl font-bold mt-1 text-muted-foreground">
                                {inactiveCount}
                            </h3>
                        </div>
                        <div className="size-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
                            <XCircle className="size-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Action & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search designations..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>

                    <Select
                        value={deptFilter}
                        onValueChange={(val) => setDeptFilter(val)}
                    >
                        <SelectTrigger className="w-[160px] h-9">
                            <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            <SelectItem value="none">No Department</SelectItem>
                            {departments.map((d) => (
                                <SelectItem key={d._id} value={d.name}>
                                    {d.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={statusFilter}
                        onValueChange={(val: any) => setStatusFilter(val)}
                    >
                        <SelectTrigger className="w-[130px] h-9">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active only</SelectItem>
                            <SelectItem value="inactive">Inactive only</SelectItem>
                        </SelectContent>
                    </Select>

                    {(search || deptFilter !== 'all' || statusFilter !== 'all') && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setSearch('');
                                setDeptFilter('all');
                                setStatusFilter('all');
                            }}
                            title="Reset filters"
                            className="h-9 w-9"
                        >
                            <RotateCcw className="size-4" />
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <CreateDesignationDialog />
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Spinner className="size-6 text-primary" />
                        <p className="text-sm">Loading designations...</p>
                    </div>
                ) : filteredDesignations.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground">
                        <Briefcase className="size-10 mx-auto opacity-30 mb-2" />
                        <p className="font-medium text-sm">No designations found</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {search || deptFilter !== 'all' || statusFilter !== 'all'
                                ? 'Try changing your search or filter.'
                                : 'Get started by creating your first designation.'}
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                <TableHead className="w-[240px]">Designation Title</TableHead>
                                <TableHead className="w-[180px]">Code / Key</TableHead>
                                <TableHead className="w-[180px]">Department</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[140px] text-center">Status</TableHead>
                                <TableHead className="w-[120px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredDesignations.map((desig) => (
                                <TableRow key={desig._id} className="hover:bg-muted/30">
                                    <TableCell className="font-semibold text-foreground">
                                        {desig.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono text-xs bg-background">
                                            {desig.code}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {desig.department ? (
                                            <Badge variant="secondary" className="text-xs font-normal">
                                                {desig.department}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                                        {desig.description || '—'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Switch
                                                checked={desig.isActive}
                                                disabled={isToggling}
                                                onCheckedChange={() => handleToggleStatus(desig)}
                                                className="data-[state=checked]:bg-emerald-600"
                                            />
                                            <Badge
                                                variant="secondary"
                                                className={`text-[11px] font-medium ${
                                                    desig.isActive
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                        : 'bg-muted text-muted-foreground'
                                                }`}
                                            >
                                                {desig.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setEditingDesignation(desig)}
                                                className="size-8 text-muted-foreground hover:text-foreground"
                                                title="Edit designation"
                                            >
                                                <Edit2 className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setDeletingDesignation(desig)}
                                                className="size-8 text-muted-foreground hover:text-destructive"
                                                title="Delete designation"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Edit Dialog */}
            <EditDesignationDialog
                designation={editingDesignation}
                open={!!editingDesignation}
                onOpenChange={(open) => !open && setEditingDesignation(null)}
            />

            {/* Delete Confirmation Alert */}
            <AlertDialog
                open={!!deletingDesignation}
                onOpenChange={(open) => !open && setDeletingDesignation(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Designation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete{' '}
                            <strong className="text-foreground font-semibold">
                                {deletingDesignation?.name}
                            </strong>
                            ? This action cannot be undone. If employees currently hold this designation,
                            deletion will be prevented.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? <Spinner className="size-4" /> : 'Delete Designation'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
