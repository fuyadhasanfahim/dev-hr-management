export const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3000';
export const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL || 'http://localhost:3002';

export function getSignInUrl(callbackUrl?: string) {
    const base = `${AUTH_URL}/sign-in`;
    if (callbackUrl) {
        return `${base}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    }
    return base;
}

export function redirectToSignIn() {
    window.location.href = getSignInUrl(SUPPORT_URL);
}
