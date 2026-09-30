'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    Bot,
    Briefcase,
    Calendar,
    FileText,
    Headphones,
    Loader2,
    Mail,
    MessageSquare,
    Mic,
    Phone,
    Play,
    StickyNote,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CustomerAvatar } from '@/components/messages/customer-avatar';
import { useSupportAgent } from '@/hooks/use-support-agent';
import {
    mediaUrl,
    messageKey,
    useAddWhatsAppNoteMutation,
    useDeleteWhatsAppNoteMutation,
    useGetWhatsAppDetailsQuery,
    useGetWhatsAppNotesQuery,
    type WhatsAppConversation,
    type WhatsAppMessage,
} from '@/store/api/whatsappApi';

const MEDIA_TABS = [
    { value: 'all', label: 'All' },
    { value: 'photos', label: 'Photos' },
    { value: 'videos', label: 'Videos' },
    { value: 'docs', label: 'Docs' },
    { value: 'audio', label: 'Audio' },
] as const;
type MediaTab = (typeof MEDIA_TABS)[number]['value'];

const inTab = (m: WhatsAppMessage, tab: MediaTab) =>
    tab === 'all' ||
    (tab === 'photos' && (m.type === 'image' || m.type === 'sticker')) ||
    (tab === 'videos' && m.type === 'video') ||
    (tab === 'docs' && m.type === 'document') ||
    (tab === 'audio' && m.type === 'audio');

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function Row({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-1.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <div className="truncate text-sm">{children}</div>
            </div>
        </div>
    );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    );
}

function Notes({ conversationId }: { conversationId: string }) {
    const agent = useSupportAgent();
    const [draft, setDraft] = useState('');
    const { data: notes = [], isLoading } = useGetWhatsAppNotesQuery(conversationId);
    const [addNote, { isLoading: saving }] = useAddWhatsAppNoteMutation();
    const [deleteNote] = useDeleteWhatsAppNoteMutation();

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const body = draft.trim();
        if (!body) return;
        addNote({ conversationId, body })
            .unwrap()
            .then(() => setDraft(''))
            .catch((err: { data?: { message?: string } }) => toast.error('Couldn’t save the note', { description: err.data?.message }));
    };

    return (
        <Section title="Internal notes">
            <form onSubmit={submit} className="space-y-2">
                <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
                    }}
                    placeholder="Add a note only your team can see…"
                    className="min-h-16 resize-none text-sm"
                    maxLength={4000}
                />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Not visible to the customer</span>
                    <Button type="submit" size="sm" disabled={!draft.trim() || saving}>
                        {saving && <Loader2 className="size-3.5 animate-spin" />}
                        Save note
                    </Button>
                </div>
            </form>

            <div className="mt-3 space-y-2">
                {isLoading ? (
                    <Skeleton className="h-14 w-full rounded-lg" />
                ) : notes.length === 0 ? (
                    <p className="py-2 text-center text-xs text-muted-foreground">No notes yet.</p>
                ) : (
                    <AnimatePresence initial={false}>
                        {notes.map((n) => (
                            <motion.div
                                key={n.id}
                                layout
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="group rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2"
                            >
                                <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>
                                        {n.author.name} · {formatDate(n.createdAt)}
                                    </span>
                                    {(n.author.id === agent.id || agent.canManage) && (
                                        <button
                                            type="button"
                                            aria-label="Delete note"
                                            onClick={() => deleteNote({ conversationId, noteId: n.id })}
                                            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </Section>
    );
}

function SharedMedia({ messages, onJump }: { messages: WhatsAppMessage[]; onJump: (key: string) => void }) {
    const [tab, setTab] = useState<MediaTab>('all');
    const media = useMemo(() => messages.filter((m) => m.media).reverse(), [messages]);
    const shown = media.filter((m) => inTab(m, tab));
    const visual = shown.filter((m) => m.type === 'image' || m.type === 'sticker' || m.type === 'video');
    const files = shown.filter((m) => m.type === 'document' || m.type === 'audio');

    return (
        <Section title={`Shared files · ${media.length}`}>
            <Tabs value={tab} onValueChange={(v) => setTab(v as MediaTab)}>
                <TabsList className="h-8 w-full">
                    {MEDIA_TABS.map((t) => (
                        <TabsTrigger key={t.value} value={t.value} className="px-1.5 text-xs">
                            {t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {shown.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Nothing shared here yet.</p>
            ) : (
                <div className="mt-3 space-y-3">
                    {visual.length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5">
                            {visual.map((m) => (
                                <button
                                    key={messageKey(m)}
                                    type="button"
                                    onClick={() => onJump(messageKey(m))}
                                    title="Show in chat"
                                    className="relative aspect-square overflow-hidden rounded-lg bg-muted ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                >
                                    {m.type === 'video' ? (
                                        <>
                                            <video src={mediaUrl(m)} muted preload="metadata" className="size-full object-cover" />
                                            <span className="absolute inset-0 flex items-center justify-center">
                                                <span className="flex size-7 items-center justify-center rounded-full bg-black/50 text-white">
                                                    <Play className="size-3.5 translate-x-px fill-current" />
                                                </span>
                                            </span>
                                        </>
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element -- streamed from our API
                                        <img src={mediaUrl(m)} alt={m.body || 'Photo'} loading="lazy" className="size-full object-cover" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    {files.length > 0 && (
                        <div className="space-y-1">
                            {files.map((m) => {
                                const Icon = m.type === 'audio' ? (m.media?.voice ? Mic : Headphones) : FileText;
                                return (
                                    <button
                                        key={messageKey(m)}
                                        type="button"
                                        onClick={() => onJump(messageKey(m))}
                                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                                    >
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            <Icon className="size-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm">
                                                {m.type === 'audio'
                                                    ? m.media?.voice
                                                        ? 'Voice message'
                                                        : (m.media?.filename ?? 'Audio')
                                                    : (m.media?.filename ?? 'Document')}
                                            </span>
                                            <span className="block text-[11px] text-muted-foreground">
                                                {m.direction === 'outbound' ? 'You' : 'Customer'} · {formatDate(m.createdAt)}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </Section>
    );
}

/** Right-hand panel: who the customer is, team notes, and everything shared. */
export function ConversationInfoPanel({
    conversation,
    messages,
    onJump,
    onClose,
}: {
    conversation: WhatsAppConversation;
    messages: WhatsAppMessage[];
    onJump: (key: string) => void;
    onClose: () => void;
}) {
    const { data: details, isLoading } = useGetWhatsAppDetailsQuery(conversation.id);

    return (
        <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="shrink-0 overflow-hidden border-l bg-sidebar"
            aria-label="Conversation info"
        >
            <div className="flex h-full w-[340px] flex-col">
                <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
                    <p className="text-sm font-semibold">Contact info</p>
                    <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close contact info">
                        <X className="size-4" />
                    </Button>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                    <div className="flex flex-col items-center gap-2 px-4 pt-6 pb-4 text-center">
                        <CustomerAvatar name={conversation.name} seed={conversation.phone} className="size-20 text-2xl" />
                        <div>
                            <p className="text-base font-semibold">{conversation.name}</p>
                            <p className="text-sm text-muted-foreground">+{conversation.phone}</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-1.5">
                            <Badge variant="secondary" className="capitalize">
                                {conversation.status === 'bot' ? 'AI handling' : conversation.status}
                            </Badge>
                            {conversation.assignedTo && (
                                <Badge variant="outline">
                                    <UserRound className="size-3" /> {conversation.assignedTo.name}
                                </Badge>
                            )}
                            {conversation.aiEnabled && (
                                <Badge variant="outline">
                                    <Bot className="size-3" /> AI on
                                </Badge>
                            )}
                        </div>
                    </div>

                    <Separator />
                    <Section title="Details">
                        {isLoading || !details ? (
                            <div className="space-y-2">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        ) : (
                            <>
                                <Row icon={Phone} label="WhatsApp">
                                    +{details.phone}
                                </Row>
                                <Row icon={Calendar} label="First contact">
                                    {formatDate(details.firstContactAt)}
                                </Row>
                                <Row icon={MessageSquare} label="Activity">
                                    {details.messageCount} messages · {details.conversationCount}{' '}
                                    {details.conversationCount === 1 ? 'conversation' : 'conversations'}
                                </Row>
                                {details.assignedTo && (
                                    <Row icon={UserRound} label="Assigned to">
                                        {details.assignedTo.name}
                                        {details.assignedAt && (
                                            <span className="text-muted-foreground"> · since {formatDate(details.assignedAt)}</span>
                                        )}
                                    </Row>
                                )}
                            </>
                        )}
                    </Section>

                    {details && (details.client || details.lead) && (
                        <>
                            <Separator />
                            <Section title="Account">
                                {details.client && (
                                    <div className="rounded-lg border bg-background/60 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="flex items-center gap-2 truncate text-sm font-medium">
                                                <Briefcase className="size-4 text-primary" /> {details.client.name}
                                            </p>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    'capitalize',
                                                    details.client.status === 'active' && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
                                                )}
                                            >
                                                {details.client.status}
                                            </Badge>
                                        </div>
                                        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                                            {details.client.clientId && <p>Client ID · {details.client.clientId}</p>}
                                            {details.client.email && (
                                                <p className="flex items-center gap-1.5 truncate">
                                                    <Mail className="size-3" /> {details.client.email}
                                                </p>
                                            )}
                                            {details.client.currency && <p>Billing currency · {details.client.currency}</p>}
                                            {details.client.since && <p>Client since {formatDate(details.client.since)}</p>}
                                        </div>
                                    </div>
                                )}
                                {details.lead && (
                                    <div className={cn('rounded-lg border bg-background/60 p-3', details.client && 'mt-2')}>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-sm font-medium">Lead · {details.lead.name}</p>
                                            <Badge variant="secondary" className="capitalize">
                                                {details.lead.status}
                                            </Badge>
                                        </div>
                                        {details.lead.source && (
                                            <p className="mt-1 text-xs text-muted-foreground">Source · {details.lead.source}</p>
                                        )}
                                    </div>
                                )}
                            </Section>
                        </>
                    )}

                    <Separator />
                    <Notes conversationId={conversation.id} />

                    <Separator />
                    <SharedMedia messages={messages} onJump={onJump} />
                    <div className="flex items-center justify-center gap-1.5 pb-6 text-[11px] text-muted-foreground">
                        <StickyNote className="size-3" /> Notes stay with this customer across chats
                    </div>
                </ScrollArea>
            </div>
        </motion.aside>
    );
}
