'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
    AlertCircle,
    Bot,
    Check,
    CheckCheck,
    Clock3,
    Loader2,
    Mic,
    MessageCircle,
    MoreVertical,
    Paperclip,
    Phone,
    Search,
    Send,
    Smile,
    Video,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { AppDispatch } from '@/store';
import {
    isLocalMessageId,
    messageKey,
    useGetWhatsAppConversationsQuery,
    useGetWhatsAppMessagesQuery,
    useMarkWhatsAppConversationReadMutation,
    useRetryWhatsAppMessageMutation,
    useSendWhatsAppMessageMutation,
    useSetWhatsAppAiMutation,
    whatsappApi,
    type WhatsAppMessage,
    type WhatsAppMessageStatus,
} from '@/store/api/whatsappApi';

// Messages from the same sender closer together than this stack as one group.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

// A quick, slightly springy "pop" from the sender's side — iMessage-like.
const bubbleSpring = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } as const;

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatListTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return formatTime(iso);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function dateLabel(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

interface ThreadItem {
    message: WhatsAppMessage;
    isFirstInRun: boolean;
    isLastInRun: boolean;
}

// Date dividers, and within each day the "runs" of back-to-back messages from
// the same sender — the WhatsApp/iMessage grouping that joins bubble corners.
function buildThread(messages: WhatsAppMessage[]) {
    const days: { label: string; items: ThreadItem[] }[] = [];
    const sameRun = (a: WhatsAppMessage, b: WhatsAppMessage) =>
        a.sender === b.sender &&
        dateLabel(a.createdAt) === dateLabel(b.createdAt) &&
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() < GROUP_WINDOW_MS;

    messages.forEach((message, i) => {
        const label = dateLabel(message.createdAt);
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const item = {
            message,
            isFirstInRun: !prev || !sameRun(prev, message),
            isLastInRun: !next || !sameRun(message, next),
        };
        const day = days[days.length - 1];
        if (day?.label === label) day.items.push(item);
        else days.push({ label, items: [item] });
    });
    return days;
}

// Only the sender-side corners that touch another bubble in the same run get
// squared off, so a stack reads as one block and a lone bubble stays round.
function bubbleCorners(isMe: boolean, first: boolean, last: boolean): string {
    const joinedTop = isMe ? 'rounded-tr-md' : 'rounded-tl-md';
    const joinedBottom = isMe ? 'rounded-br-md' : 'rounded-bl-md';
    return cn('rounded-2xl', !first && joinedTop, !last && joinedBottom);
}

function TickIcon({ status, onBubble }: { status: WhatsAppMessageStatus | null; onBubble: boolean }) {
    const muted = onBubble ? 'text-primary-foreground/70' : 'text-muted-foreground';
    switch (status) {
        case 'pending':
            return <Clock3 aria-label="Sending" className={cn('size-3.5', muted)} />;
        case 'delivered':
            return <CheckCheck aria-label="Delivered" className={cn('size-3.5', muted)} />;
        case 'read':
            return <CheckCheck aria-label="Read" className="size-3.5 text-sky-400" />;
        case 'failed':
            return <AlertCircle aria-label="Not delivered" className="size-3.5 text-red-400" />;
        default:
            return <Check aria-label="Sent" className={cn('size-3.5', muted)} />;
    }
}

// WhatsApp convention: clock = queued, ✓ = sent, ✓✓ = delivered, blue ✓✓ = read.
// Each change swaps in with a small pop so progress is noticeable, not jumpy.
function MessageTicks({ status, onBubble }: { status: WhatsAppMessageStatus | null; onBubble: boolean }) {
    return (
        <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
                key={status ?? 'sent'}
                className="inline-flex shrink-0"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.18 }}
            >
                <TickIcon status={status} onBubble={onBubble} />
            </motion.span>
        </AnimatePresence>
    );
}

// Keyed by conversation, so each thread snapshots the messages it opened with:
// those render instantly, and only messages that arrive afterwards animate in.
function ThreadMessages({ messages, onRetry }: { messages: WhatsAppMessage[]; onRetry: (m: WhatsAppMessage) => void }) {
    const [openedWith] = useState(() => new Set(messages.map(messageKey)));
    const bottomRef = useRef<HTMLDivElement>(null);
    const hasScrolled = useRef(false);
    const thread = useMemo(() => buildThread(messages), [messages]);

    // Jump to the newest message when the thread opens; glide when one arrives.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: 'end', behavior: hasScrolled.current ? 'smooth' : 'auto' });
        hasScrolled.current = true;
    }, [messages.length]);

    return (
        <>
            {thread.map((day) => (
                <div key={day.label}>
                    <div className="sticky top-0 z-10 flex items-center justify-center py-2">
                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                            {day.label}
                        </span>
                    </div>
                    {day.items.map(({ message: m, isFirstInRun, isLastInRun }) => {
                        const isMe = m.direction === 'outbound';
                        const failed = m.status === 'failed';
                        const key = messageKey(m);
                        return (
                            <motion.div
                                key={key}
                                initial={openedWith.has(key) ? false : { opacity: 0, y: 14, scale: 0.94 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={bubbleSpring}
                                style={{ transformOrigin: isMe ? 'bottom right' : 'bottom left' }}
                                className={cn(
                                    'flex flex-col',
                                    isMe ? 'items-end' : 'items-start',
                                    isFirstInRun ? 'mt-3' : 'mt-0.5',
                                )}
                            >
                                {isFirstInRun && m.sender === 'ai' && (
                                    <span className="mb-1 flex items-center gap-1 px-1 text-[10px] font-medium text-muted-foreground">
                                        <Bot className="size-3" /> AI assistant
                                    </span>
                                )}
                                <div
                                    className={cn(
                                        'max-w-[70%] px-3 py-1.5 text-sm leading-relaxed break-words shadow-sm transition-opacity',
                                        bubbleCorners(isMe, isFirstInRun, isLastInRun),
                                        isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                                        m.status === 'pending' && 'opacity-80',
                                    )}
                                >
                                    <span className="whitespace-pre-wrap">{m.body}</span>
                                    {/* WhatsApp-style meta: floats into the last line when it fits. */}
                                    <span
                                        className={cn(
                                            'float-right ml-2 mt-1.5 flex items-center gap-1 text-[10px] leading-none',
                                            isMe ? 'text-primary-foreground/70' : 'text-muted-foreground',
                                        )}
                                        title={failed ? (m.error ?? 'Not delivered') : undefined}
                                    >
                                        {formatTime(m.createdAt)}
                                        {isMe && <MessageTicks status={m.status} onBubble />}
                                    </span>
                                </div>
                                <AnimatePresence initial={false}>
                                    {failed && (
                                        <motion.button
                                            type="button"
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            onClick={() => onRetry(m)}
                                            className="mt-1 px-1 text-[11px] text-destructive hover:underline"
                                            title={m.error ?? undefined}
                                        >
                                            Not delivered · Retry
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            ))}
            <div ref={bottomRef} />
        </>
    );
}

const FILTERS = ['all', 'unread', 'favorites', 'groups'] as const;
type Filter = (typeof FILTERS)[number];

export function MessagesView({ conversationId }: { conversationId?: string }) {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const selectedId = conversationId ?? null;

    const { data: conversations = [], isLoading: conversationsLoading } = useGetWhatsAppConversationsQuery(
        undefined,
        { pollingInterval: 30_000 },
    );
    const { data: messages = [], isLoading: messagesLoading } = useGetWhatsAppMessagesQuery(selectedId!, {
        skip: !selectedId,
    });
    const [sendMessage] = useSendWhatsAppMessageMutation();
    const [retryMessage] = useRetryWhatsAppMessageMutation();
    const [setAi] = useSetWhatsAppAiMutation();
    const [markRead] = useMarkWhatsAppConversationReadMutation();

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return conversations.filter((c) => {
            const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q);
            const matchesFilter = filter !== 'unread' || c.unreadCount > 0;
            return matchesQuery && matchesFilter;
        });
    }, [conversations, search, filter]);

    const selected = conversations.find((c) => c.id === selectedId) ?? null;

    // Clear the unread badge the moment an agent opens the thread.
    useEffect(() => {
        if (selectedId) markRead(selectedId);
    }, [selectedId, markRead]);

    const send = (text: string) => {
        if (!selectedId) return;
        void sendMessage({ conversationId: selectedId, text, localId: `local-${crypto.randomUUID()}` });
    };

    const handleSend = (e?: FormEvent) => {
        e?.preventDefault();
        const text = draft.trim();
        if (!text) return;
        setDraft('');
        send(text);
        inputRef.current?.focus();
    };

    // WhatsApp Web behaviour: Enter sends, Shift+Enter adds a line. Skipped
    // while an IME is composing (e.g. Bangla keyboards) so Enter picks a word.
    const handleComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleRetry = (message: WhatsAppMessage) => {
        if (!selectedId) return;
        if (isLocalMessageId(message.id)) {
            // The server never got this one — drop the dead bubble and send it fresh.
            dispatch(
                whatsappApi.util.updateQueryData('getWhatsAppMessages', selectedId, (draftThread) =>
                    draftThread.filter((m) => m.id !== message.id),
                ),
            );
            send(message.body);
        } else {
            void retryMessage({ conversationId: selectedId, messageId: message.id });
        }
    };

    return (
        // Pinned to the viewport (minus the layout's p-2), so the thread and the
        // chat list scroll inside their own panels instead of growing the page.
        <MotionConfig reducedMotion="user">
            <div className="flex h-[calc(100svh-1rem)] overflow-hidden rounded-2xl border bg-sidebar">
                {/* ── Conversation list ─────────────────────────────────────────── */}
                <aside className="w-[320px] shrink-0 flex flex-col border-r overflow-hidden">
                    <div className="px-4 pt-4 pb-3 space-y-3">
                        <h1 className="text-lg font-semibold">Messages</h1>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search or start a new chat"
                                className="pl-9 h-9"
                            />
                        </div>
                        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                            <TabsList className="w-full">
                                {FILTERS.map((f) => (
                                    <TabsTrigger key={f} value={f} className="capitalize">
                                        {f}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    <ScrollArea className="flex-1 min-h-0">
                        <div className="px-2 pb-2">
                            {conversationsLoading ? (
                                <div className="space-y-2 px-1">
                                    {[...Array(4)].map((_, i) => (
                                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">No conversations found.</p>
                            ) : (
                                filtered.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => router.push(`/messages/${c.id}`)}
                                        className={cn(
                                            'w-full flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-sidebar-accent',
                                            selectedId === c.id && 'bg-sidebar-accent',
                                        )}
                                    >
                                        <Avatar className="size-11 shrink-0">
                                            <AvatarFallback>{c.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium truncate">{c.name}</span>
                                                <span
                                                    className={cn(
                                                        'text-[11px] shrink-0',
                                                        c.unreadCount > 0 ? 'text-destructive font-medium' : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {formatListTime(c.lastMessageAt)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 mt-0.5">
                                                <span className="flex items-center gap-1 min-w-0 text-xs text-muted-foreground">
                                                    {c.lastMessageDirection === 'outbound' && (
                                                        <MessageTicks status={c.lastMessageStatus} onBubble={false} />
                                                    )}
                                                    <span className={cn('truncate', c.unreadCount > 0 && 'font-medium text-foreground')}>
                                                        {c.lastMessage}
                                                    </span>
                                                </span>
                                                <AnimatePresence initial={false}>
                                                    {c.unreadCount > 0 && (
                                                        <motion.span
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            exit={{ scale: 0 }}
                                                            transition={bubbleSpring}
                                                            className="shrink-0"
                                                        >
                                                            <Badge className="h-5 min-w-5 justify-center px-1.5 bg-destructive text-white tabular-nums">
                                                                {c.unreadCount > 99 ? '99+' : c.unreadCount}
                                                            </Badge>
                                                        </motion.span>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </aside>

                {/* ── Thread ─────────────────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                            <div className="size-14 rounded-full bg-muted flex items-center justify-center">
                                <MessageCircle className="size-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-foreground">Select a conversation</p>
                            <p className="text-xs text-muted-foreground">Pick a chat from the left to view messages.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-3 px-4 h-16 shrink-0 border-b bg-sidebar">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="size-9 shrink-0">
                                        <AvatarFallback>{selected.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">{selected.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {selected.aiEnabled ? 'AI replying' : 'You’re handling this chat'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <label
                                        className="mr-2 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs"
                                        title={
                                            selected.aiEnabled
                                                ? 'AI answers new messages automatically. Replying yourself turns it off.'
                                                : 'AI is off — you are handling this chat. Turn on to let AI reply again.'
                                        }
                                    >
                                        <Bot className={cn('size-3.5', selected.aiEnabled ? 'text-primary' : 'text-muted-foreground')} />
                                        AI auto-reply
                                        <Switch
                                            size="sm"
                                            checked={selected.aiEnabled}
                                            onCheckedChange={(aiEnabled) => setAi({ conversationId: selected.id, aiEnabled })}
                                        />
                                    </label>
                                    <Button variant="ghost" size="icon" className="size-8">
                                        <Phone className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-8">
                                        <Video className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="size-8">
                                        <MoreVertical className="size-4" />
                                    </Button>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 min-h-0">
                                <div className="px-4 py-4">
                                    {messagesLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <ThreadMessages key={selected.id} messages={messages} onRetry={handleRetry} />
                                    )}
                                </div>
                            </ScrollArea>

                            <Separator />
                            <form onSubmit={handleSend} className="flex items-end gap-2 px-3 py-3 shrink-0">
                                <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0">
                                    <Paperclip className="size-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0">
                                    <Smile className="size-4" />
                                </Button>
                                {/* Grows with the text up to ~6 lines, then scrolls — like WhatsApp. */}
                                <Textarea
                                    ref={inputRef}
                                    rows={1}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={handleComposerKeyDown}
                                    placeholder="Type a message"
                                    className="min-h-10 max-h-36 overflow-y-auto py-2.5 leading-5"
                                    autoFocus
                                />
                                <Button type="submit" size="icon" className="size-10 shrink-0 rounded-full" aria-label="Send">
                                    <AnimatePresence mode="popLayout" initial={false}>
                                        <motion.span
                                            key={draft.trim() ? 'send' : 'mic'}
                                            initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
                                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                            exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
                                            transition={{ duration: 0.15 }}
                                            className="inline-flex"
                                        >
                                            {draft.trim() ? <Send className="size-4" /> : <Mic className="size-4" />}
                                        </motion.span>
                                    </AnimatePresence>
                                </Button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </MotionConfig>
    );
}
