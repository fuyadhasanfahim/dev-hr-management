export const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL;
export const DASHBOARD_URL =
    process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3001';

export function getSignInUrl(callbackUrl?: string) {
    const base = `${AUTH_URL}/sign-in`;
    if (callbackUrl) {
        return `${base}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    }
    return base;
}

export function redirectToSignIn() {
    window.location.href = getSignInUrl(window.location.href);
}
