'use client';

import { toast } from 'sonner';
import { MessageCircle, X } from 'lucide-react';
import { CustomerAvatar } from '@/components/support/customer-avatar';

export interface IncomingMessageEvent {
    conversationId: string;
    fromCustomer?: boolean;
    name?: string;
    preview?: string;
    assignedTo?: { id: string; name: string } | null;
}

/** A WhatsApp-style "new message" card; one per chat (a newer message replaces the older toast). */
export function showWhatsAppMessageToast(event: IncomingMessageEvent, onOpen: () => void) {
    const name = event.name ?? 'WhatsApp customer';
    toast.custom(
        (id) => (
            <div className="flex w-[356px] items-start gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg">
                <div className="relative shrink-0">
                    <CustomerAvatar name={name} className="size-10" />
                    <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-popover">
                        <MessageCircle className="size-2.5 text-white" />
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        toast.dismiss(id);
                        onOpen();
                    }}
                    className="min-w-0 flex-1 text-left"
                >
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{event.preview || 'New message'}</p>
                    <p className="mt-1 text-xs font-medium text-primary">
                        {event.assignedTo ? `Assigned to ${event.assignedTo.name} · ` : ''}Open chat
                    </p>
                </button>
                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => toast.dismiss(id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <X className="size-3.5" />
                </button>
            </div>
        ),
        { id: `wa-msg-${event.conversationId}`, duration: 8000 },
    );
}
