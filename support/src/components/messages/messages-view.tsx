'use client';

import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ClipboardEvent,
    type DragEvent,
    type FormEvent,
    type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
    AlertCircle,
    Bot,
    Check,
    CheckCheck,
    ChevronDown,
    Clock3,
    FileText,
    Loader2,
    Mic,
    MessageCircle,
    Info,
    Lock,
    Phone,
    PhoneIncoming,
    PhoneMissed,
    PhoneOutgoing,
    Play,
    Search,
    Send,
    Smile,
    Trash2,
    Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmojiPicker, EmojiPickerContent, EmojiPickerFooter, EmojiPickerSearch } from '@/components/ui/emoji-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCall } from '@/components/messages/call-provider';
import {
    AttachMenu,
    AttachmentTray,
    releasePending,
    toPending,
    type PendingAttachment,
} from '@/components/messages/composer-attachments';
import { LiveWaveform, VoicePlayer, useVoiceRecorder } from '@/components/messages/voice-message';
import { CustomerAvatar } from '@/components/messages/customer-avatar';
import { ConversationInfoPanel } from '@/components/messages/conversation-info-panel';
import { MediaLightbox } from '@/components/messages/media-lightbox';
import { DeleteMessageDialog, EditMessageDialog, MessageMenu } from '@/components/messages/message-actions';
import { useSupportAgent } from '@/hooks/use-support-agent';
import { toast } from 'sonner';
import type { AppDispatch } from '@/store';
import {
    isLocalMessageId,
    mediaUrl,
    messageKey,
    useDeleteWhatsAppMessageMutation,
    useEditWhatsAppMessageMutation,
    useGetWhatsAppConversationsQuery,
    useGetWhatsAppMessagesQuery,
    useMarkWhatsAppConversationReadMutation,
    useRetryWhatsAppMessageMutation,
    useSendWhatsAppMediaMutation,
    useSendWhatsAppMessageMutation,
    useSetWhatsAppAiMutation,
    useSetWhatsAppAssignmentMutation,
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

// One bubble in the thread: a single message, or several attachments sent
// together that WhatsApp-style render as one album / one stack of files.
interface ThreadItem {
    kind: 'single' | 'album' | 'files';
    messages: WhatsAppMessage[];
    isFirstInRun: boolean;
    isLastInRun: boolean;
}

// Attachments this close together from the same sender are one "send".
const ALBUM_WINDOW_MS = 2 * 60 * 1000;
const isVisual = (m: WhatsAppMessage) => m.type === 'image' || m.type === 'video';
const groupKind = (m: WhatsAppMessage): ThreadItem['kind'] =>
    isVisual(m) ? 'album' : m.type === 'document' ? 'files' : 'single';

function mergeAttachments(items: ThreadItem[]): ThreadItem[] {
    const out: ThreadItem[] = [];
    for (const item of items) {
        const prev = out[out.length - 1];
        const m = item.messages[0]!;
        const kind = groupKind(m);
        const prevLast = prev?.messages[prev.messages.length - 1];
        const joins =
            prev &&
            prevLast &&
            kind !== 'single' &&
            groupKind(prevLast) === kind &&
            prevLast.sender === m.sender &&
            // Only one caption per album, like WhatsApp; a second caption starts a new bubble.
            !(prev.messages.some((x) => x.body) && m.body) &&
            new Date(m.createdAt).getTime() - new Date(prevLast.createdAt).getTime() < ALBUM_WINDOW_MS;
        if (joins) {
            prev.messages.push(m);
            prev.kind = kind;
            prev.isLastInRun = item.isLastInRun;
        } else {
            out.push({ ...item, messages: [...item.messages] });
        }
    }
    // A "group" of one is just a normal bubble.
    return out.map((i) => (i.messages.length === 1 ? { ...i, kind: 'single' } : i));
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
        const item: ThreadItem = {
            kind: 'single',
            messages: [message],
            isFirstInRun: !prev || !sameRun(prev, message),
            isLastInRun: !next || !sameRun(message, next),
        };
        const day = days[days.length - 1];
        if (day?.label === label) day.items.push(item);
        else days.push({ label, items: [item] });
    });
    return days.map((d) => ({ ...d, items: mergeAttachments(d.items) }));
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

// The attachment part of a bubble; the caption (if any) renders below it as text.
function MessageMedia({ message: m, isMe, onOpen }: { message: WhatsAppMessage; isMe: boolean; onOpen: () => void }) {
    const src = mediaUrl(m);
    switch (m.type) {
        case 'image':
        case 'sticker':
            return (
                <button type="button" onClick={onOpen} className="block cursor-zoom-in" aria-label="Open photo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- streamed from our API, not a static asset */}
                    <img
                        src={src}
                        alt={m.body || (m.type === 'sticker' ? 'Sticker' : 'Photo')}
                        loading="lazy"
                        className={cn('rounded-xl object-cover', m.type === 'sticker' ? 'size-32' : 'max-h-72 min-w-40')}
                    />
                </button>
            );
        case 'video':
            return <video src={src} controls preload="metadata" className="max-h-72 rounded-xl" />;
        case 'audio':
            return <VoicePlayer src={src} isMe={isMe} voice={m.media?.voice} />;
        case 'document':
            return (
                <a
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    download={m.media?.filename}
                    className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5',
                        isMe ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25' : 'bg-background/70 hover:bg-background',
                    )}
                >
                    <FileText className="size-6 shrink-0" />
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{m.media?.filename ?? 'Document'}</span>
                        <span className={cn('block text-[11px]', isMe ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                            {m.media?.mimeType.split('/')[1]?.toUpperCase() ?? 'FILE'} · Open
                        </span>
                    </span>
                </a>
            );
        default:
            return null;
    }
}

// Several photos/videos sent together: a 2-column grid, "+N" on the last tile.
function AlbumGrid({ messages, onOpen }: { messages: WhatsAppMessage[]; onOpen: (index: number) => void }) {
    const shown = messages.slice(0, 4);
    const extra = messages.length - shown.length;
    return (
        <div className="grid w-72 max-w-full grid-cols-2 gap-1">
            {shown.map((m, i) => (
                <button
                    key={messageKey(m)}
                    type="button"
                    data-msg-key={messageKey(m)}
                    onClick={() => onOpen(i)}
                    aria-label={m.type === 'video' ? 'Open video' : 'Open photo'}
                    className={cn(
                        'relative cursor-zoom-in overflow-hidden rounded-lg bg-black/10',
                        shown.length === 3 && i === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square',
                    )}
                >
                    {m.type === 'video' ? (
                        <>
                            <video src={mediaUrl(m)} muted preload="metadata" className="size-full object-cover" />
                            <span className="absolute inset-0 flex items-center justify-center">
                                <span className="flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                                    <Play className="size-4 translate-x-px fill-current" />
                                </span>
                            </span>
                        </>
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- streamed from our API
                        <img src={mediaUrl(m)} alt={m.body || 'Photo'} loading="lazy" className="size-full object-cover" />
                    )}
                    {extra > 0 && i === shown.length - 1 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-semibold text-white">
                            +{extra}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}

// The status a group shows: failed if any failed, else the least-advanced.
const STATUS_ORDER: WhatsAppMessageStatus[] = ['pending', 'sent', 'delivered', 'read'];
function groupStatus(messages: WhatsAppMessage[]): WhatsAppMessageStatus | null {
    if (messages.some((m) => m.status === 'failed')) return 'failed';
    const ranks = messages.map((m) => (m.status ? STATUS_ORDER.indexOf(m.status) : 1));
    return STATUS_ORDER[Math.min(...ranks)] ?? null;
}

// Call logs and call-permission events: a centered system line, not a bubble.
function CallLine({ message: m }: { message: WhatsAppMessage }) {
    const missed = /missed|no answer|declined/i.test(m.body);
    const Icon = missed ? PhoneMissed : m.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing;
    return (
        <div className="my-3 flex justify-center">
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground shadow-sm">
                <Icon className={cn('size-3.5', missed && 'text-destructive')} />
                {m.body}
                <span className="text-[10px]">· {formatTime(m.createdAt)}</span>
            </span>
        </div>
    );
}

// Keyed by conversation, so each thread snapshots the messages it opened with:
// those render instantly, and only messages that arrive afterwards animate in.
function ThreadMessages({
    conversationId,
    messages,
    onRetry,
    onOpenMedia,
}: {
    conversationId: string;
    messages: WhatsAppMessage[];
    onRetry: (m: WhatsAppMessage) => void;
    onOpenMedia: (items: WhatsAppMessage[], index: number) => void;
}) {
    const [openedWith] = useState(() => new Set(messages.map(messageKey)));
    const contentRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);
    const messageCount = useRef(messages.length);
    // Message count at the moment the agent scrolled up to read history; null while at the bottom.
    const [leftBottomAt, setLeftBottomAt] = useState<number | null>(null);
    const thread = useMemo(() => buildThread(messages), [messages]);
    const [editing, setEditing] = useState<WhatsAppMessage | null>(null);
    const [deleting, setDeleting] = useState<WhatsAppMessage | null>(null);
    const [editMessage, { isLoading: saving }] = useEditWhatsAppMessageMutation();
    const [deleteMessage, { isLoading: removing }] = useDeleteWhatsAppMessageMutation();

    const viewport = () => contentRef.current?.closest<HTMLElement>('[data-slot=scroll-area-viewport]') ?? null;

    // Stick-to-bottom: while the agent is at the bottom, any growth of the thread
    // (new bubbles, late web-font / Bangla glyph reflow, a retry label) keeps it
    // pinned there. Scrolling up releases it, so reading history is never yanked.
    useLayoutEffect(() => {
        const v = viewport();
        const content = contentRef.current;
        if (!v || !content) return;
        v.scrollTop = v.scrollHeight;

        const onScroll = () => {
            const atBottom = v.scrollHeight - v.scrollTop - v.clientHeight < 80;
            stickToBottom.current = atBottom;
            setLeftBottomAt((prev) => (atBottom ? null : (prev ?? messageCount.current)));
        };
        const resize = new ResizeObserver(() => {
            if (stickToBottom.current) v.scrollTop = v.scrollHeight;
        });
        v.addEventListener('scroll', onScroll, { passive: true });
        resize.observe(content);
        return () => {
            v.removeEventListener('scroll', onScroll);
            resize.disconnect();
        };
    }, []);

    // Sending a message always brings the agent down to it, even from history.
    // Layout effect so the flag is set before the ResizeObserver sees the new bubble.
    const last = messages[messages.length - 1];
    useLayoutEffect(() => {
        messageCount.current = messages.length;
        if (last && isLocalMessageId(last.id)) stickToBottom.current = true;
    }, [messages.length, last]);

    const unseen = leftBottomAt === null ? 0 : messages.length - leftBottomAt;

    return (
        <div ref={contentRef}>
            {thread.map((day) => (
                <div key={day.label}>
                    <div className="sticky top-0 z-10 flex items-center justify-center py-2">
                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                            {day.label}
                        </span>
                    </div>
                    {day.items.map(({ kind, messages: group, isFirstInRun, isLastInRun }) => {
                        const m = group[0]!;
                        const last = group[group.length - 1]!;
                        const isMe = m.direction === 'outbound';
                        const status = groupStatus(group);
                        const failed = group.filter((x) => x.status === 'failed');
                        const key = messageKey(m);
                        if (m.type === 'call') return <CallLine key={key} message={m} />;
                        const hasMedia = !!m.media;
                        const caption = group.map((x) => x.body).filter(Boolean).join('\n');
                        return (
                            <motion.div
                                key={key}
                                data-msg-key={kind === 'single' ? key : undefined}
                                initial={openedWith.has(key) ? false : { opacity: 0, y: 14, scale: 0.94 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={bubbleSpring}
                                style={{ transformOrigin: isMe ? 'bottom right' : 'bottom left' }}
                                className={cn(
                                    'flex flex-col rounded-2xl',
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
                                        'group/bubble relative max-w-[70%] text-sm leading-relaxed break-words shadow-sm transition-opacity',
                                        hasMedia ? 'p-1' : 'px-3 py-1.5',
                                        bubbleCorners(isMe, isFirstInRun, isLastInRun),
                                        isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                                        status === 'pending' && 'opacity-80',
                                    )}
                                >
                                    {kind === 'single' && (
                                        <MessageMenu
                                            message={m}
                                            onBubble={isMe}
                                            onEdit={() => setEditing(m)}
                                            onDelete={() => setDeleting(m)}
                                        />
                                    )}
                                    {m.deleted ? (
                                        <span className="italic opacity-70">🚫 This message was deleted</span>
                                    ) : kind === 'album' ? (
                                        <AlbumGrid messages={group} onOpen={(i) => onOpenMedia(group, i)} />
                                    ) : kind === 'files' ? (
                                        <div className="flex w-72 max-w-full flex-col gap-1">
                                            {group.map((x) => (
                                                <div key={messageKey(x)} data-msg-key={messageKey(x)} className="rounded-xl">
                                                    <MessageMedia message={x} isMe={isMe} onOpen={() => {}} />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        hasMedia && (
                                            <MessageMedia message={m} isMe={isMe} onOpen={() => onOpenMedia([m], 0)} />
                                        )
                                    )}
                                    {!m.deleted && caption && (
                                        <span className={cn('whitespace-pre-wrap', hasMedia && 'block px-2 pt-1')}>{caption}</span>
                                    )}
                                    {/* WhatsApp-style meta: floats into the last line when it fits. */}
                                    <span
                                        className={cn(
                                            'float-right ml-2 mt-1.5 flex items-center gap-1 text-[10px] leading-none',
                                            hasMedia && 'mr-1.5 mb-1',
                                            isMe ? 'text-primary-foreground/70' : 'text-muted-foreground',
                                        )}
                                        title={failed.length ? (failed[0]!.error ?? 'Not delivered') : undefined}
                                    >
                                        {group.length > 1 && <span>{group.length} files ·</span>}
                                        {m.fromApp && <span>via app ·</span>}
                                        {m.edited && !m.deleted && <span>Edited ·</span>}
                                        {formatTime(last.createdAt)}
                                        {isMe && <MessageTicks status={status} onBubble />}
                                    </span>
                                </div>
                                <AnimatePresence initial={false}>
                                    {failed.length > 0 && (
                                        <motion.button
                                            type="button"
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            onClick={() => failed.forEach(onRetry)}
                                            className="mt-1 px-1 text-[11px] text-destructive hover:underline"
                                            title={failed[0]!.error ?? undefined}
                                        >
                                            {failed.length > 1 ? `${failed.length} not delivered` : 'Not delivered'} · Retry
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            ))}
            <EditMessageDialog
                message={editing}
                saving={saving}
                onClose={() => setEditing(null)}
                onSave={(text) =>
                    editMessage({ conversationId, messageId: editing!.id, text })
                        .unwrap()
                        .then(() => setEditing(null))
                        .catch((e) => toast.error('Could not edit message', { description: e?.data?.message }))
                }
            />
            <DeleteMessageDialog
                message={deleting}
                busy={removing}
                onClose={() => setDeleting(null)}
                onDelete={(scope) =>
                    deleteMessage({ conversationId, messageId: deleting!.id, scope })
                        .unwrap()
                        .then(() => setDeleting(null))
                        .catch((e) => toast.error('Could not delete message', { description: e?.data?.message }))
                }
            />
            {/* Zero-height sticky rail: the button floats over the viewport's bottom
                edge while the agent is reading history, without adding scroll height. */}
            <div className="pointer-events-none sticky bottom-3 z-20 h-0">
                <AnimatePresence>
                    {leftBottomAt !== null && (
                        <motion.button
                            type="button"
                            aria-label="Jump to latest message"
                            initial={{ opacity: 0, scale: 0.6, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.6, y: 8 }}
                            transition={bubbleSpring}
                            onClick={() => {
                                const v = viewport();
                                stickToBottom.current = true;
                                v?.scrollTo({ top: v.scrollHeight, behavior: 'smooth' });
                            }}
                            className="pointer-events-auto absolute right-0 bottom-0 flex size-10 items-center justify-center rounded-full border bg-popover text-foreground shadow-lg hover:bg-muted"
                        >
                            <ChevronDown className="size-5" />
                            {unseen > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-medium text-white tabular-nums">
                                    {unseen > 99 ? '99+' : unseen}
                                </span>
                            )}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// WhatsApp's cap for video/audio (and our server's upload limit).
const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;

const FILTERS = ['all', 'unread', 'mine', 'unassigned'] as const;
type Filter = (typeof FILTERS)[number];

export function MessagesView({ conversationId }: { conversationId?: string }) {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [draft, setDraft] = useState('');
    const [emojiOpen, setEmojiOpen] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [pending, setPending] = useState<PendingAttachment[]>([]);
    const [dragging, setDragging] = useState(false);
    const recorder = useVoiceRecorder();
    const { call, startCall } = useCall();
    const agent = useSupportAgent();
    const [infoOpen, setInfoOpen] = useState(false);
    const [lightbox, setLightbox] = useState<{ items: WhatsAppMessage[]; index: number; key: number } | null>(null);

    const selectedId = conversationId ?? null;

    const { data: conversations = [], isLoading: conversationsLoading } = useGetWhatsAppConversationsQuery(
        undefined,
        { pollingInterval: 30_000 },
    );
    const { data: messages = [], isLoading: messagesLoading } = useGetWhatsAppMessagesQuery(selectedId!, {
        skip: !selectedId,
    });
    const [sendMessage] = useSendWhatsAppMessageMutation();
    const [sendMedia] = useSendWhatsAppMediaMutation();
    const [retryMessage] = useRetryWhatsAppMessageMutation();
    const [setAi] = useSetWhatsAppAiMutation();
    const [markRead] = useMarkWhatsAppConversationReadMutation();
    const [setAssignment, { isLoading: assigning }] = useSetWhatsAppAssignmentMutation();

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return conversations.filter((c) => {
            const matchesQuery =
                !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.lastMessage.toLowerCase().includes(q);
            const matchesFilter =
                filter === 'all' ||
                (filter === 'unread' && c.unreadCount > 0) ||
                (filter === 'mine' && c.assignedTo?.id === agent.id) ||
                (filter === 'unassigned' && !c.assignedTo);
            return matchesQuery && matchesFilter;
        });
    }, [conversations, search, filter, agent.id]);

    const selected = conversations.find((c) => c.id === selectedId) ?? null;

    // Read = the agent is looking at it: on open, when new messages land while
    // it's on screen, and when they come back to the tab.
    const unread = selected?.unreadCount ?? 0;
    useEffect(() => {
        if (!selectedId) return;
        const readIfVisible = () => {
            if (document.visibilityState === 'visible') markRead(selectedId);
        };
        readIfVisible();
        document.addEventListener('visibilitychange', readIfVisible);
        return () => document.removeEventListener('visibilitychange', readIfVisible);
    }, [selectedId, markRead]);
    useEffect(() => {
        if (selectedId && unread > 0 && document.visibilityState === 'visible') markRead(selectedId);
    }, [selectedId, unread, markRead]);

    // Assignment: someone else owns this chat → my composer is locked.
    const assignee = selected?.assignedTo ?? null;
    const lockedByOther = !!assignee && assignee.id !== agent.id;

    const handleAssignment = (action: 'claim' | 'release') => {
        if (!selected) return;
        setAssignment({ conversationId: selected.id, action })
            .unwrap()
            .then(() =>
                toast.success(action === 'claim' ? (lockedByOther ? 'You took over this chat' : 'Chat assigned to you') : 'Chat released', {
                    description: action === 'release' ? 'Any teammate can pick it up now.' : undefined,
                }),
            )
            .catch((err: { data?: { message?: string } }) => toast.error('Couldn’t update assignment', { description: err.data?.message }));
    };

    // Shared-files panel → scroll the thread to that message and flash it.
    const jumpTo = (key: string) => {
        const el = document.querySelector<HTMLElement>(`[data-msg-key="${CSS.escape(key)}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.animate(
            [
                { boxShadow: '0 0 0 0 transparent' },
                { boxShadow: '0 0 0 4px color-mix(in oklab, var(--primary) 45%, transparent)' },
                { boxShadow: '0 0 0 0 transparent' },
            ],
            { duration: 1400, delay: 350, easing: 'ease-in-out' },
        );
    };

    const send = (text: string) => {
        if (!selectedId) return;
        void sendMessage({ conversationId: selectedId, text, localId: `local-${crypto.randomUUID()}` });
    };

    const sendFile = (file: Blob, filename: string, options: { caption?: string; voice?: boolean } = {}) => {
        if (!selectedId) return;
        void sendMedia({ conversationId: selectedId, file, filename, ...options, localId: `local-${crypto.randomUUID()}` });
    };

    const addAttachments = (files: File[]) => {
        const tooBig = files.filter((f) => f.size > MAX_UPLOAD_BYTES);
        if (tooBig.length) {
            toast.error('File too large', { description: `${tooBig.map((f) => f.name).join(', ')} — WhatsApp allows up to 16 MB.` });
        }
        const ok = files.filter((f) => f.size <= MAX_UPLOAD_BYTES);
        if (ok.length) setPending((prev) => [...prev, ...toPending(ok)]);
        inputRef.current?.focus();
    };

    const removeAttachment = (id: string) =>
        setPending((prev) => {
            releasePending(prev.filter((p) => p.id === id));
            return prev.filter((p) => p.id !== id);
        });

    // Switching chats drops unsent attachments (and their preview URLs).
    useEffect(
        () => () =>
            setPending((prev) => {
                releasePending(prev);
                return [];
            }),
        [selectedId],
    );

    // Ctrl+V a copied image/file → it lands in the tray, like WhatsApp Web.
    const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const files = Array.from(e.clipboardData.files);
        if (!files.length) return;
        e.preventDefault();
        addAttachments(files);
    };

    const insertEmoji = (emoji: string) => {
        const input = inputRef.current;
        const start = input?.selectionStart ?? draft.length;
        const end = input?.selectionEnd ?? draft.length;
        setDraft(draft.slice(0, start) + emoji + draft.slice(end));
        requestAnimationFrame(() => {
            input?.focus();
            input?.setSelectionRange(start + emoji.length, start + emoji.length);
        });
    };

    const handleSend = async (e?: FormEvent) => {
        e?.preventDefault();
        if (recorder.recording) {
            const blob = await recorder.stop();
            if (blob && blob.size > 0) sendFile(blob, 'voice-message', { voice: true });
            return;
        }
        const text = draft.trim();
        if (pending.length) {
            // Typed text rides along as the first file's caption.
            pending.forEach((p, i) => sendFile(p.file, p.file.name, { caption: i === 0 ? text || undefined : undefined }));
            releasePending(pending);
            setPending([]);
            setDraft('');
            inputRef.current?.focus();
            return;
        }
        if (!text) {
            // Empty composer: the button is the mic.
            recorder.start().catch(() =>
                toast.error('Microphone blocked', { description: 'Allow microphone access for this site to record voice messages.' }),
            );
            return;
        }
        setDraft('');
        send(text);
        inputRef.current?.focus();
    };

    // WhatsApp Web behaviour: Enter sends, Shift+Enter adds a line. Skipped
    // while an IME is composing (e.g. Bangla keyboards) so Enter picks a word.
    const handleComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (draft.trim() || pending.length) void handleSend();
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
            if (message.media && message.localUrl) {
                // Re-read the file from its blob URL — the original File is long gone.
                const { localUrl, media, body } = message;
                void fetch(localUrl)
                    .then((r) => r.blob())
                    .then((blob) => sendFile(blob, media.filename ?? 'file', { caption: body || undefined, voice: media.voice }));
            } else {
                send(message.body);
            }
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
                                        <CustomerAvatar name={c.name} seed={c.phone} className="size-11 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="flex min-w-0 items-center gap-1.5">
                                                    <span className="text-sm font-medium truncate">{c.name}</span>
                                                    {c.assignedTo && (
                                                        <span
                                                            title={`Assigned to ${c.assignedTo.name}`}
                                                            className={cn(
                                                                'shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium',
                                                                c.assignedTo.id === agent.id
                                                                    ? 'bg-primary/15 text-primary'
                                                                    : 'bg-muted text-muted-foreground',
                                                            )}
                                                        >
                                                            {c.assignedTo.id === agent.id ? 'You' : c.assignedTo.name.split(' ')[0]}
                                                        </span>
                                                    )}
                                                </span>
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
                <div
                    className="relative flex-1 flex flex-col min-w-0"
                    onDragOver={(e: DragEvent) => {
                        if (!selected || !e.dataTransfer.types.includes('Files')) return;
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={(e: DragEvent) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
                    }}
                    onDrop={(e: DragEvent) => {
                        if (!selected) return;
                        e.preventDefault();
                        setDragging(false);
                        addAttachments(Array.from(e.dataTransfer.files));
                    }}
                >
                    <AnimatePresence>
                        {dragging && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-background/85 backdrop-blur-sm"
                            >
                                <Upload className="size-8 text-primary" />
                                <p className="text-sm font-medium">Drop to attach</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                                    <button
                                        type="button"
                                        onClick={() => setInfoOpen(true)}
                                        className="flex min-w-0 items-center gap-3 rounded-lg text-left"
                                        aria-label="Open contact info"
                                    >
                                        <CustomerAvatar name={selected.name} seed={selected.phone} className="size-9 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{selected.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {assignee
                                                    ? assignee.id === agent.id
                                                        ? 'Assigned to you'
                                                        : `${assignee.name} is handling this chat`
                                                    : selected.aiEnabled
                                                      ? 'AI replying · unassigned'
                                                      : 'Unassigned'}
                                            </p>
                                        </div>
                                    </button>
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
                                            disabled={lockedByOther && !agent.canManage}
                                            onCheckedChange={(aiEnabled) =>
                                                setAi({ conversationId: selected.id, aiEnabled })
                                                    .unwrap()
                                                    .catch((err: { data?: { message?: string } }) =>
                                                        toast.error('Couldn’t change AI auto-reply', { description: err.data?.message }),
                                                    )
                                            }
                                        />
                                    </label>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-8"
                                        aria-label="WhatsApp voice call"
                                        title="WhatsApp voice call"
                                        disabled={!!call || (lockedByOther && !agent.canManage)}
                                        onClick={() => startCall({ id: selected.id, name: selected.name })}
                                    >
                                        <Phone className="size-4" />
                                    </Button>
                                    {assignee?.id === agent.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs text-muted-foreground"
                                            disabled={assigning}
                                            onClick={() => handleAssignment('release')}
                                            title="Let a teammate pick this chat up"
                                        >
                                            Release
                                        </Button>
                                    )}
                                    <Button
                                        variant={infoOpen ? 'secondary' : 'ghost'}
                                        size="icon"
                                        className="size-8"
                                        aria-label="Contact info"
                                        aria-pressed={infoOpen}
                                        title="Contact info"
                                        onClick={() => setInfoOpen((o) => !o)}
                                    >
                                        <Info className="size-4" />
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
                                        <ThreadMessages
                                            key={selected.id}
                                            conversationId={selected.id}
                                            messages={messages}
                                            onRetry={handleRetry}
                                            onOpenMedia={(items, index) => setLightbox({ items, index, key: Date.now() })}
                                        />
                                    )}
                                </div>
                            </ScrollArea>

                            <Separator />
                            {lockedByOther ? (
                                // One agent per chat: everyone else sees who has it instead of a composer.
                                <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                                    <div className="flex min-w-0 items-center gap-2.5 text-sm">
                                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                            <Lock className="size-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium">{assignee?.name} is handling this chat</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {agent.canManage
                                                    ? 'Take it over to reply — they’ll see it move to you.'
                                                    : 'Only they can reply. Ask them or a manager to hand it over.'}
                                            </span>
                                        </span>
                                    </div>
                                    {agent.canManage && (
                                        <Button size="sm" variant="outline" disabled={assigning} onClick={() => handleAssignment('claim')}>
                                            Take over
                                        </Button>
                                    )}
                                </div>
                            ) : (
                            <>
                            <AttachmentTray items={pending} onRemove={removeAttachment} />
                            <form onSubmit={handleSend} className="flex items-end gap-2 px-3 py-3 shrink-0">
                                {recorder.recording ? (
                                    <>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-10 shrink-0 text-destructive"
                                            aria-label="Discard recording"
                                            onClick={recorder.cancel}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                        <div
                                            className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full border bg-muted/40 px-4 text-sm"
                                            aria-label="Recording voice message"
                                        >
                                            <motion.span
                                                className="size-2.5 shrink-0 rounded-full bg-destructive"
                                                animate={{ opacity: [1, 0.3, 1] }}
                                                transition={{ duration: 1.2, repeat: Infinity }}
                                            />
                                            <span className="shrink-0 tabular-nums">{recorder.elapsed}</span>
                                            <LiveWaveform levels={recorder.levels} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <AttachMenu onPick={addAttachments} />
                                        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                                            <PopoverTrigger asChild>
                                                <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Emoji">
                                                    <Smile className="size-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent side="top" align="start" className="w-fit p-0">
                                                <EmojiPicker className="h-[342px]" onEmojiSelect={({ emoji }) => insertEmoji(emoji)}>
                                                    <EmojiPickerSearch />
                                                    <EmojiPickerContent />
                                                    <EmojiPickerFooter />
                                                </EmojiPicker>
                                            </PopoverContent>
                                        </Popover>
                                        {/* Grows with the text up to ~6 lines, then scrolls — like WhatsApp. */}
                                        <Textarea
                                            ref={inputRef}
                                            rows={1}
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            onKeyDown={handleComposerKeyDown}
                                            onPaste={handlePaste}
                                            placeholder={pending.length ? 'Add a caption' : 'Type a message'}
                                            className="min-h-10 max-h-36 overflow-y-auto py-2.5 leading-5"
                                            autoFocus
                                        />
                                    </>
                                )}
                                <Button
                                    type="submit"
                                    size="icon"
                                    className="size-10 shrink-0 rounded-full"
                                    aria-label={recorder.recording || draft.trim() || pending.length ? 'Send' : 'Record voice message'}
                                >
                                    <AnimatePresence mode="popLayout" initial={false}>
                                        <motion.span
                                            key={recorder.recording || draft.trim() || pending.length ? 'send' : 'mic'}
                                            initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
                                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                            exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
                                            transition={{ duration: 0.15 }}
                                            className="inline-flex"
                                        >
                                            {recorder.recording || draft.trim() || pending.length ? <Send className="size-4" /> : <Mic className="size-4" />}
                                        </motion.span>
                                    </AnimatePresence>
                                </Button>
                            </form>
                            </>
                            )}
                        </>
                    )}
                </div>

                <AnimatePresence initial={false}>
                    {infoOpen && selected && (
                        <ConversationInfoPanel
                            key={selected.id}
                            conversation={selected}
                            messages={messages}
                            onJump={jumpTo}
                            onClose={() => setInfoOpen(false)}
                        />
                    )}
                </AnimatePresence>
            </div>

            {lightbox && (
                <MediaLightbox key={lightbox.key} items={lightbox.items} index={lightbox.index} onClose={() => setLightbox(null)} />
            )}
        </MotionConfig>
    );
}
