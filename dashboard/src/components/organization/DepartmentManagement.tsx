'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
    Search,
    Building2,
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
    useGetAllDepartmentsQuery,
    useToggleDepartmentStatusMutation,
    useDeleteDepartmentMutation,
} from '@/redux/features/department/departmentApi';
import type { IDepartment } from '@/types/department.type';
import CreateDepartmentDialog from './CreateDepartmentDialog';
import EditDepartmentDialog from './EditDepartmentDialog';

export default function DepartmentManagement() {
    const { data, isLoading, refetch } = useGetAllDepartmentsQuery();
    const [toggleStatus, { isLoading: isToggling }] = useToggleDepartmentStatusMutation();
    const [deleteDepartment, { isLoading: isDeleting }] = useDeleteDepartmentMutation();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [editingDepartment, setEditingDepartment] = useState<IDepartment | null>(null);
    const [deletingDepartment, setDeletingDepartment] = useState<IDepartment | null>(null);

    const departments = useMemo(() => data?.departments || [], [data]);

    const totalCount = departments.length;
    const activeCount = departments.filter((d) => d.isActive).length;
    const inactiveCount = totalCount - activeCount;

    const filteredDepartments = useMemo(() => {
        return departments.filter((dept) => {
            const matchesSearch =
                search.trim() === '' ||
                dept.name.toLowerCase().includes(search.toLowerCase()) ||
                dept.code.toLowerCase().includes(search.toLowerCase()) ||
                (dept.description && dept.description.toLowerCase().includes(search.toLowerCase()));

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && dept.isActive) ||
                (statusFilter === 'inactive' && !dept.isActive);

            return matchesSearch && matchesStatus;
        });
    }, [departments, search, statusFilter]);

    const handleToggleStatus = async (dept: IDepartment) => {
        try {
            await toggleStatus(dept._id).unwrap();
            toast.success(`Department "${dept.name}" ${dept.isActive ? 'deactivated' : 'activated'}`);
        } catch (error: any) {
            toast.error(error?.data?.message || 'Failed to toggle status');
        }
    };

    const handleDelete = async () => {
        if (!deletingDepartment) return;

        try {
            await deleteDepartment(deletingDepartment._id).unwrap();
            toast.success(`Department "${deletingDepartment.name}" deleted successfully`);
            setDeletingDepartment(null);
        } catch (error: any) {
            toast.error(error?.data?.message || (error as Error).message || 'Failed to delete department');
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
                                Total Departments
                            </p>
                            <h3 className="text-2xl font-bold mt-1">{totalCount}</h3>
                        </div>
                        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <Building2 className="size-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Active Departments
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
                                Inactive Departments
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
                <div className="flex flex-1 items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search departments..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>

                    <Select
                        value={statusFilter}
                        onValueChange={(val: any) => setStatusFilter(val)}
                    >
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active only</SelectItem>
                            <SelectItem value="inactive">Inactive only</SelectItem>
                        </SelectContent>
                    </Select>

                    {(search || statusFilter !== 'all') && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setSearch('');
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
                    <CreateDepartmentDialog />
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Spinner className="size-6 text-primary" />
                        <p className="text-sm">Loading departments...</p>
                    </div>
                ) : filteredDepartments.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground">
                        <Building2 className="size-10 mx-auto opacity-30 mb-2" />
                        <p className="font-medium text-sm">No departments found</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {search || statusFilter !== 'all'
                                ? 'Try changing your search or filter.'
                                : 'Get started by creating your first department.'}
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                <TableHead className="w-[220px]">Department Name</TableHead>
                                <TableHead className="w-[120px]">Code</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[140px] text-center">Status</TableHead>
                                <TableHead className="w-[120px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredDepartments.map((dept) => (
                                <TableRow key={dept._id} className="hover:bg-muted/30">
                                    <TableCell className="font-semibold text-foreground">
                                        {dept.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono text-xs uppercase bg-background">
                                            {dept.code}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                                        {dept.description || '—'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Switch
                                                checked={dept.isActive}
                                                disabled={isToggling}
                                                onCheckedChange={() => handleToggleStatus(dept)}
                                                className="data-[state=checked]:bg-emerald-600"
                                            />
                                            <Badge
                                                variant="secondary"
                                                className={`text-[11px] font-medium ${
                                                    dept.isActive
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                        : 'bg-muted text-muted-foreground'
                                                }`}
                                            >
                                                {dept.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setEditingDepartment(dept)}
                                                className="size-8 text-muted-foreground hover:text-foreground"
                                                title="Edit department"
                                            >
                                                <Edit2 className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setDeletingDepartment(dept)}
                                                className="size-8 text-muted-foreground hover:text-destructive"
                                                title="Delete department"
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
            <EditDepartmentDialog
                department={editingDepartment}
                open={!!editingDepartment}
                onOpenChange={(open) => !open && setEditingDepartment(null)}
            />

            {/* Delete Confirmation Alert */}
            <AlertDialog
                open={!!deletingDepartment}
                onOpenChange={(open) => !open && setDeletingDepartment(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Department?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete{' '}
                            <strong className="text-foreground font-semibold">
                                {deletingDepartment?.name}
                            </strong>
                            ? This action cannot be undone. If employees are assigned to this department,
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
                            {isDeleting ? <Spinner className="size-4" /> : 'Delete Department'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
