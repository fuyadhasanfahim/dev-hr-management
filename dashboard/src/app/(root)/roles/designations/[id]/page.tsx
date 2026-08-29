'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScopePermissionForm } from '@/components/roles/scope-permission-form';
import { useGetAllDesignationsQuery } from '@/redux/features/designation/designationApi';
import { useUpdateDesignationPermissionsMutation } from '@/redux/features/role/roleApi';

function EditDesignationPermsContent() {
    const id = String(useParams().id ?? '');
    const callbackUrl =
        useSearchParams().get('callbackUrl') || '/roles?tab=designations';

    const { data, isLoading } = useGetAllDesignationsQuery();
    const desig = data?.designations.find((d) => d._id === id);
    const [updatePerms] = useUpdateDesignationPermissionsMutation();

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon">
                    <Link href={callbackUrl} aria-label="Back">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold">
                    {desig
                        ? `Designation — ${desig.name}`
                        : 'Designation permissions'}
                </h1>
            </div>

            {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : !desig ? (
                <p className="text-sm text-muted-foreground">
                    Designation not found.{' '}
                    <Link href={callbackUrl} className="underline">
                        Go back
                    </Link>
                    .
                </p>
            ) : (
                <ScopePermissionForm
                    value={desig.permissions ?? []}
                    savedLabel={desig.name}
                    callbackUrl={callbackUrl}
                    onSave={(permissions) =>
                        updatePerms({ id, permissions }).unwrap()
                    }
                />
            )}
        </div>
    );
}

export default function EditDesignationPermsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            }
        >
            <EditDesignationPermsContent />
        </Suspense>
    );
}
