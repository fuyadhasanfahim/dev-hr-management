/**
 * Public backend origin (host + port, no path). Matches RTK `apiSlice` base
 * (`${origin}/api`) so PDF and other raw `fetch` calls hit the same host.
 */
export function getPublicApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

/** Full URL for an API path (must start with `/api/...`). */
export function publicApiUrl(path: string): string {
  const origin = getPublicApiOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!origin) return p;
  return `${origin}${p}`;
}
