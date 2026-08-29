'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PermissionMatrix } from './permission-matrix';
import {
    useCreateRoleMutation,
    useGetPermissionCatalogQuery,
    useUpdateRoleMutation,
    type RoleDoc,
} from '@/redux/features/role/roleApi';

interface RoleFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Omit to create a new role. */
    role?: RoleDoc | null;
}

function getErrorMessage(err: unknown, fallback: string): string {
    const data = (err as { data?: { message?: string } })?.data;
    return data?.message || fallback;
}

export function RoleFormDialog({ open, onOpenChange, role }: RoleFormDialogProps) {
    const isEdit = !!role;
    const { data: catalog, isLoading: catalogLoading } =
        useGetPermissionCatalogQuery();
    const [createRole, { isLoading: creating }] = useCreateRoleMutation();
    const [updateRole, { isLoading: updating }] = useUpdateRoleMutation();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [permissions, setPermissions] = useState<string[]>([]);

    useEffect(() => {
        if (!open) return;
        setName(role?.name ?? '');
        setSlug(role?.slug ?? '');
        setDescription(role?.description ?? '');
        setPermissions(role?.permissions ?? []);
    }, [open, role]);

    const saving = creating || updating;

    const handleSubmit = async () => {
        if (name.trim().length < 2) {
            toast.error('Name must be at least 2 characters.');
            return;
        }
        try {
            if (isEdit && role) {
                await updateRole({
                    slug: role.slug,
                    body: {
                        name: name.trim(),
                        description: description.trim(),
                        permissions,
                    },
                }).unwrap();
                toast.success(`Role "${name.trim()}" updated.`);
            } else {
                await createRole({
                    name: name.trim(),
                    slug: slug.trim() || undefined,
                    description: description.trim() || undefined,
                    permissions,
                }).unwrap();
                toast.success(`Role "${name.trim()}" created.`);
            }
            onOpenChange(false);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to save role.'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? `Edit "${role?.name}"` : 'New role'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? role?.isSystem
                                ? 'Built-in role — name and permissions are editable, the slug is fixed.'
                                : 'Update this role and its permissions.'
                            : 'Create a custom role and pick its permissions.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="role-name">Name</Label>
                            <Input
                                id="role-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Order Manager"
                                disabled={saving}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="role-slug">Slug</Label>
                            <Input
                                id="role-slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="auto from name"
                                disabled={saving || isEdit}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="role-desc">Description</Label>
                        <Textarea
                            id="role-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            disabled={saving}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Permissions</Label>
                        {catalogLoading || !catalog ? (
                            <div className="flex h-24 items-center justify-center">
                                <Loader className="h-5 w-5 animate-spin text-primary" />
                            </div>
                        ) : (
                            <PermissionMatrix
                                catalog={catalog}
                                value={permissions}
                                onChange={setPermissions}
                                disabled={saving}
                            />
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving && <Loader className="h-4 w-4 animate-spin" />}
                        {isEdit ? 'Save changes' : 'Create role'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
