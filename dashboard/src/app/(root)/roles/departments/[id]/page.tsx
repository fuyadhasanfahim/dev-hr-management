'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScopePermissionForm } from '@/components/roles/scope-permission-form';
import { useGetAllDepartmentsQuery } from '@/redux/features/department/departmentApi';
import { useUpdateDepartmentPermissionsMutation } from '@/redux/features/role/roleApi';

function EditDepartmentPermsContent() {
    const id = String(useParams().id ?? '');
    const callbackUrl =
        useSearchParams().get('callbackUrl') || '/roles?tab=departments';

    const { data, isLoading } = useGetAllDepartmentsQuery();
    const dept = data?.departments.find((d) => d._id === id);
    const [updatePerms] = useUpdateDepartmentPermissionsMutation();

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon">
                    <Link href={callbackUrl} aria-label="Back">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold">
                    {dept ? `Department — ${dept.name}` : 'Department permissions'}
                </h1>
            </div>

            {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : !dept ? (
                <p className="text-sm text-muted-foreground">
                    Department not found.{' '}
                    <Link href={callbackUrl} className="underline">
                        Go back
                    </Link>
                    .
                </p>
            ) : (
                <ScopePermissionForm
                    value={dept.permissions ?? []}
                    savedLabel={dept.name}
                    callbackUrl={callbackUrl}
                    onSave={(permissions) =>
                        updatePerms({ id, permissions }).unwrap()
                    }
                />
            )}
        </div>
    );
}

export default function EditDepartmentPermsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            }
        >
            <EditDepartmentPermsContent />
        </Suspense>
    );
}
