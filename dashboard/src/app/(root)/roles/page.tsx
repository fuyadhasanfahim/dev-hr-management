'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>
                                        {tab === 'roles'
                                            ? 'Slug'
                                            : tab === 'users'
                                              ? 'Role'
                                              : 'Code'}
                                    </TableHead>
                                    {tab === 'roles' && <TableHead>Type</TableHead>}
                                    <TableHead>
                                        {tab === 'users'
                                            ? 'Email'
                                            : 'Permissions'}
                                    </TableHead>
                                    <TableHead className="w-24 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.slice.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={tab === 'roles' ? 5 : 4}
                                            className="py-10 text-center text-sm text-muted-foreground"
                                        >
                                            Nothing here yet.
                                        </TableCell>
                                    </TableRow>
                                )}

                                {tab === 'roles' &&
                                    (rows.slice as RoleDoc[]).map((role) => (
                                        <TableRow key={role._id}>
                                            <TableCell className="font-medium">
                                                {role.name}
                                                {!role.isActive && (
                                                    <Badge
                                                        variant="outline"
                                                        className="ml-2"
                                                    >
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {role.slug}
                                            </TableCell>
                                            <TableCell>
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
                                            </TableCell>
                                            <TableCell>
                                                {permBadges(role.permissions)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canManageRoles && (
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            asChild
                                                            variant="ghost"
                                                            size="icon"
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
                                                                aria-label="Delete role"
                                                                onClick={() =>
                                                                    setToDelete(
                                                                        role,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
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
                                        <TableRow key={item._id}>
                                            <TableCell className="font-medium">
                                                {item.user?.name ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className="capitalize"
                                                >
                                                    {item.user?.role?.replace(
                                                        /_/g,
                                                        ' ',
                                                    ) ?? 'staff'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {item.user?.email ?? '—'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canAssign && item.userId && (
                                                    <Button
                                                        asChild
                                                        variant="ghost"
                                                        size="icon"
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
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                {(tab === 'departments' ||
                                    tab === 'designations') &&
                                    (
                                        rows.slice as {
                                            _id: string;
                                            name: string;
                                            code?: string;
                                            permissions?: string[];
                                        }[]
                                    ).map((item) => (
                                        <TableRow key={item._id}>
                                            <TableCell className="font-medium">
                                                {item.name}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {item.code ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                {permBadges(item.permissions ?? [])}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {canAssign && (
                                                    <Button
                                                        asChild
                                                        variant="ghost"
                                                        size="icon"
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
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
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
