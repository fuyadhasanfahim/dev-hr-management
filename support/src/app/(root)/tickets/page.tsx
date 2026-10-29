'use client';

import {
    useState,
    useCallback,
    useRef,
    useEffect,
    type ChangeEvent,
    type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Ticket as TicketIcon,
    Search,
    Loader2,
    Send,
    Paperclip,
    Clock,
    CheckCircle2,
    Circle,
    AlertCircle,
    Inbox,
    UserCheck,
    Mail,
    MessageSquare,
    ChevronDown,
    ExternalLink,
    Info,
    Phone,
    PanelRightClose,
    PanelRightOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AttachmentPreview } from '@/components/messages/chat-attachment';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    useGetTicketsQuery,
    useGetTicketDetailQuery,
    useReplyToTicketMutation,
    useUpdateTicketStatusMutation,
    useUpdateTicketMutation,
    useAssignTicketToSelfMutation,
    useGetContactQuery,
    type Ticket,
    type TicketReply,
    type TicketStatus,
    type TicketPriority,
    type TicketCategory,
} from '@/store/api/ticketApi';
import {
    useGetAvailableAgentsQuery,
    useRequestPresignedUrlMutation,
} from '@/store/api/chatApi';

// ─── config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
    TicketStatus,
    { label: string; className: string; icon: React.ElementType }
> = {
    open: {
        label: 'Open',
        className:
            'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
        icon: Circle,
    },
    in_progress: {
        label: 'In Progress',
        className:
            'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
        icon: Loader2,
    },
    pending_client: {
        label: 'Pending Client',
        className:
            'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
        icon: Clock,
    },
    resolved: {
        label: 'Resolved',
        className:
            'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        icon: CheckCircle2,
    },
    closed: {
        label: 'Closed',
        className:
            'bg-muted text-muted-foreground border-border',
        icon: CheckCircle2,
    },
};

const PRIORITY_CONFIG: Record<
    TicketPriority,
    { label: string; className: string }
> = {
    low: {
        label: 'Low',
        className: 'bg-muted text-muted-foreground border-border',
    },
    medium: {
        label: 'Medium',
        className:
            'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    },
    high: {
        label: 'High',
        className:
            'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
    },
    urgent: {
        label: 'Urgent',
        className:
            'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
    },
};

const CATEGORY_CONFIG: Record<
    TicketCategory,
    { label: string; className: string }
> = {
    support: {
        label: 'Support',
        className:
            'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20',
    },
    service: {
        label: 'Service',
        className:
            'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20',
    },
    development: {
        label: 'Development',
        className:
            'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    },
    billing: {
        label: 'Billing',
        className:
            'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    },
    bug: {
        label: 'Bug Report',
        className:
            'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20',
    },
};
const STATUS_FILTERS: { value: TicketStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'Active' },
    { value: 'pending_client', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
];

// Tickets come from the website chat only, so there is no channel filter. Development is not a ticket topic any more.
const CATEGORY_FILTERS: { value: TicketCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'support', label: 'Support' },
    { value: 'service', label: 'Service' },
    { value: 'billing', label: 'Billing' },
    { value: 'bug', label: 'Bug' },
];

/** The number to reach the customer on. */
function getTicketPhone(t: Ticket): string | null {
    const contact = t.contactId;
    return t.visitorPhone || t.whatsappPhone || contact?.whatsappPhone || contact?.phones?.[0] || null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function getTicketUser(t: Ticket): { name: string; email: string; isGuest: boolean } {
    const client = t.clientId;
    const guest = t.guestId;
    const u = client ?? guest;
    // Prefer the populated client/guest record, but fall back to the denormalized
    // snapshot captured at creation so name/email always show even when the
    // reference isn't populated.
    return {
        name: u?.name?.trim() || t.visitorName?.trim() || 'Guest',
        email: u?.email?.trim() || t.visitorEmail?.trim() || '',
        isGuest: !client,
    };
}

// Deterministic accent per person so avatars are distinguishable at a glance.
const AVATAR_COLORS = [
    'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
];
function avatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// The ticket body may have an appended chat transcript (from the AI-chat flow).
// Split it out so the customer's actual message reads cleanly and the transcript
// can be tucked into a collapsible block.
function splitTicketBody(text: string): { description: string; transcript: string | null } {
    const markers = ['--- Chat Transcript ---', '--- Prior AI Chat ---'];
    let idx = -1;
    for (const m of markers) {
        const i = text.indexOf(m);
        if (i !== -1 && (idx === -1 || i < idx)) idx = i;
    }
    if (idx === -1) return { description: text, transcript: null };
    return {
        description: text.slice(0, idx).trim(),
        transcript: text.slice(idx).trim(),
    };
}

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
}

// ─── sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TicketStatus }) {
    const cfg = STATUS_CONFIG[status];
    const Icon = cfg.icon;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                cfg.className,
            )}
        >
            <Icon className={cn('size-2.5', status === 'in_progress' && 'animate-spin motion-reduce:animate-none')} />
            {cfg.label}
        </span>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}

// The same person's other tickets, live chat and client / lead record, as small links.
function ContactLinks({ ticket, onOpenTicket }: { ticket: Ticket; onOpenTicket: (id: string) => void }) {
    const contactId = ticket.contactId?._id;
    const { data } = useGetContactQuery(contactId!, { skip: !contactId });
    const sessionId = ticket.chatSessionId?.sessionId;
    const liveOpen = !!sessionId && ['queued', 'active', 'converted_to_ticket'].includes(ticket.chatSessionId?.status ?? '');
    const others = (data?.tickets ?? []).filter((t) => t._id !== ticket._id).slice(0, 5);

    if (!liveOpen && !data?.client && !data?.lead && others.length === 0) return null;
    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Related</p>
            <div className="flex flex-col gap-1.5 text-xs">
                {liveOpen && (
                    <Button asChild size="sm" variant="outline" className="h-8 justify-start gap-2">
                        <Link href={`/messages/web/${sessionId}`}>
                            <MessageSquare className="size-3.5" />
                            Open live chat
                        </Link>
                    </Button>
                )}
                {data?.client && (
                    <Link href={`/clients/${data.client._id}`} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 hover:bg-accent">
                        <UserCheck className="size-3.5 text-violet-600" />
                        Client: {data.client.name}
                    </Link>
                )}
                {data?.lead && (
                    <Link href="/leads" className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 hover:bg-accent">
                        <ExternalLink className="size-3.5 text-amber-600" />
                        Lead: {data.lead.name} ({data.lead.status})
                    </Link>
                )}
                {others.map((t) => (
                    <button
                        key={t._id}
                        onClick={() => onOpenTicket(t._id)}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left hover:bg-accent"
                        title={t.subject}
                    >
                        <TicketIcon className="size-3.5 text-muted-foreground" />
                        <span className="font-mono">{t.ticketId}</span>
                        <span className="truncate text-muted-foreground">{t.subject}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function TicketSkeleton() {
    return (
        <div className="flex flex-col gap-2 rounded-lg px-3 py-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-1/2" />
        </div>
    );
}

function TicketListItem({ ticket, isSelected, onSelect }: { ticket: Ticket; isSelected: boolean; onSelect: () => void }) {
    const user = getTicketUser(ticket);
    const urgent = ticket.priority === 'urgent' || ticket.priority === 'high';
    return (
        <button
            onClick={onSelect}
            className={cn(
                'w-full flex items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-sidebar-accent',
                isSelected && 'bg-sidebar-accent',
            )}
        >
            <Avatar className="size-10 shrink-0">
                <AvatarFallback className={cn('text-sm font-semibold', avatarColor(user.name))}>
                    {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatRelative(ticket.updatedAt)}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{ticket.subject}</p>
                <div className="flex items-center gap-1.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{ticket.ticketId}</span>
                    <StatusBadge status={ticket.status} />
                    {urgent && <PriorityBadge priority={ticket.priority} />}
                </div>
            </div>
        </button>
    );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
    const cfg = PRIORITY_CONFIG[priority];
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                cfg.className,
            )}
        >
            {cfg.label}
        </span>
    );
}

function AttachmentChip({ url }: { url: string }) {
    // Files live in a private bucket: the shared preview signs the link and shows images or a file card.
    return (
        <div className="mt-2">
            <AttachmentPreview url={url} />
        </div>
    );
}

// Long messages stay short in the thread: the first lines, then "Show more".
function ClampedText({ text, tone }: { text: string; tone: 'staff' | 'customer' }) {
    const [open, setOpen] = useState(false);
    const long = text.length > 480 || text.split('\n').length > 8;
    return (
        <>
            <span className={cn('block', long && !open && 'line-clamp-6')}>{text}</span>
            {long && (
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className={cn(
                        'mt-1.5 text-xs font-medium underline-offset-2 hover:underline',
                        tone === 'staff' ? 'text-primary-foreground/80' : 'text-primary',
                    )}
                >
                    {open ? 'Show less' : 'Show more'}
                </button>
            )}
        </>
    );
}

function ChatTranscript({ raw }: { raw: string }) {
    const [open, setOpen] = useState(false);
    const lines = raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('---'));
    return (
        <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
            >
                <MessageSquare className="size-3.5 shrink-0" />
                Chat transcript
                <span className="text-[10px] text-muted-foreground/75">
                    {lines.length} message{lines.length === 1 ? '' : 's'}
                </span>
                <ChevronDown
                    className={cn(
                        'size-3.5 ml-auto transition-transform',
                        open && 'rotate-180',
                    )}
                />
            </button>
            {open && (
                <div className="px-3.5 pb-3 pt-2 space-y-2 border-t border-border/40">
                    {lines.map((line, i) => {
                        const m = line.match(/^\[([^\]]+)\]:\s*(.*)$/);
                        const role = m ? m[1] : '';
                        const text = m ? m[2] : line;
                        const isCustomer = /customer|client/i.test(role);
                        return (
                            <div key={i} className="text-xs leading-relaxed">
                                {role && (
                                    <span
                                        className={cn(
                                            'font-semibold mr-1.5',
                                            isCustomer
                                                ? 'text-foreground'
                                                : 'text-primary',
                                        )}
                                    >
                                        {role}:
                                    </span>
                                )}
                                <span className="text-muted-foreground">{text}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function MessageBubble({
    senderName,
    content,
    attachments,
    createdAt,
    isStaff,
}: {
    senderName: string;
    content: string;
    attachments: string[];
    createdAt: string;
    isStaff: boolean;
}) {
    return (
        <div
            className={cn(
                'flex items-end gap-2.5 group',
                isStaff ? 'flex-row-reverse' : 'flex-row',
            )}
        >
            {!isStaff && (
                <Avatar className="size-7 shrink-0 mb-5">
                    <AvatarFallback
                        className={cn('text-[10px] font-semibold', avatarColor(senderName))}
                    >
                        {senderName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
            )}
            <div
                className={cn(
                    'max-w-[70%] space-y-1',
                    isStaff ? 'items-end' : 'items-start',
                )}
            >
                <p
                    className={cn(
                        'text-[11px] text-muted-foreground px-1 font-medium',
                        isStaff && 'text-right',
                    )}
                >
                    {senderName}
                </p>
                <div
                    className={cn(
                        'px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm whitespace-pre-wrap',
                        isStaff
                            ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                            : 'bg-muted text-foreground rounded-2xl rounded-bl-md',
                    )}
                >
                    {content && content !== '(attachment)' && (
                        <ClampedText text={content} tone={isStaff ? 'staff' : 'customer'} />
                    )}
                    {attachments?.length > 0 && (
                        <div className="space-y-1.5">
                            {attachments.map((url, i) => (
                                <AttachmentChip key={i} url={url} />
                            ))}
                        </div>
                    )}
                </div>
                <p
                    className={cn(
                        'text-[10px] text-muted-foreground px-1 opacity-0 group-hover:opacity-100 transition-opacity',
                        isStaff && 'text-right',
                    )}
                >
                    {format(new Date(createdAt), 'MMM d, h:mm a')}
                </p>
            </div>
        </div>
    );
}

// ─── main page ─────────────────────────────────────────────────────────────────

export default function TicketsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedId = searchParams.get('ticket');

    const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [replyValue, setReplyValue] = useState('');
    const [uploading, setUploading] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const threadEndRef = useRef<HTMLDivElement>(null);

    const ticketQueryArgs = (() => {
        const args: { status?: TicketStatus; category?: TicketCategory } = {};
        if (statusFilter !== 'all') args.status = statusFilter;
        if (categoryFilter !== 'all') args.category = categoryFilter;
        return Object.keys(args).length > 0 ? args : undefined;
    })();
    const { data: tickets = [], isLoading: ticketsLoading } = useGetTicketsQuery(ticketQueryArgs, { pollingInterval: 30_000 });
    const { data: ticket, isFetching: detailLoading } = useGetTicketDetailQuery(selectedId!, { skip: !selectedId });
    const { data: agents = [] } = useGetAvailableAgentsQuery();
    const [replyToTicket, { isLoading: isSending }] = useReplyToTicketMutation();
    const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateTicketStatusMutation();
    const [updateTicket, { isLoading: isUpdating }] = useUpdateTicketMutation();
    const [assignToSelf, { isLoading: isAssigning }] = useAssignTicketToSelfMutation();
    const [requestPresignedUrl] = useRequestPresignedUrlMutation();

    useEffect(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [ticket?.replies?.length, selectedId]);

    const handleSelect = useCallback(
        (id: string) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('ticket', id);
            router.replace(`?${params.toString()}`, { scroll: false });
            setReplyValue('');
        },
        [router, searchParams],
    );

    const handleBack = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('ticket');
        router.replace(params.size ? `?${params.toString()}` : '?', { scroll: false });
    }, [router, searchParams]);

    const sendReply = useCallback(
        async (text?: string, attachments?: string[]) => {
            if (!ticket) return;
            const body = text ?? replyValue.trim();
            if (!body && (!attachments || attachments.length === 0)) return;
            const result = await replyToTicket({ id: ticket._id, text: body || '(attachment)', attachments });
            if ('error' in result) {
                toast.error('Could not send the reply. Try again.');
                return;
            }
            if (!text) setReplyValue('');
            // Replies reach the customer by email: say so when there is nobody to email.
            if ((result.data as { emailed?: boolean } | undefined)?.emailed === false) {
                toast.warning('Reply saved, but this ticket has no email on file, so the customer was not notified.');
            }
        },
        [ticket, replyValue, replyToTicket],
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendReply();
            }
        },
        [sendReply],
    );

    const handleFileUpload = useCallback(
        async (e: ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (!files?.length || !ticket) return;
            setUploading(true);
            const urls: string[] = [];
            for (const file of Array.from(files)) {
                try {
                    const result = await requestPresignedUrl({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        folder: 'tickets',
                        referenceId: ticket._id,
                    }).unwrap();
                    await fetch(result.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
                    urls.push(result.fileUrl);
                } catch {
                    // skip failed uploads
                }
            }
            if (urls.length > 0) await sendReply('(attachment)', urls);
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        [ticket, requestPresignedUrl, sendReply],
    );

    const filteredTickets = searchQuery
        ? tickets.filter((t) => {
              const user = getTicketUser(t);
              const phone = getTicketPhone(t) ?? '';
              const q = searchQuery.toLowerCase();
              return (
                  t.subject.toLowerCase().includes(q) ||
                  t.ticketId.toLowerCase().includes(q) ||
                  user.name.toLowerCase().includes(q) ||
                  user.email.toLowerCase().includes(q) ||
                  phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '\u0000')
              );
          })
        : tickets;

    const ticketUser = ticket ? getTicketUser(ticket) : null;
    const ticketPhone = ticket ? getTicketPhone(ticket) : null;
    const isClosed = ticket?.status === 'closed';

    return (
        <div className="flex h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl border bg-sidebar">
            {/* ── Ticket list ──────────────────────────────────────────────── */}
            <aside
                className={cn(
                    'w-full md:w-[340px] shrink-0 flex-col border-r overflow-hidden',
                    selectedId ? 'hidden md:flex' : 'flex',
                )}
            >
                <div className="px-4 pt-4 pb-3 space-y-3">
                    <div className="flex items-center justify-between pl-10 md:pl-0">
                        <h1 className="text-lg font-semibold">Tickets</h1>
                        <Badge variant="secondary" className="text-xs tabular-nums">
                            {tickets.length}
                        </Badge>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search tickets"
                            value={searchQuery}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as TicketStatus | 'all')}>
                        <TabsList className="w-full">
                            {STATUS_FILTERS.map((f) => (
                                <TabsTrigger key={f.value} value={f.value} className="px-1.5 text-xs">
                                    {f.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as TicketCategory | 'all')}>
                        <TabsList className="w-full">
                            {CATEGORY_FILTERS.map((f) => (
                                <TabsTrigger key={f.value} value={f.value} className="px-1.5 text-xs">
                                    {f.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>

                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-2 pb-2">
                        {ticketsLoading ? (
                            Array.from({ length: 5 }).map((_, i) => <TicketSkeleton key={i} />)
                        ) : filteredTickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                                <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                    <Inbox className="size-5 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium">No tickets</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {searchQuery ? 'No tickets match your search.' : 'No tickets in this view.'}
                                </p>
                            </div>
                        ) : (
                            filteredTickets.map((t) => (
                                <TicketListItem key={t._id} ticket={t} isSelected={selectedId === t._id} onSelect={() => handleSelect(t._id)} />
                            ))
                        )}
                    </div>
                </ScrollArea>
            </aside>

            {/* ── Ticket detail ────────────────────────────────────────────── */}
            <section className={cn('relative min-w-0 flex-1 flex-col bg-background', selectedId ? 'flex' : 'hidden md:flex')}>
                {!selectedId ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
                        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                            <TicketIcon className="size-7 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-base font-medium">Select a ticket</p>
                            <p className="text-sm text-muted-foreground mt-1">Choose a ticket from the list to see the conversation.</p>
                        </div>
                    </div>
                ) : detailLoading && !ticket ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                ) : ticket ? (
                    <>
                        {/* Header */}
                        <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
                            <Button variant="ghost" size="icon" className="size-8 md:hidden" onClick={handleBack} aria-label="Back to tickets">
                                <ArrowLeft className="size-4" />
                            </Button>
                            <Avatar className="size-10 shrink-0">
                                <AvatarFallback className={cn('text-sm font-semibold', avatarColor(ticketUser?.name ?? 'Guest'))}>
                                    {(ticketUser?.name ?? 'G').charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="truncate text-sm font-semibold">{ticket.subject}</h2>
                                    <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                                        {ticket.ticketId}
                                    </span>
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                    {ticketUser?.name}
                                    {ticketUser?.email ? ` · ${ticketUser.email}` : ''}
                                    {ticketPhone ? ` · ${ticketPhone}` : ''} · {formatRelative(ticket.createdAt)}
                                </p>
                            </div>
                            <Select
                                value={ticket.status}
                                onValueChange={(v) => updateStatus({ id: ticket._id, status: v as TicketStatus })}
                                disabled={isUpdatingStatus}
                            >
                                <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Ticket status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {STATUS_CONFIG[s].label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant={infoOpen ? 'secondary' : 'ghost'}
                                size="icon"
                                className="size-8"
                                aria-label="Ticket details"
                                aria-pressed={infoOpen}
                                title="Ticket details"
                                onClick={() => setInfoOpen((o) => !o)}
                            >
                                {infoOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
                            </Button>
                        </header>

                        <div className="flex min-h-0 flex-1">
                            <div className="flex min-w-0 flex-1 flex-col">
                                {/* Conversation thread */}
                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    <div className="px-4 py-5 space-y-4 max-w-3xl mx-auto">
                                        {(() => {
                                            const { description, transcript } = splitTicketBody(ticket.text || ticket.subject);
                                            return (
                                                <>
                                                    <MessageBubble
                                                        senderName={ticketUser?.name ?? 'Guest'}
                                                        content={description || ticket.subject}
                                                        attachments={ticket.attachments ?? []}
                                                        createdAt={ticket.createdAt}
                                                        isStaff={false}
                                                    />
                                                    {transcript && (
                                                        <div className="pl-[38px] pr-2">
                                                            <ChatTranscript raw={transcript} />
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}

                                        {ticket.replies.map((reply: TicketReply) => {
                                            const isStaff = reply.senderType === 'staff';
                                            const name = reply.senderId?.name || reply.senderName || (isStaff ? 'Support' : 'Client');
                                            return (
                                                <MessageBubble
                                                    key={reply._id}
                                                    senderName={name}
                                                    content={reply.text || reply.content}
                                                    attachments={reply.attachments ?? []}
                                                    createdAt={reply.createdAt}
                                                    isStaff={isStaff}
                                                />
                                            );
                                        })}
                                        <div ref={threadEndRef} />
                                    </div>
                                </div>

                                {/* Reply box */}
                                {isClosed ? (
                                    <div className="shrink-0 border-t bg-muted/40 px-4 py-3 text-center">
                                        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                            <AlertCircle className="size-4" />
                                            This ticket is closed. Change its status to reply.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="shrink-0 border-t p-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                multiple
                                                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.docx,.xlsx,.txt"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-10 shrink-0 rounded-full"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploading}
                                                aria-label="Attach a file"
                                            >
                                                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                                            </Button>
                                            <Input
                                                type="text"
                                                value={replyValue}
                                                onChange={(e: ChangeEvent<HTMLInputElement>) => setReplyValue(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Reply to the customer"
                                                className="h-10 flex-1 rounded-full px-4"
                                            />
                                            <Button
                                                size="icon"
                                                onClick={() => sendReply()}
                                                disabled={!replyValue.trim() || isSending}
                                                className="size-10 shrink-0 rounded-full"
                                                aria-label="Send reply"
                                            >
                                                {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Details: a side panel on large screens, a sheet over the thread on small ones */}
                            {infoOpen && (
                                <aside className="absolute inset-y-0 right-0 z-10 w-[300px] max-w-full space-y-5 overflow-y-auto border-l bg-background p-4 shadow-xl lg:static lg:shadow-none">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <Info className="size-4" /> Details
                                    </div>

                                    <div className="space-y-3">
                                        <Field label="Priority">
                                            <Select
                                                value={ticket.priority}
                                                onValueChange={(v) => updateTicket({ id: ticket._id, priority: v as TicketPriority })}
                                                disabled={isUpdating}
                                            >
                                                <SelectTrigger className="h-9 w-full text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map((p) => (
                                                        <SelectItem key={p} value={p}>
                                                            {PRIORITY_CONFIG[p].label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                        <Field label="Category">
                                            <Select
                                                value={ticket.category || 'support'}
                                                onValueChange={(v) => updateTicket({ id: ticket._id, category: v as TicketCategory })}
                                                disabled={isUpdating}
                                            >
                                                <SelectTrigger className="h-9 w-full text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(Object.keys(CATEGORY_CONFIG) as TicketCategory[]).map((c) => (
                                                        <SelectItem key={c} value={c}>
                                                            {CATEGORY_CONFIG[c].label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                        <Field label="Assignee">
                                            <Select
                                                value={ticket.assignedTo?._id ?? ''}
                                                onValueChange={(v) => updateTicket({ id: ticket._id, assignedTo: v })}
                                                disabled={isUpdating}
                                            >
                                                <SelectTrigger className="h-9 w-full text-sm">
                                                    <SelectValue placeholder="Unassigned" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {agents.map((a) => (
                                                        <SelectItem key={a._id} value={a._id}>
                                                            {a.userId?.name || a.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-9 w-full gap-1.5"
                                            onClick={() => assignToSelf(ticket._id)}
                                            disabled={isAssigning}
                                        >
                                            {isAssigning ? <Loader2 className="size-3.5 animate-spin" /> : <UserCheck className="size-3.5" />}
                                            Assign to me
                                        </Button>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2 text-sm">
                                        <p className="text-xs font-medium text-muted-foreground">Customer</p>
                                        <p className="font-medium">{ticketUser?.name}</p>
                                        {ticketUser?.email ? (
                                            <a href={`mailto:${ticketUser.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                                                <Mail className="size-3.5 shrink-0" />
                                                <span className="truncate">{ticketUser.email}</span>
                                            </a>
                                        ) : (
                                            <p className="flex items-center gap-2 text-xs italic text-muted-foreground">
                                                <Mail className="size-3.5 shrink-0" /> no email on file
                                            </p>
                                        )}
                                        {ticketPhone && (
                                            <a href={`tel:+${ticketPhone.replace(/\D/g, '')}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                                                <Phone className="size-3.5 shrink-0" />
                                                {ticketPhone}
                                            </a>
                                        )}
                                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock className="size-3.5 shrink-0" />
                                            Opened {format(new Date(ticket.createdAt), 'MMM d, h:mm a')}
                                        </p>
                                    </div>

                                    {ticket.tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {ticket.tags.map((tag) => (
                                                <Badge key={tag} variant="outline" className="text-[10px]">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}

                                    <ContactLinks ticket={ticket} onOpenTicket={handleSelect} />
                                </aside>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-1 items-center justify-center">
                        <p className="text-sm text-muted-foreground">Ticket not found.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
