'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { signOut } from '@/lib/auth-client';

const REDIRECT_URL =
    process.env.NEXT_PUBLIC_DEFAULT_REDIRECT ?? 'https://webbriks.com';

export default function SignOutPage() {
    useEffect(() => {
        signOut().finally(() => {
            window.location.replace(REDIRECT_URL);
        });
    }, []);

    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
}
