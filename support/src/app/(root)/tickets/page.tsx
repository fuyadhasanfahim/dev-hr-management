'use client';

import {
    useState,
    useCallback,
    useRef,
    useEffect,
    type ChangeEvent,
    type KeyboardEvent,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Ticket as TicketIcon,
    Search,
    Loader2,
    Send,
    Paperclip,
    Download,
    FileText,
    Clock,
    CheckCircle2,
    Circle,
    AlertCircle,
    Inbox,
    UserCheck,
    Mail,
    Tag,
    CornerUpLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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
    type Ticket,
    type TicketReply,
    type TicketStatus,
    type TicketPriority,
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

const STATUS_FILTERS: { value: TicketStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'Active' },
    { value: 'pending_client', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function getTicketUser(t: Ticket): { name: string; email: string } {
    const u = t.clientId ?? t.guestId;
    return { name: u?.name ?? 'Unknown', email: u?.email ?? '' };
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

function isImageUrl(url: string): boolean {
    return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

function getFileName(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        return decodeURIComponent(pathname.split('/').pop() || 'file');
    } catch {
        return 'file';
    }
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
            <Icon className="size-2.5" />
            {cfg.label}
        </span>
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

function TicketSkeleton() {
    return (
        <div className="flex flex-col gap-2 px-4 py-3.5">
            <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-12 rounded-full" />
            </div>
        </div>
    );
}

function TicketListItem({
    ticket,
    isSelected,
    onSelect,
}: {
    ticket: Ticket;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const user = getTicketUser(ticket);
    return (
        <button
            onClick={onSelect}
            className={cn(
                'w-full flex flex-col gap-1.5 px-4 py-3.5 text-left transition-all border-l-2',
                isSelected
                    ? 'bg-accent border-l-primary'
                    : 'border-l-transparent hover:bg-accent/50',
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">
                    {ticket.subject}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelative(ticket.updatedAt)}
                </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                    {ticket.ticketId}
                </span>
                <span className="truncate">{user.name}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
            </div>
        </button>
    );
}

function AttachmentChip({ url }: { url: string }) {
    if (isImageUrl(url)) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2"
            >
                <img
                    src={url}
                    alt="Attachment"
                    className="max-w-[220px] max-h-[160px] rounded-lg object-cover border border-border/40 shadow-sm"
                    loading="lazy"
                />
            </a>
        );
    }
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-background/60 border border-border/40 hover:bg-accent/50 transition-colors max-w-[220px]"
        >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs truncate flex-1">{getFileName(url)}</span>
            <Download className="size-3 shrink-0 text-muted-foreground" />
        </a>
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
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-medium">
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
                    {content}
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

    const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>(
        'all',
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [replyValue, setReplyValue] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const threadEndRef = useRef<HTMLDivElement>(null);

    const { data: tickets = [], isLoading: ticketsLoading } = useGetTicketsQuery(
        statusFilter === 'all' ? undefined : { status: statusFilter },
        { pollingInterval: 30_000 },
    );
    const { data: ticket, isFetching: detailLoading } = useGetTicketDetailQuery(
        selectedId!,
        { skip: !selectedId },
    );
    const { data: agents = [] } = useGetAvailableAgentsQuery();
    const [replyToTicket, { isLoading: isSending }] = useReplyToTicketMutation();
    const [updateStatus, { isLoading: isUpdatingStatus }] =
        useUpdateTicketStatusMutation();
    const [updateTicket, { isLoading: isUpdating }] = useUpdateTicketMutation();
    const [assignToSelf, { isLoading: isAssigning }] =
        useAssignTicketToSelfMutation();
    const [requestPresignedUrl] = useRequestPresignedUrlMutation();

    // auto-scroll thread to bottom
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

    const sendReply = useCallback(
        async (text?: string, attachments?: string[]) => {
            if (!ticket) return;
            const body = text ?? replyValue.trim();
            if (!body && (!attachments || attachments.length === 0)) return;
            await replyToTicket({
                id: ticket._id,
                text: body || '(attachment)',
                attachments,
            });
            if (!text) setReplyValue('');
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
                    await fetch(result.uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': file.type },
                        body: file,
                    });
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
              const q = searchQuery.toLowerCase();
              return (
                  t.subject.toLowerCase().includes(q) ||
                  t.ticketId.toLowerCase().includes(q) ||
                  user.name.toLowerCase().includes(q) ||
                  user.email.toLowerCase().includes(q)
              );
          })
        : tickets;

    const ticketUser = ticket ? getTicketUser(ticket) : null;
    const isClosed = ticket?.status === 'closed';

    return (
        <div className="flex h-full overflow-hidden bg-background">
            {/* ── Ticket list ──────────────────────────────────────────────── */}
            <aside className="w-[360px] shrink-0 flex flex-col border-r overflow-hidden">
                <div className="px-4 pt-4 pb-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-semibold">Tickets</h1>
                        <Badge variant="secondary" className="text-xs">
                            {tickets.length}
                        </Badge>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search tickets..."
                            value={searchQuery}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setSearchQuery(e.target.value)
                            }
                            className="pl-9 h-9"
                        />
                    </div>
                </div>

                <div className="px-4 pb-2">
                    <Tabs
                        value={statusFilter}
                        onValueChange={(v) =>
                            setStatusFilter(v as TicketStatus | 'all')
                        }
                    >
                        <TabsList className="w-full h-auto flex-wrap gap-1 bg-transparent p-0">
                            {STATUS_FILTERS.map((f) => (
                                <TabsTrigger
                                    key={f.value}
                                    value={f.value}
                                    className="flex-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border rounded-md"
                                >
                                    {f.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>

                <ScrollArea className="flex-1">
                    {ticketsLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TicketSkeleton key={i} />
                        ))
                    ) : filteredTickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                            <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                <Inbox className="size-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium">No tickets</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {searchQuery
                                    ? 'No tickets match your search.'
                                    : 'No tickets in this view.'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {filteredTickets.map((t) => (
                                <TicketListItem
                                    key={t._id}
                                    ticket={t}
                                    isSelected={selectedId === t._id}
                                    onSelect={() => handleSelect(t._id)}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </aside>

            {/* ── Ticket detail ────────────────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
                {!selectedId ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
                        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                            <TicketIcon className="size-7 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-base font-medium">
                                Select a ticket
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Choose a ticket from the list to view its
                                conversation.
                            </p>
                        </div>
                    </div>
                ) : detailLoading && !ticket ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                ) : ticket ? (
                    <>
                        {/* Header */}
                        <div className="shrink-0 border-b bg-background">
                            <div className="flex items-start justify-between px-5 py-3 gap-3">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                            {ticket.ticketId}
                                        </span>
                                        <StatusBadge status={ticket.status} />
                                        <PriorityBadge
                                            priority={ticket.priority}
                                        />
                                    </div>
                                    <h2 className="text-base font-semibold truncate">
                                        {ticket.subject}
                                    </h2>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Avatar className="size-4">
                                                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                                                    {ticketUser?.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            {ticketUser?.name}
                                        </span>
                                        {ticketUser?.email && (
                                            <span className="flex items-center gap-1">
                                                <Mail className="size-3" />
                                                {ticketUser.email}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock className="size-3" />
                                            {formatRelative(ticket.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-2 px-5 py-2.5 border-t border-border/50 bg-muted/30 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Status
                                    </Label>
                                    <Select
                                        value={ticket.status}
                                        onValueChange={(v) =>
                                            updateStatus({
                                                id: ticket._id,
                                                status: v as TicketStatus,
                                            })
                                        }
                                        disabled={isUpdatingStatus}
                                    >
                                        <SelectTrigger className="h-8 w-[150px] text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(
                                                Object.keys(
                                                    STATUS_CONFIG,
                                                ) as TicketStatus[]
                                            ).map((s) => (
                                                <SelectItem key={s} value={s}>
                                                    {STATUS_CONFIG[s].label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Priority
                                    </Label>
                                    <Select
                                        value={ticket.priority}
                                        onValueChange={(v) =>
                                            updateTicket({
                                                id: ticket._id,
                                                priority: v as TicketPriority,
                                            })
                                        }
                                        disabled={isUpdating}
                                    >
                                        <SelectTrigger className="h-8 w-[110px] text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(
                                                Object.keys(
                                                    PRIORITY_CONFIG,
                                                ) as TicketPriority[]
                                            ).map((p) => (
                                                <SelectItem key={p} value={p}>
                                                    {PRIORITY_CONFIG[p].label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Assignee
                                    </Label>
                                    <Select
                                        value={ticket.assignedTo?._id ?? ''}
                                        onValueChange={(v) =>
                                            updateTicket({
                                                id: ticket._id,
                                                assignedTo: v,
                                            })
                                        }
                                        disabled={isUpdating}
                                    >
                                        <SelectTrigger className="h-8 w-[150px] text-xs">
                                            <SelectValue placeholder="Unassigned" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agents.map((a) => (
                                                <SelectItem
                                                    key={a._id}
                                                    value={a._id}
                                                >
                                                    {a.userId?.name || a.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Separator
                                    orientation="vertical"
                                    className="h-6"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5"
                                    onClick={() => assignToSelf(ticket._id)}
                                    disabled={isAssigning}
                                >
                                    {isAssigning ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <UserCheck className="size-3.5" />
                                    )}
                                    Assign to me
                                </Button>

                                {ticket.tags?.length > 0 && (
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        <Tag className="size-3 text-muted-foreground" />
                                        {ticket.tags.map((tag) => (
                                            <Badge
                                                key={tag}
                                                variant="outline"
                                                className="text-[10px]"
                                            >
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Conversation thread */}
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <div className="px-5 py-5 space-y-4">
                                {/* Original ticket body */}
                                <MessageBubble
                                    senderName={ticketUser?.name ?? 'Client'}
                                    content={ticket.text || ticket.subject}
                                    attachments={ticket.attachments ?? []}
                                    createdAt={ticket.createdAt}
                                    isStaff={false}
                                />

                                {ticket.replies.map((reply: TicketReply) => {
                                    const isStaff =
                                        reply.senderType === 'staff';
                                    const name =
                                        reply.senderId?.name ||
                                        reply.senderName ||
                                        (isStaff ? 'Support' : 'Client');
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
                            <div className="px-5 py-3 bg-muted/50 border-t text-center">
                                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                                    <AlertCircle className="size-4" />
                                    This ticket is closed. Reopen it to reply.
                                </p>
                            </div>
                        ) : (
                            <div className="px-5 py-4 border-t shrink-0 bg-background">
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
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Paperclip className="size-4" />
                                        )}
                                    </Button>
                                    <Input
                                        type="text"
                                        value={replyValue}
                                        onChange={(
                                            e: ChangeEvent<HTMLInputElement>,
                                        ) => setReplyValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Type your reply..."
                                        className="flex-1"
                                    />
                                    <Button
                                        size="icon"
                                        onClick={() => sendReply()}
                                        disabled={
                                            !replyValue.trim() || isSending
                                        }
                                        className="size-10 shrink-0 rounded-full"
                                    >
                                        {isSending ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Send className="size-4" />
                                        )}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1 px-1">
                                    <CornerUpLeft className="size-3" />
                                    Replying marks the ticket as “Pending
                                    Client”.
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-1 items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                            Ticket not found.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
