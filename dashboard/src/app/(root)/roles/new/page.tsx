'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RolePermissionForm } from '@/components/roles/role-permission-form';

function NewRoleContent() {
    const callbackUrl = useSearchParams().get('callbackUrl') || '/roles';

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon">
                    <Link href={callbackUrl} aria-label="Back">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold">New role</h1>
            </div>
            <RolePermissionForm callbackUrl={callbackUrl} />
        </div>
    );
}

export default function NewRolePage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            }
        >
            <NewRoleContent />
        </Suspense>
    );
}
