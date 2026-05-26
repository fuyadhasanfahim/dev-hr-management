'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { redirectToSignIn } from '@/lib/auth-redirect';

const ALLOWED_ROLES = new Set([
    'super_admin',
    'admin',
    'hr_manager',
    'team_leader',
    'staff',
]);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { data: session, isPending } = useSession();
    const hasRedirected = useRef(false);

    useEffect(() => {
        if (isPending || hasRedirected.current) return;
        if (!session) {
            hasRedirected.current = true;
            redirectToSignIn();
        }
    }, [session, isPending]);

    if (isPending) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        );
    }

    const role = (session.user as { role?: string }).role ?? '';
    if (!ALLOWED_ROLES.has(role)) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 text-center px-4">
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground text-sm max-w-sm">
                    You don&apos;t have permission to access the Support Console.
                </p>
                <a
                    href="https://webbriks.com"
                    className="text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                >
                    Return to WebBriks
                </a>
            </div>
        );
    }

    return <>{children}</>;
}
