'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
    useGetWhatsAppConversationsQuery,
    useGetWhatsAppMessagesQuery,
    useMarkWhatsAppConversationReadMutation,
    useSendWhatsAppMessageMutation,
    type WhatsAppMessage,
} from '@/store/api/whatsappApi';

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

// Consecutive messages on the same day share one date divider.
function groupByDate(messages: WhatsAppMessage[]) {
    const groups: { label: string; messages: WhatsAppMessage[] }[] = [];
    for (const message of messages) {
        const label = dateLabel(message.createdAt);
        const lastGroup = groups[groups.length - 1];
        if (lastGroup?.label === label) lastGroup.messages.push(message);
        else groups.push({ label, messages: [message] });
    }
    return groups;
}

const FILTERS = ['all', 'unread', 'favorites', 'groups'] as const;
type Filter = (typeof FILTERS)[number];

export function MessagesView({ conversationId }: { conversationId?: string }) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [draft, setDraft] = useState('');

    const selectedId = conversationId ?? null;

    const { data: conversations = [], isLoading: conversationsLoading } = useGetWhatsAppConversationsQuery(
        undefined,
        { pollingInterval: 30_000 },
    );
    const { data: messages = [], isLoading: messagesLoading } = useGetWhatsAppMessagesQuery(selectedId!, {
        skip: !selectedId,
    });
    const [sendMessage, { isLoading: isSending }] = useSendWhatsAppMessageMutation();
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
    const groupedThread = useMemo(() => groupByDate(messages), [messages]);

    // Clear the unread badge the moment an agent opens the thread.
    useEffect(() => {
        if (selectedId) markRead(selectedId);
    }, [selectedId, markRead]);

    const handleSend = async (e: FormEvent) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || !selectedId) return;
        setDraft('');
        await sendMessage({ conversationId: selectedId, text });
    };

    return (
        <div className="flex h-full overflow-hidden rounded-2xl border bg-sidebar">
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

                <ScrollArea className="flex-1">
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
                                            <span className="text-[11px] text-muted-foreground shrink-0">
                                                {formatListTime(c.lastMessageAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 mt-0.5">
                                            <span className="text-xs text-muted-foreground truncate">{c.lastMessage}</span>
                                            {c.unreadCount > 0 && (
                                                <Badge className="h-5 min-w-5 justify-center px-1.5 shrink-0">
                                                    {c.unreadCount}
                                                </Badge>
                                            )}
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

                        <ScrollArea className="flex-1">
                            <div className="px-4 py-4 space-y-4">
                                {messagesLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    groupedThread.map((group) => (
                                        <div key={group.label} className="space-y-3">
                                            <div className="flex items-center justify-center">
                                                <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                                                    {group.label}
                                                </span>
                                            </div>
                                            {group.messages.map((m) => {
                                                const isMe = m.direction === 'outbound';
                                                return (
                                                    <div key={m.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                                                        <div className="max-w-[70%] space-y-1">
                                                            <div
                                                                className={cn(
                                                                    'px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm',
                                                                    isMe
                                                                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                                                                        : 'bg-muted text-foreground rounded-2xl rounded-bl-md',
                                                                )}
                                                            >
                                                                {m.body}
                                                            </div>
                                                            <p
                                                                className={cn(
                                                                    'text-[10px] text-muted-foreground px-1',
                                                                    isMe ? 'text-right' : 'text-left',
                                                                )}
                                                            >
                                                                {formatTime(m.createdAt)}
                                                                {m.sender === 'ai' && ' · AI'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>

                        <Separator />
                        <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-3 shrink-0">
                            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0">
                                <Paperclip className="size-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0">
                                <Smile className="size-4" />
                            </Button>
                            <Input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Type a message"
                                className="h-10"
                                disabled={isSending}
                            />
                            <Button type="submit" size="icon" className="size-9 shrink-0" disabled={isSending}>
                                {isSending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : draft.trim() ? (
                                    <Send className="size-4" />
                                ) : (
                                    <Mic className="size-4" />
                                )}
                            </Button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
