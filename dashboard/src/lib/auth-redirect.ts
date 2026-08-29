/**
 * Sign-in now lives inside this app (dashboard is the auth host). These
 * helpers keep the old call sites working but point at the local
 * `/sign-in` route instead of a separate auth app.
 */
export const DASHBOARD_URL =
    process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

export function getSignInUrl(callbackUrl?: string) {
    if (typeof window === 'undefined') {
        return callbackUrl
            ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
            : '/sign-in';
    }
    const url = new URL('/sign-in', window.location.origin);
    if (callbackUrl) {
        url.searchParams.set('callbackUrl', callbackUrl);
    }
    return url.toString();
}

export function redirectToSignIn() {
    window.location.href = getSignInUrl(window.location.href);
}
