'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
    Search,
    MapPin,
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
    useGetAllBranchesQuery,
    useToggleBranchStatusMutation,
    useDeleteBranchMutation,
} from '@/redux/features/branch/branchApi';
import type { IBranch } from '@/types/branch.type';
import CreateBranch from '@/components/shifting/create-branch';
import EditBranchDialog from './EditBranchDialog';

export default function BranchManagement() {
    const { data, isLoading } = useGetAllBranchesQuery();
    const [toggleStatus, { isLoading: isToggling }] = useToggleBranchStatusMutation();
    const [deleteBranch, { isLoading: isDeleting }] = useDeleteBranchMutation();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [editingBranch, setEditingBranch] = useState<IBranch | null>(null);
    const [deletingBranch, setDeletingBranch] = useState<IBranch | null>(null);

    const branches = useMemo(() => data?.branches || [], [data]);

    const totalCount = branches.length;
    const activeCount = branches.filter((b) => b.isActive).length;
    const inactiveCount = totalCount - activeCount;

    const filteredBranches = useMemo(() => {
        return branches.filter((branch) => {
            const matchesSearch =
                search.trim() === '' ||
                branch.name.toLowerCase().includes(search.toLowerCase()) ||
                branch.code.toLowerCase().includes(search.toLowerCase()) ||
                (branch.address && branch.address.toLowerCase().includes(search.toLowerCase()));

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && branch.isActive) ||
                (statusFilter === 'inactive' && !branch.isActive);

            return matchesSearch && matchesStatus;
        });
    }, [branches, search, statusFilter]);

    const handleToggleStatus = async (branch: IBranch) => {
        try {
            await toggleStatus(branch._id).unwrap();
            toast.success(`Branch "${branch.name}" ${branch.isActive ? 'deactivated' : 'activated'}`);
        } catch (error: any) {
            toast.error(error?.data?.message || 'Failed to toggle status');
        }
    };

    const handleDelete = async () => {
        if (!deletingBranch) return;

        try {
            await deleteBranch(deletingBranch._id).unwrap();
            toast.success(`Branch "${deletingBranch.name}" deleted successfully`);
            setDeletingBranch(null);
        } catch (error: any) {
            toast.error(error?.data?.message || (error as Error).message || 'Failed to delete branch');
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
                                Total Branches
                            </p>
                            <h3 className="text-2xl font-bold mt-1">{totalCount}</h3>
                        </div>
                        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <MapPin className="size-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-xs">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Active Branches
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
                                Inactive Branches
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
                            placeholder="Search branches..."
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
                    <CreateBranch />
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Spinner className="size-6 text-primary" />
                        <p className="text-sm">Loading branches...</p>
                    </div>
                ) : filteredBranches.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground">
                        <MapPin className="size-10 mx-auto opacity-30 mb-2" />
                        <p className="font-medium text-sm">No branches found</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {search || statusFilter !== 'all'
                                ? 'Try changing your search or filter.'
                                : 'Get started by creating your first branch.'}
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                <TableHead className="w-[220px]">Branch Name</TableHead>
                                <TableHead className="w-[120px]">Code</TableHead>
                                <TableHead>Address</TableHead>
                                <TableHead className="w-[140px] text-center">Status</TableHead>
                                <TableHead className="w-[120px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredBranches.map((branch) => (
                                <TableRow key={branch._id} className="hover:bg-muted/30">
                                    <TableCell className="font-semibold text-foreground">
                                        {branch.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono text-xs uppercase bg-background">
                                            {branch.code}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                                        {branch.address || '—'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Switch
                                                checked={branch.isActive}
                                                disabled={isToggling}
                                                onCheckedChange={() => handleToggleStatus(branch)}
                                                className="data-[state=checked]:bg-emerald-600"
                                            />
                                            <Badge
                                                variant="secondary"
                                                className={`text-[11px] font-medium ${
                                                    branch.isActive
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                        : 'bg-muted text-muted-foreground'
                                                }`}
                                            >
                                                {branch.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setEditingBranch(branch)}
                                                className="size-8 text-muted-foreground hover:text-foreground"
                                                title="Edit branch"
                                            >
                                                <Edit2 className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setDeletingBranch(branch)}
                                                className="size-8 text-muted-foreground hover:text-destructive"
                                                title="Delete branch"
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
            <EditBranchDialog
                branch={editingBranch}
                open={!!editingBranch}
                onOpenChange={(open) => !open && setEditingBranch(null)}
            />

            {/* Delete Confirmation Alert */}
            <AlertDialog
                open={!!deletingBranch}
                onOpenChange={(open) => !open && setDeletingBranch(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Branch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete{' '}
                            <strong className="text-foreground font-semibold">
                                {deletingBranch?.name}
                            </strong>
                            ? This action cannot be undone. If employees are assigned to this branch,
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
                            {isDeleting ? <Spinner className="size-4" /> : 'Delete Branch'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
