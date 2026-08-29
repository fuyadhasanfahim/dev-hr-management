/**
 * The support app has no sign-in UI of its own. Unauthenticated users are
 * sent to the dashboard's `/sign-in` (the auth host); once signed in, the
 * shared `.webbriks.com` session cookie authenticates them here too and
 * they are redirected back via `callbackUrl`.
 */
export const DASHBOARD_URL =
    process.env.NEXT_PUBLIC_DASHBOARD_URL ||
    process.env.NEXT_PUBLIC_AUTH_URL || // fallback during the transition
    'http://localhost:3001';

export const SUPPORT_URL =
    process.env.NEXT_PUBLIC_SUPPORT_URL || 'http://localhost:3002';

export function getSignInUrl(callbackUrl?: string) {
    const base = `${DASHBOARD_URL}/sign-in`;
    if (callbackUrl) {
        return `${base}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    }
    return base;
}

export function redirectToSignIn() {
    window.location.href = getSignInUrl(
        typeof window !== 'undefined' ? window.location.href : SUPPORT_URL,
    );
}
