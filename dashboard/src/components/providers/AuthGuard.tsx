'use client';

import { useSession } from '@/lib/auth-client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { canAccessRoute } from '@/utils/canAccessRoute';
import { Role } from '@/constants/role';
import { redirectToSignIn } from '@/lib/auth-redirect';
import { usePermissions } from '@/hooks/use-permissions';

const publicRoutes = new Set([
    '/sign-in',
    '/forget-password',
    '/reset-password',
]);

// Loading spinner component
const LoadingSpinner = () => (
    <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { data: session, isPending } = useSession();
    const { can, isLoading: isPermsLoading } = usePermissions();
    const pathname = usePathname();
    const router = useRouter();
    const hasRedirected = useRef(false);

    // Memoize route checks to avoid unnecessary recalculations
    const isStaticRoute = useMemo(() => {
        return (
            pathname.startsWith('/_next') ||
            pathname.startsWith('/api') ||
            pathname === '/favicon.ico' ||
            pathname === '/robots.txt' ||
            pathname.startsWith('/assets')
        );
    }, [pathname]);

    const isPublicRoute = useMemo(() => {
        return (
            publicRoutes.has(pathname) ||
            pathname.startsWith('/sign-up')
        );
    }, [pathname]);

    useEffect(() => {
        // Reset redirect flag when pathname changes
        hasRedirected.current = false;
    }, [pathname]);

    useEffect(() => {
        // Skip if still pending or already redirected
        if (isPending || hasRedirected.current || isStaticRoute) return;

        // ❌ Not logged in
        if (!session) {
            if (isPublicRoute) return;
            hasRedirected.current = true;
            redirectToSignIn();
            return;
        }

        // ✅ Logged in user on public route → dashboard
        if (isPublicRoute || pathname === '/') {
            hasRedirected.current = true;
            router.replace('/dashboard');
            return;
        }

        // 🔐 Permission-based access (falls back to the legacy role map).
        // Wait for permissions to load so we don't bounce a user who is
        // actually allowed.
        if (isPermsLoading) return;

        const role = session.user?.role as Role | undefined;
        if (!canAccessRoute(pathname, role, can)) {
            hasRedirected.current = true;
            router.replace('/dashboard');
            return;
        }
    }, [
        session,
        isPending,
        isPermsLoading,
        can,
        pathname,
        router,
        isPublicRoute,
        isStaticRoute,
    ]);

    // Allow static routes immediately
    if (isStaticRoute) {
        return <>{children}</>;
    }

    // ⏳ Only show loading while session is being fetched
    if (isPending) {
        return <LoadingSpinner />;
    }

    // 🚫 Not logged in and not on public route - show loading while redirect happens
    if (!session && !isPublicRoute) {
        return <LoadingSpinner />;
    }

    // ✅ Logged in on public route - show loading while redirect happens
    if (session && (isPublicRoute || pathname === '/')) {
        return <LoadingSpinner />;
    }

    // ⏳ Logged in but permissions not resolved yet - avoid flashing a page
    // the user may not be allowed to see.
    if (session && isPermsLoading && !isPublicRoute) {
        return <LoadingSpinner />;
    }

    return <>{children}</>;
}
