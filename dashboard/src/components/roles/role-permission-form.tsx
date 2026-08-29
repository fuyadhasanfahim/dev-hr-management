'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { PermissionMatrix } from './permission-matrix';
import {
    useCreateRoleMutation,
    useGetPermissionCatalogQuery,
    useUpdateRoleMutation,
    type RoleDoc,
} from '@/redux/features/role/roleApi';

interface RolePermissionFormProps {
    /** Omit for "create". */
    role?: RoleDoc;
    /** Where to go after save / cancel. */
    callbackUrl: string;
}

function errMessage(err: unknown, fallback: string) {
    return (
        (err as { data?: { message?: string } })?.data?.message || fallback
    );
}

export function RolePermissionForm({ role, callbackUrl }: RolePermissionFormProps) {
    const router = useRouter();
    const isEdit = !!role;

    const { data: catalog, isLoading: catalogLoading } =
        useGetPermissionCatalogQuery();
    const [createRole, { isLoading: creating }] = useCreateRoleMutation();
    const [updateRole, { isLoading: updating }] = useUpdateRoleMutation();

    const [name, setName] = useState(role?.name ?? '');
    const [slug, setSlug] = useState(role?.slug ?? '');
    const [description, setDescription] = useState(role?.description ?? '');
    const [permissions, setPermissions] = useState<string[]>(
        role?.permissions ?? [],
    );

    const saving = creating || updating;

    const submit = async () => {
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
            router.push(callbackUrl);
        } catch (err) {
            toast.error(errMessage(err, 'Failed to save role.'));
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
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
                </CardContent>
            </Card>

            <div className="space-y-2">
                <Label>Permissions</Label>
                {catalogLoading || !catalog ? (
                    <div className="flex h-32 items-center justify-center">
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

            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={() => router.push(callbackUrl)}
                    disabled={saving}
                >
                    Cancel
                </Button>
                <Button onClick={submit} disabled={saving}>
                    {saving && <Loader className="h-4 w-4 animate-spin" />}
                    {isEdit ? 'Save changes' : 'Create role'}
                </Button>
            </div>
        </div>
    );
}
