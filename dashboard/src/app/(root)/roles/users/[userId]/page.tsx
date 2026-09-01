'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAccessForm } from '@/components/roles/user-access-form';

function EditUserAccessContent() {
    const userId = String(useParams().userId ?? '');
    const callbackUrl =
        useSearchParams().get('callbackUrl') || '/roles?tab=users';

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon">
                    <Link href={callbackUrl} aria-label="Back">
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold">
                    Per-user permission overrides
                </h1>
            </div>

            <UserAccessForm userId={userId} callbackUrl={callbackUrl} />
        </div>
    );
}

export default function EditUserAccessPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-40 items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
            }
        >
            <EditUserAccessContent />
        </Suspense>
    );
}
