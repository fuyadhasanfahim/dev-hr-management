'use client';

import { useState } from 'react';
import { ChevronDown, Download, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { isLocalMessageId, mediaUrl, type WhatsAppMessage } from '@/store/api/whatsappApi';

// Only a sent text message we wrote can be edited; anything not yet saved/sent can't be touched.
export const canEdit = (m: WhatsAppMessage) =>
    m.direction === 'outbound' && m.type === 'text' && !m.deleted && !isLocalMessageId(m.id) && m.status !== 'pending' && m.status !== 'failed';

export const canDelete = (m: WhatsAppMessage) => !m.deleted && !isLocalMessageId(m.id);

// Any attachment (photo, video, voice, PDF/file) that is still there to fetch.
export const canDownload = (m: WhatsAppMessage) => !!m.media && !m.deleted && !!mediaUrl(m);

const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/amr': 'amr',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
};

function downloadName(m: WhatsAppMessage) {
    const mime = (m.media?.mimeType ?? '').split(';')[0]!.trim().toLowerCase();
    const ext = EXT_BY_MIME[mime] ?? (mime.split('/')[1] ?? 'bin').replace(/[^a-z0-9]/g, '').slice(0, 5);
    const given = m.media?.filename?.trim();
    if (given) return /\.[a-z0-9]{1,5}$/i.test(given) ? given : `${given}.${ext}`;
    const d = new Date(m.createdAt);
    const stamp = Number.isNaN(d.getTime()) ? Date.now() : d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    return `whatsapp-${m.media?.voice ? 'voice' : m.type}-${stamp}.${ext}`;
}

// The media API is on another origin, where a plain <a download> just navigates away,
// so fetch it with the session cookie and hand the browser a same-origin blob to save.
export async function downloadMedia(m: WhatsAppMessage) {
    const src = mediaUrl(m);
    if (!src) return;
    const id = toast.loading('Downloading…');
    try {
        const res = await fetch(src, { credentials: 'include' });
        if (!res.ok) throw new Error(res.status === 404 ? 'File not found' : `Download failed (${res.status})`);
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName(m);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        toast.success('Download started', { id });
    } catch (err) {
        toast.error(
            err instanceof Error && err.message !== 'Failed to fetch'
                ? err.message
                : 'Could not download this file. WhatsApp may no longer have it.',
            { id },
        );
    }
}

// The little chevron that appears on a bubble (or a single tile/file inside a group) when hovered.
// Touch screens have no hover, so there it stays visible.
export function MessageMenu({
    message,
    onBubble,
    onEdit,
    onDelete,
    scope = 'bubble',
    overlay = false,
}: {
    message: WhatsAppMessage;
    onBubble: boolean;
    onEdit?: () => void;
    onDelete: () => void;
    scope?: 'bubble' | 'item'; // Which hover group reveals the chevron.
    overlay?: boolean; // Sits over a photo/video, so it needs its own backdrop.
}) {
    const download = canDownload(message);
    const edit = !!onEdit && canEdit(message);
    if (!edit && !canDelete(message) && !download) return null;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Message options"
                    className={cn(
                        'absolute top-0.5 right-1 z-10 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100',
                        scope === 'bubble' ? 'group-hover/bubble:opacity-100' : 'group-hover/item:opacity-100',
                        overlay
                            ? 'bg-black/55 text-white backdrop-blur-sm'
                            : onBubble
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground',
                    )}
                >
                    <ChevronDown className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {download && (
                    <DropdownMenuItem onSelect={() => void downloadMedia(message)}>
                        <Download /> Download
                    </DropdownMenuItem>
                )}
                {edit && (
                    <DropdownMenuItem onSelect={onEdit}>
                        <Pencil /> Edit
                    </DropdownMenuItem>
                )}
                {canDelete(message) && (
                    <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                        <Trash2 /> Delete
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function EditMessageDialog({
    message,
    saving,
    onClose,
    onSave,
}: {
    message: WhatsAppMessage | null;
    saving: boolean;
    onClose: () => void;
    onSave: (text: string) => void;
}) {
    return (
        <Dialog open={!!message} onOpenChange={(open) => !open && !saving && onClose()}>
            <DialogContent>
                {/* Remounted per message so the draft starts from its current text. */}
                {message && <EditForm key={message.id} message={message} saving={saving} onClose={onClose} onSave={onSave} />}
            </DialogContent>
        </Dialog>
    );
}

function EditForm({
    message,
    saving,
    onClose,
    onSave,
}: {
    message: WhatsAppMessage;
    saving: boolean;
    onClose: () => void;
    onSave: (text: string) => void;
}) {
    const [text, setText] = useState(message.body);
    const unchanged = !text.trim() || text.trim() === message.body;
    return (
        <>
            <DialogHeader>
                <DialogTitle>Edit message</DialogTitle>
                <DialogDescription>
                    WhatsApp can&apos;t edit a message that was already sent, so this only changes the CRM copy. The customer
                    still sees the original.
                </DialogDescription>
            </DialogHeader>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} autoFocus />
            <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={saving}>
                    Cancel
                </Button>
                <Button onClick={() => onSave(text.trim())} disabled={unchanged || saving}>
                    {saving && <Loader2 className="animate-spin" />} Save
                </Button>
            </DialogFooter>
        </>
    );
}

export function DeleteMessageDialog({
    message,
    busyScope,
    onClose,
    onDelete,
}: {
    message: WhatsAppMessage | null;
    busyScope: 'me' | 'everyone' | null; // The delete in flight, so only its own button spins.
    onClose: () => void;
    onDelete: (scope: 'me' | 'everyone') => void;
}) {
    const busy = busyScope !== null;
    return (
        <Dialog open={!!message} onOpenChange={(open) => !open && !busy && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete message?</DialogTitle>
                    <DialogDescription>
                        <b>Delete for me</b> hides it from your view only. <b>Delete for everyone</b> removes it for every agent
                        in the CRM. WhatsApp can&apos;t unsend a message through the API, so the customer keeps their copy.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:flex-wrap">
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="outline" onClick={() => onDelete('me')} disabled={busy}>
                        {busyScope === 'me' && <Loader2 className="animate-spin" />} Delete for me
                    </Button>
                    <Button variant="destructive" onClick={() => onDelete('everyone')} disabled={busy}>
                        {busyScope === 'everyone' && <Loader2 className="animate-spin" />} Delete for everyone
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
