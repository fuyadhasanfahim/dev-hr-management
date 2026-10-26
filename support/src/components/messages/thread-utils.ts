import { cn } from '@/lib/utils';

// Messages from the same sender closer together than this stack as one group.
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

// A quick, slightly springy "pop" from the sender's side — iMessage-like.
export const bubbleSpring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } as const;

export function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}


export function dateLabel(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export function bubbleCorners(isMe: boolean, first: boolean, last: boolean): string {
    const joinedTop = isMe ? 'rounded-tr-md' : 'rounded-tl-md';
    const joinedBottom = isMe ? 'rounded-br-md' : 'rounded-bl-md';
    return cn('rounded-2xl', !first && joinedTop, !last && joinedBottom);
}
