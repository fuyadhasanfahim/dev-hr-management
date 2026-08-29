'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    useDeleteRoleMutation,
    useGetRolesQuery,
    type RoleDoc,
} from '@/redux/features/role/roleApi';
import { RoleFormDialog } from '@/components/roles/role-form-dialog';
import { usePermissions } from '@/hooks/use-permissions';

export function RolesTab() {
    const { data: roles, isLoading, isError, refetch } = useGetRolesQuery();
    const [deleteRole, { isLoading: deleting }] = useDeleteRoleMutation();
    const { can } = usePermissions();

    const canManage = can('role.manage');

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<RoleDoc | null>(null);
    const [toDelete, setToDelete] = useState<RoleDoc | null>(null);

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };
    const openEdit = (role: RoleDoc) => {
        setEditing(role);
        setFormOpen(true);
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        try {
            await deleteRole(toDelete.slug).unwrap();
            toast.success(`Role "${toDelete.name}" deleted.`);
            setToDelete(null);
        } catch (err) {
            const msg =
                (err as { data?: { message?: string } })?.data?.message ||
                'Failed to delete role.';
            toast.error(msg);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Bundles of permissions assigned to users.
                </p>
                {canManage && (
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" /> New role
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : isError ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                            Couldn&apos;t load roles.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            ) : (roles ?? []).length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                        <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">No roles yet</p>
                        <p className="max-w-sm text-xs text-muted-foreground">
                            Seed the built-in roles by running{' '}
                            <code className="font-mono">npm run seed:roles</code>{' '}
                            in <code className="font-mono">/server</code>, or
                            create one now.
                        </p>
                        {canManage && (
                            <Button size="sm" className="mt-1" onClick={openCreate}>
                                <Plus className="h-4 w-4" /> New role
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {(roles ?? []).map((role) => (
                        <Card key={role._id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            {role.name}
                                            {role.isSystem && (
                                                <Badge variant="secondary" className="gap-1">
                                                    <ShieldCheck className="h-3 w-3" />
                                                    Built-in
                                                </Badge>
                                            )}
                                            {!role.isActive && (
                                                <Badge variant="outline">Inactive</Badge>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="mt-0.5">
                                            <span className="font-mono text-xs">
                                                {role.slug}
                                            </span>
                                            {role.description
                                                ? ` — ${role.description}`
                                                : ''}
                                        </CardDescription>
                                    </div>
                                    {canManage && (
                                        <div className="flex shrink-0 gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEdit(role)}
                                                aria-label="Edit role"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            {!role.isSystem && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setToDelete(role)}
                                                    aria-label="Delete role"
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1">
                                    {role.permissions.length === 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            No permissions
                                        </span>
                                    )}
                                    {role.permissions.slice(0, 12).map((p) => (
                                        <Badge
                                            key={p}
                                            variant="outline"
                                            className="font-mono text-[10px]"
                                        >
                                            {p}
                                        </Badge>
                                    ))}
                                    {role.permissions.length > 12 && (
                                        <Badge variant="secondary" className="text-[10px]">
                                            +{role.permissions.length - 12} more
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <RoleFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                role={editing}
            />

            <AlertDialog
                open={!!toDelete}
                onOpenChange={(o) => !o && setToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete role &quot;{toDelete?.name}&quot;?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This cannot be undone. Roles that are still assigned
                            to users cannot be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmDelete();
                            }}
                            disabled={deleting}
                        >
                            {deleting && (
                                <Loader className="h-4 w-4 animate-spin" />
                            )}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
