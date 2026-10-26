'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Brain, Globe, Inbox, Loader2, Mail, MessageCircle, Phone, Search, Ticket as TicketIcon, User as UserIcon, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetWebChatQuery, useGetWebChatsQuery, type WebChatSummary } from '@/store/api/webChatApi';

// What the website assistant did in the chat, in words an agent can scan.
const ACTION_LABEL: Record<string, string> = {
    create_ticket: 'Raised a ticket',
    connect_live_support: 'Handed to live chat',
    book_consultation: 'Booked a consultation',
};

function relative(iso: string): string {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return d < 7 ? `${d}d` : format(new Date(iso), 'MMM d');
}

const displayName = (c: Pick<WebChatSummary, 'visitorName' | 'visitorEmail'>) => c.visitorName || c.visitorEmail || 'Anonymous visitor';

function ChatRow({ chat, selected, onSelect }: { chat: WebChatSummary; selected: boolean; onSelect: () => void }) {
    return (
        <button
            onClick={onSelect}
            className={cn('flex w-full flex-col gap-1 border-l-2 px-4 py-3 text-left transition-colors', selected ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-accent/50')}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{displayName(chat)}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{relative(chat.updatedAt)}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
                {chat.lastMessage ? `${chat.lastMessage.role === 'user' ? '' : 'AI: '}${chat.lastMessage.content}` : 'No messages'}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <Badge variant="outline" className="gap-1 text-[10px]">
                    <Bot className="size-2.5" /> AI chat
                </Badge>
                {chat.lastAction && ACTION_LABEL[chat.lastAction] && (
                    <Badge variant="secondary" className="text-[10px]">
                        {ACTION_LABEL[chat.lastAction]}
                    </Badge>
                )}
                {chat.ticket && (
                    <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                        <TicketIcon className="size-2.5" /> {chat.ticket.ticketId}
                    </Badge>
                )}
            </div>
        </button>
    );
}

function ChatThread({ id }: { id: string }) {
    const { data: chat, isFetching } = useGetWebChatQuery(id, { pollingInterval: 15_000 });
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chat?.messages.length, id]);

    if (!chat) {
        return (
            <div className="flex flex-1 items-center justify-center">{isFetching ? <Loader2 className="size-6 animate-spin text-muted-foreground" /> : <p className="text-sm text-muted-foreground">Chat not found.</p>}</div>
        );
    }
    const phone = chat.visitorPhone || chat.contact?.whatsappPhone || chat.contact?.phones?.[0];

    return (
        <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="shrink-0 border-b px-5 py-3">
                    <div className="flex items-center gap-2">
                        <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                            <UserIcon className="size-4 text-muted-foreground" />
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{displayName(chat)}</p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {chat.visitorEmail && (
                                    <a href={`mailto:${chat.visitorEmail}`} className="flex items-center gap-1 hover:text-foreground">
                                        <Mail className="size-3" /> {chat.visitorEmail}
                                    </a>
                                )}
                                {phone && (
                                    <a href={`tel:+${phone.replace(/\D/g, '')}`} className="flex items-center gap-1 hover:text-foreground">
                                        {chat.contact?.whatsappPhone ? <MessageCircle className="size-3 text-emerald-600" /> : <Phone className="size-3" />} {phone}
                                    </a>
                                )}
                                <span className="flex items-center gap-1">
                                    <Globe className="size-3" /> Website AI chat · started {format(new Date(chat.createdAt), 'MMM d, h:mm a')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <ScrollArea className="min-h-0 flex-1 bg-gradient-to-b from-muted/20 to-transparent">
                    <div className="mx-auto max-w-2xl space-y-3 px-5 py-5">
                        {chat.messages.map((m, i) => (
                            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}>
                                <div className={cn('max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm', m.role === 'user' ? 'rounded-tl-sm bg-muted' : 'rounded-tr-sm bg-primary text-primary-foreground')}>
                                    {m.role === 'model' && (
                                        <span className="mb-0.5 flex items-center gap-1 text-[10px] font-medium opacity-70">
                                            <Bot className="size-3" /> AI
                                        </span>
                                    )}
                                    {m.content}
                                    {m.action && ACTION_LABEL[m.action] && <span className="mt-1 block text-[10px] font-medium opacity-70">→ {ACTION_LABEL[m.action]}</span>}
                                </div>
                            </div>
                        ))}
                        <div ref={endRef} />
                    </div>
                </ScrollArea>
                <p className="shrink-0 border-t px-5 py-2.5 text-center text-xs text-muted-foreground">
                    The AI answers here. To talk to the visitor yourself, open their ticket or live chat.
                </p>
            </div>

            <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto border-l p-4 xl:block">
                <section className="space-y-1.5">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Brain className="size-3.5" /> What the AI remembers
                    </h3>
                    {chat.aiMemory ? <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">{chat.aiMemory}</p> : <p className="text-xs text-muted-foreground">Nothing yet.</p>}
                </section>
                {chat.ticket && (
                    <section className="space-y-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ticket</h3>
                        <Link href={`/tickets?ticket=${chat.ticket._id}`} className="flex items-center gap-2 rounded-lg border p-2.5 text-xs hover:bg-accent">
                            <TicketIcon className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0">
                                <span className="block font-mono">{chat.ticket.ticketId}</span>
                                <span className="block truncate text-muted-foreground">{chat.ticket.subject}</span>
                            </span>
                        </Link>
                    </section>
                )}
                {chat.contact && (
                    <section className="space-y-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</h3>
                        <div className="space-y-1 rounded-lg border p-2.5 text-xs">
                            {chat.contact.clientId && (
                                <Link href={`/clients/${chat.contact.clientId}`} className="flex items-center gap-1 font-medium text-violet-600 hover:underline">
                                    <UserCheck className="size-3" /> Client
                                </Link>
                            )}
                            {chat.contact.emails.map((e) => (
                                <p key={e} className="truncate text-muted-foreground">{e}</p>
                            ))}
                            {chat.contact.phones.map((p) => (
                                <p key={p} className="text-muted-foreground">+{p}</p>
                            ))}
                        </div>
                    </section>
                )}
            </aside>
        </div>
    );
}

function WebChats() {
    const router = useRouter();
    const params = useSearchParams();
    const selected = params.get('chat');
    const [query, setQuery] = useState('');
    const { data: chats = [], isLoading } = useGetWebChatsQuery(query.trim() || undefined, { pollingInterval: 20_000 });

    const select = (id: string) => router.replace(`?chat=${id}`, { scroll: false });

    return (
        <div className="flex h-full overflow-hidden bg-background">
            <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden border-r">
                <div className="space-y-3 px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-semibold">Website chats</h1>
                        <Badge variant="secondary" className="text-xs">{chats.length}</Badge>
                    </div>
                    <div className="relative">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Search name, email, phone, message…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-9" />
                    </div>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                    {isLoading ? (
                        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="m-3 h-14 rounded-lg" />)
                    ) : chats.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-16 text-center">
                            <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
                                <Inbox className="size-5 text-muted-foreground" />
                            </span>
                            <p className="text-sm font-medium">No website chats</p>
                            <p className="mt-1 text-xs text-muted-foreground">{query ? 'Nothing matches your search.' : 'Chats with the website assistant will appear here.'}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {chats.map((c) => (
                                <ChatRow key={c.conversationId} chat={c} selected={selected === c.conversationId} onSelect={() => select(c.conversationId)} />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </aside>

            {selected ? (
                <ChatThread id={selected} />
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <span className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                        <Globe className="size-7 text-muted-foreground" />
                    </span>
                    <p className="text-base font-medium">Select a website chat</p>
                    <p className="text-sm text-muted-foreground">See what visitors asked the AI, what it remembers, and the ticket it raised.</p>
                </div>
            )}
        </div>
    );
}

export default function WebsiteChatsPage() {
    return (
        <Suspense fallback={<Skeleton className="m-6 h-64 rounded-xl" />}>
            <WebChats />
        </Suspense>
    );
}
