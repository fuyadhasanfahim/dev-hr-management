'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RolePermissionForm } from '@/components/roles/role-permission-form';
import { useGetRolesQuery } from '@/redux/features/role/roleApi';

function EditRoleContent() {
    const slug = String(useParams().slug ?? '');
    const callbackUrl = useSearchParams().get('callbackUrl') || '/roles';

    const { data: roles, isLoading } = useGetRolesQuery();
    const role = roles?.find((r) => r.slug === slug);

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon">
                    <Link href={callbackUrl} aria-label="Back">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold">
                    {role ? `Edit "${role.name}"` : 'Edit role'}
                </h1>
            </div>

            {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : !role ? (
                <p className="text-sm text-muted-foreground">
                    Role not found.{' '}
                    <Link href={callbackUrl} className="underline">
                        Go back
                    </Link>
                    .
                </p>
            ) : (
                <RolePermissionForm role={role} callbackUrl={callbackUrl} />
            )}
        </div>
    );
}

export default function EditRolePage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            }
        >
            <EditRoleContent />
        </Suspense>
    );
}
