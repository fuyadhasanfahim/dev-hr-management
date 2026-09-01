'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { TablePagination } from '@/components/roles/table-pagination';
import { usePermissions } from '@/hooks/use-permissions';
import {
    useDeleteRoleMutation,
    useGetRolesQuery,
    type RoleDoc,
} from '@/redux/features/role/roleApi';
import { useGetAllDepartmentsQuery } from '@/redux/features/department/departmentApi';
import { useGetAllDesignationsQuery } from '@/redux/features/designation/designationApi';
import { useGetStaffsQuery } from '@/redux/features/staff/staffApi';

const PER_PAGE = 20;
const TABS = ['roles', 'departments', 'designations', 'users'] as const;
type TabKey = (typeof TABS)[number];

function listUrl(tab: TabKey, page: number) {
    const qs = new URLSearchParams({ tab });
    if (page > 1) qs.set('page', String(page));
    return `/roles?${qs.toString()}`;
}

function permBadges(perms: string[]) {
    return (
        <div className="flex flex-wrap gap-1">
            {perms.length === 0 && (
                <span className="text-xs text-muted-foreground">None</span>
            )}
            {perms.slice(0, 6).map((p) => (
                <Badge key={p} variant="outline" className="font-mono text-[10px]">
                    {p}
                </Badge>
            ))}
            {perms.length > 6 && (
                <Badge variant="secondary" className="text-[10px]">
                    +{perms.length - 6}
                </Badge>
            )}
        </div>
    );
}

function RolesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { can } = usePermissions();
    const canManageRoles = can('role.manage');
    const canAssign = can('role.assign');

    const rawTab = searchParams.get('tab');
    const tab: TabKey = (TABS as readonly string[]).includes(rawTab ?? '')
        ? (rawTab as TabKey)
        : 'roles';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const currentUrl = listUrl(tab, page);
    const withCb = (base: string) =>
        `${base}?callbackUrl=${encodeURIComponent(currentUrl)}`;

    const setTab = (v: string) => router.push(listUrl(v as TabKey, 1));
    const setPage = (p: number) => router.push(listUrl(tab, p));

    const { data: roles, isLoading: rolesLoading } = useGetRolesQuery();
    const { data: deptData, isLoading: deptLoading } = useGetAllDepartmentsQuery();
    const { data: desigData, isLoading: desigLoading } =
        useGetAllDesignationsQuery();
    const { data: staffData, isLoading: staffLoading } = useGetStaffsQuery(
        { limit: 500 },
        { skip: tab !== 'users' },
    );

    const [deleteRole, { isLoading: deleting }] = useDeleteRoleMutation();
    const [toDelete, setToDelete] = useState<RoleDoc | null>(null);

    const confirmDelete = async () => {
        if (!toDelete) return;
        try {
            await deleteRole(toDelete.slug).unwrap();
            toast.success(`Role "${toDelete.name}" deleted.`);
            setToDelete(null);
        } catch (err) {
            toast.error(
                (err as { data?: { message?: string } })?.data?.message ||
                    'Failed to delete role.',
            );
        }
    };

    const rows = useMemo(() => {
        const src =
            tab === 'roles'
                ? (roles ?? [])
                : tab === 'departments'
                  ? (deptData?.departments ?? [])
                  : tab === 'designations'
                    ? (desigData?.designations ?? [])
                    : (staffData?.staffs ?? []);
        const totalPages = Math.max(1, Math.ceil(src.length / PER_PAGE));
        const clamped = Math.min(page, totalPages);
        const start = (clamped - 1) * PER_PAGE;
        return { slice: src.slice(start, start + PER_PAGE), totalPages, total: src.length };
    }, [tab, page, roles, deptData, desigData, staffData]);

    const loading =
        tab === 'roles'
            ? rolesLoading
            : tab === 'departments'
              ? deptLoading
              : tab === 'designations'
                ? desigLoading
                : staffLoading;

    return (
        <div className="w-full space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">Roles &amp; Permissions</h1>
                    <p className="text-sm text-muted-foreground">
                        Permission bundles for roles, departments and
                        designations, plus per-user overrides.
                    </p>
                </div>
                {tab === 'roles' && canManageRoles && (
                    <Button asChild>
                        <Link href={withCb('/roles/new')}>
                            <Plus className="h-4 w-4" /> New role
                        </Link>
                    </Button>
                )}
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="roles">Roles</TabsTrigger>
                    <TabsTrigger value="departments">Departments</TabsTrigger>
                    <TabsTrigger value="designations">Designations</TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                </TabsList>
            </Tabs>

            {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-32 animate-pulse rounded-xl border bg-muted/30"
                        />
                    ))}
                </div>
            ) : rows.slice.length === 0 ? (
                <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
                    Nothing here yet.
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {tab === 'roles' &&
                            (rows.slice as RoleDoc[]).map((role) => (
                                <Card key={role._id} className="flex flex-col">
                                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="truncate font-semibold">
                                                        {role.name}
                                                    </h3>
                                                    {!role.isActive && (
                                                        <Badge
                                                            variant="outline"
                                                            className="shrink-0 text-[10px]"
                                                        >
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                                                    {role.slug}
                                                </p>
                                            </div>
                                            {canManageRoles && (
                                                <div className="flex shrink-0 gap-0.5">
                                                    <Button
                                                        asChild
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                    >
                                                        <Link
                                                            href={withCb(
                                                                `/roles/${role.slug}`,
                                                            )}
                                                            aria-label="Edit role"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    {!role.isSystem && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            aria-label="Delete role"
                                                            onClick={() =>
                                                                setToDelete(role)
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            {role.isSystem ? (
                                                <Badge
                                                    variant="secondary"
                                                    className="gap-1"
                                                >
                                                    <ShieldCheck className="h-3 w-3" />
                                                    Built-in
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">
                                                    Custom
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="mt-auto border-t pt-3">
                                            {permBadges(role.permissions)}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                        {(tab === 'departments' || tab === 'designations') &&
                            (
                                rows.slice as {
                                    _id: string;
                                    name: string;
                                    code?: string;
                                    permissions?: string[];
                                }[]
                            ).map((item) => (
                                <Card key={item._id} className="flex flex-col">
                                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="truncate font-semibold">
                                                    {item.name}
                                                </h3>
                                                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                                                    {item.code ?? '—'}
                                                </p>
                                            </div>
                                            {canAssign && (
                                                <Button
                                                    asChild
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0"
                                                >
                                                    <Link
                                                        href={withCb(
                                                            `/roles/${tab}/${item._id}`,
                                                        )}
                                                        aria-label="Edit permissions"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>

                                        <div className="mt-auto border-t pt-3">
                                            {permBadges(item.permissions ?? [])}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                        {tab === 'users' &&
                            (
                                rows.slice as {
                                    _id: string;
                                    userId: string;
                                    user?: {
                                        name?: string;
                                        email?: string;
                                        role?: string;
                                    };
                                }[]
                            ).map((item) => (
                                <Card key={item._id} className="flex flex-col">
                                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="truncate font-semibold">
                                                    {item.user?.name ?? '—'}
                                                </h3>
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                    {item.user?.email ?? '—'}
                                                </p>
                                            </div>
                                            {canAssign && item.userId && (
                                                <Button
                                                    asChild
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0"
                                                >
                                                    <Link
                                                        href={withCb(
                                                            `/roles/users/${item.userId}`,
                                                        )}
                                                        aria-label="Edit permission overrides"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>

                                        <div className="mt-auto">
                                            <Badge
                                                variant="secondary"
                                                className="capitalize"
                                            >
                                                {item.user?.role?.replace(
                                                    /_/g,
                                                    ' ',
                                                ) ?? 'staff'}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                    </div>

                    <TablePagination
                        page={Math.min(page, rows.totalPages)}
                        totalPages={rows.totalPages}
                        onPageChange={setPage}
                    />
                </div>
            )}

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
                            This cannot be undone. A role that is still assigned
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

export default function RolesPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            }
        >
            <RolesContent />
        </Suspense>
    );
}
