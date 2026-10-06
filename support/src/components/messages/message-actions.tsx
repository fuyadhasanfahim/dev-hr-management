'use client';

import { useState } from 'react';
import { ChevronDown, Loader2, Pencil, Trash2 } from 'lucide-react';
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
import { isLocalMessageId, type WhatsAppMessage } from '@/store/api/whatsappApi';

// Only a sent text message we wrote can be edited; anything not yet saved/sent can't be touched.
export const canEdit = (m: WhatsAppMessage) =>
    m.direction === 'outbound' && m.type === 'text' && !m.deleted && !isLocalMessageId(m.id) && m.status !== 'pending' && m.status !== 'failed';

export const canDelete = (m: WhatsAppMessage) => !m.deleted && !isLocalMessageId(m.id);

// The little chevron that appears on a bubble when hovered.
export function MessageMenu({
    message,
    onBubble,
    onEdit,
    onDelete,
}: {
    message: WhatsAppMessage;
    onBubble: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) {
    if (!canEdit(message) && !canDelete(message)) return null;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Message options"
                    className={cn(
                        'absolute top-0.5 right-1 z-10 flex size-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/bubble:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
                        onBubble ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                    )}
                >
                    <ChevronDown className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {canEdit(message) && (
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
    busy,
    onClose,
    onDelete,
}: {
    message: WhatsAppMessage | null;
    busy: boolean;
    onClose: () => void;
    onDelete: (scope: 'me' | 'everyone') => void;
}) {
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
                        Delete for me
                    </Button>
                    <Button variant="destructive" onClick={() => onDelete('everyone')} disabled={busy}>
                        {busy && <Loader2 className="animate-spin" />} Delete for everyone
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
