'use client';

import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useLazyGetPresignedDownloadUrlQuery, useLazyGetPresignedViewUrlQuery } from '@/store/api/chatApi';

export function isImageUrl(url: string): boolean {
    return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

const UUID_PREFIX = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}__/i;

/** The name the sender gave the file: new uploads keep it after the id ("<uuid>__Invoice.pdf"). */
export function getFileName(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        return decodeURIComponent(pathname.split('/').pop() || 'file').replace(UUID_PREFIX, '');
    } catch {
        return 'file';
    }
}

/** Known S3 folder prefixes that need a presigned view-URL. */
const S3_PREFIXES = [
    'chats/', 'tickets/',
    // Cloudinary → S3 migration folders
    'migrated-tickets/', 'migrated-ticket-messages/', 'migrated-chat-messages/',
];

function isS3Key(key: string): boolean {
    return S3_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * Extract the S3 object key from an attachment string.
 * Handles:
 *  - Full virtual-hosted URLs  https://bucket.s3.region.amazonaws.com/chats/…
 *  - Full path-style URLs      https://s3.region.amazonaws.com/bucket/chats/…
 *  - Presigned URLs (strips query params automatically via URL.pathname)
 *  - Bare keys                 chats/ref/uuid.png
 * Returns null (and logs) for Cloudinary / external URLs that don't need presigning.
 */
function extractS3Key(url: string): string | null {
    // Fast path: already a bare key (no protocol)
    if (isS3Key(url)) return url;

    try {
        const u = new URL(url);

        // Skip non-S3 URLs (e.g. Cloudinary, data URIs) — these are directly loadable
        if (!u.hostname.endsWith('.amazonaws.com')) return null;

        // Virtual-hosted style: pathname IS the key (after stripping leading /)
        const pathKey = decodeURIComponent(u.pathname.replace(/^\//, ''));
        if (isS3Key(pathKey)) return pathKey;

        // Path-style: pathname = /bucket-name/key — strip the first segment
        const withoutBucket = pathKey.replace(/^[^/]+\//, '');
        if (isS3Key(withoutBucket)) return withoutBucket;

        console.error('[extractS3Key] S3 URL matched amazonaws.com but key not recognised:', url, '→ extracted:', pathKey);
        return null;
    } catch {
        console.error('[extractS3Key] Unparseable attachment URL:', url);
        return null;
    }
}

export function AttachmentPreview({ url }: { url: string }) {
    // Files in the private bucket need a short-lived signed link; anything else loads as is. The result is
    // remembered together with the url it belongs to, so a changed url never shows the old file.
    const fileKey = extractS3Key(url);
    const [signed, setSigned] = useState<{ url: string; viewUrl: string | null } | null>(null);
    const [fetchViewUrl] = useLazyGetPresignedViewUrlQuery();
    const [fetchDownloadUrl] = useLazyGetPresignedDownloadUrlQuery();

    // Save the file: private files come with a link that S3 sends as an attachment under its real name.
    const download = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const href = fileKey ? (await fetchDownloadUrl(fileKey).unwrap()).viewUrl : url;
            const a = document.createElement('a');
            a.href = href;
            a.download = getFileName(url);
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch {
            toast.error('Couldn’t download the file');
        }
    };

    useEffect(() => {
        if (!fileKey) return;
        let cancelled = false;
        fetchViewUrl(fileKey)
            .unwrap()
            .then((data) => !cancelled && setSigned({ url, viewUrl: data.viewUrl }))
            .catch(() => !cancelled && setSigned({ url, viewUrl: null }));
        return () => {
            cancelled = true;
        };
    }, [url, fileKey, fetchViewUrl]);

    const loading = !!fileKey && signed?.url !== url;
    const error = !!fileKey && signed?.url === url && !signed.viewUrl;
    const viewUrl = fileKey ? (signed?.url === url ? signed.viewUrl : null) : url;

    if (loading) {
        return (
            <div className="mt-2 max-w-[220px]">
                <Skeleton className="h-20 w-full rounded-lg" />
            </div>
        );
    }

    if (error || !viewUrl) {
        return (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 max-w-[220px]">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Attachment unavailable</span>
            </div>
        );
    }

    if (isImageUrl(url)) {
        return (
            <div className="group/att relative mt-2 w-fit">
                <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL: next/image cannot cache it */}
                    <img
                        src={viewUrl}
                        alt={getFileName(url)}
                        className="max-w-[220px] max-h-[160px] rounded-lg object-cover border border-border/40 shadow-sm"
                        loading="lazy"
                    />
                </a>
                <button
                    type="button"
                    onClick={download}
                    aria-label="Download image"
                    title="Download"
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover/att:opacity-100 focus-visible:opacity-100"
                >
                    <Download className="size-3.5" />
                </button>
            </div>
        );
    }

    return (
        <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-background/60 border border-border/40 hover:bg-accent/50 transition-colors max-w-[220px]"
        >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs truncate flex-1">{getFileName(url)}</span>
            <button type="button" onClick={download} aria-label="Download file" title="Download" className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-accent">
                <Download className="size-3.5 text-muted-foreground" />
            </button>
        </a>
    );
}
