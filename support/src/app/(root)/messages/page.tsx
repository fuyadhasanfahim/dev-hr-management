'use client';

import { useMemo, useState } from 'react';
import {
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// Placeholder data — swap for real WhatsApp Cloud API conversations/messages
// once the integration lands. Shape mirrors what that wiring will need.
interface Conversation {
    id: string;
    name: string;
    avatarUrl?: string;
    lastMessage: string;
    time: string;
    unread: number;
}

interface ThreadMessage {
    id: string;
    from: 'them' | 'me';
    text: string;
    time: string;
    dateLabel: string;
}

const CONVERSATIONS: Conversation[] = [
    { id: '1', name: 'Salim Bhai', lastMessage: 'Ok, thanks!', time: '4:01 PM', unread: 0 },
    { id: '2', name: 'Client Hunting & Outreach', lastMessage: '~Shafiulla: https://facebook.com…', time: '3:56 PM', unread: 3 },
    { id: '3', name: 'Masum', lastMessage: 'কেমন আছেন?', time: '3:21 PM', unread: 0 },
    { id: '4', name: 'Rafi Ahmed', lastMessage: 'Invoice পাঠিয়ে দিয়েন', time: '3:08 PM', unread: 1 },
    { id: '5', name: 'মানব সেবা কল্যাণ ফাউন্ডেশন', lastMessage: 'জরুরি ৫০ পজেটিভ রক্ত লাগবে', time: '12:15 PM', unread: 0 },
];

const THREAD: ThreadMessage[] = [
    { id: 'm1', from: 'them', text: 'Assalamu alaikum, price ta konfirm koren.', time: '1:20 PM', dateLabel: 'Yesterday' },
    { id: 'm2', from: 'me', text: 'Walaikum salam! Package details পাঠাচ্ছি একটু পর।', time: '1:26 PM', dateLabel: 'Yesterday' },
    { id: 'm3', from: 'them', text: 'Thik ache, wait korchi.', time: '2:41 PM', dateLabel: 'Yesterday' },
    { id: 'm4', from: 'me', text: 'ধন্যবাদ আপনার অপেক্ষার জন্য। এই নিন — ৫,০০০৳ প্যাকেজে সব ফিচার আছে।', time: '4:00 PM', dateLabel: 'Today' },
    { id: 'm5', from: 'them', text: 'Ok, confirm kore dilam.', time: '4:01 PM', dateLabel: 'Today' },
];

const FILTERS = ['all', 'unread', 'favorites', 'groups'] as const;
type Filter = (typeof FILTERS)[number];

export default function MessagesPage() {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return CONVERSATIONS.filter((c) => {
            const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q);
            const matchesFilter = filter !== 'unread' || c.unread > 0;
            return matchesQuery && matchesFilter;
        });
    }, [search, filter]);

    const selected = CONVERSATIONS.find((c) => c.id === selectedId) ?? null;

    // Grouped once up front so consecutive messages on the same day share one divider.
    const groupedThread = useMemo(() => {
        const groups: { dateLabel: string; messages: ThreadMessage[] }[] = [];
        for (const message of THREAD) {
            const lastGroup = groups[groups.length - 1];
            if (lastGroup?.dateLabel === message.dateLabel) {
                lastGroup.messages.push(message);
            } else {
                groups.push({ dateLabel: message.dateLabel, messages: [message] });
            }
        }
        return groups;
    }, []);

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
                        {filtered.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No conversations found.</p>
                        ) : (
                            filtered.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedId(c.id)}
                                    className={cn(
                                        'w-full flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-sidebar-accent',
                                        selectedId === c.id && 'bg-sidebar-accent',
                                    )}
                                >
                                    <Avatar className="size-11 shrink-0">
                                        <AvatarImage src={c.avatarUrl} alt={c.name} />
                                        <AvatarFallback>{c.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium truncate">{c.name}</span>
                                            <span className="text-[11px] text-muted-foreground shrink-0">{c.time}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 mt-0.5">
                                            <span className="text-xs text-muted-foreground truncate">{c.lastMessage}</span>
                                            {c.unread > 0 && (
                                                <Badge className="h-5 min-w-5 justify-center px-1.5 shrink-0">{c.unread}</Badge>
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
                                    <AvatarImage src={selected.avatarUrl} alt={selected.name} />
                                    <AvatarFallback>{selected.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{selected.name}</p>
                                    <p className="text-xs text-muted-foreground">WhatsApp</p>
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
                                {groupedThread.map((group) => (
                                    <div key={group.dateLabel} className="space-y-3">
                                        <div className="flex items-center justify-center">
                                            <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                                                {group.dateLabel}
                                            </span>
                                        </div>
                                        {group.messages.map((m) => (
                                            <div key={m.id} className={cn('flex', m.from === 'me' ? 'justify-end' : 'justify-start')}>
                                                <div className="max-w-[70%] space-y-1">
                                                    <div
                                                        className={cn(
                                                            'px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm',
                                                            m.from === 'me'
                                                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                                                                : 'bg-muted text-foreground rounded-2xl rounded-bl-md',
                                                        )}
                                                    >
                                                        {m.text}
                                                    </div>
                                                    <p
                                                        className={cn(
                                                            'text-[10px] text-muted-foreground px-1',
                                                            m.from === 'me' ? 'text-right' : 'text-left',
                                                        )}
                                                    >
                                                        {m.time}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        <Separator />
                        <div className="flex items-center gap-2 px-3 py-3 shrink-0">
                            <Button variant="ghost" size="icon" className="size-9 shrink-0">
                                <Paperclip className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-9 shrink-0">
                                <Smile className="size-4" />
                            </Button>
                            <Input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Type a message"
                                className="h-10"
                            />
                            <Button size="icon" className="size-9 shrink-0" onClick={() => setDraft('')}>
                                {draft.trim() ? <Send className="size-4" /> : <Mic className="size-4" />}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
