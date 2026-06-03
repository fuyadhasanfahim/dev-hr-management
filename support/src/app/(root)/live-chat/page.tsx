'use client';

import {
    useState,
    useEffect,
    useRef,
    useCallback,
    type KeyboardEvent,
    type ChangeEvent,
} from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import {
    Send,
    UserCheck,
    X,
    Ticket,
    MessageSquare,
    Loader2,
    CheckCheck,
    Clock,
    Paperclip,
    Download,
    CalendarIcon,
    UserPlus,
    Volume2,
    VolumeX,
    FileText,
    Search,
    Circle,
    ChevronUp,
    ChevronDown,
    Video,
    ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import {
    useGetQueuedSessionsQuery,
    useGetActiveSessionsQuery,
    useClaimSessionMutation,
    useCloseSessionMutation,
    useConvertToTicketMutation,
    useGetUnreadCountsQuery,
    useRequestPresignedUrlMutation,
    useGetAvailableAgentsQuery,
    useReassignSessionMutation,
    useCreateMeetingMutation,
    useGetClientMeetingsQuery,
    type ChatSession,
    type ChatMessage,
    type AgentInfo,
    type Meeting,
} from '@/store/api/chatApi';
import { baseApi } from '@/store/api/baseApi';
import { connectSocket } from '@/lib/socket';
import { useNotificationSound } from '@/hooks/use-notification-sound';
import type { AppDispatch } from '@/store';
import { useSession } from '@/lib/auth-client';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString();
}

function formatClock(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getSessionUser(s: ChatSession): { name: string; email: string } {
    const u = s.clientId ?? s.guestId;
    return { name: u?.name ?? 'Unknown', email: u?.email ?? '' };
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

// ─── sub-components ──────────────────────────────────────────────────────────

function SessionSkeleton() {
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    );
}

interface SessionItemProps {
    session: ChatSession;
    isSelected: boolean;
    onSelect: () => void;
    unreadCount: number;
}

function SessionItem({
    session,
    isSelected,
    onSelect,
    unreadCount,
}: SessionItemProps) {
    const user = getSessionUser(session);
    const initial = user.name.trim().charAt(0).toUpperCase() || '?';
    const isQueued = session.status === 'queued';

    return (
        <button
            onClick={onSelect}
            className={cn(
                'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all',
                'hover:bg-accent/50',
                isSelected && 'bg-accent border-l-2 border-l-primary',
                !isSelected && 'border-l-2 border-l-transparent',
            )}
        >
            <div className="relative">
                <Avatar className="size-10 shrink-0">
                    <AvatarFallback
                        className={cn(
                            'text-sm font-semibold',
                            isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-primary/10 text-primary',
                        )}
                    >
                        {initial}
                    </AvatarFallback>
                </Avatar>
                {session.status === 'active' && (
                    <Circle className="absolute -bottom-0.5 -right-0.5 size-3 fill-emerald-500 text-background stroke-[3]" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span
                        className={cn(
                            'text-sm truncate',
                            unreadCount > 0 ? 'font-semibold' : 'font-medium',
                        )}
                    >
                        {user.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(session.updatedAt)}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <p
                        className={cn(
                            'text-xs truncate',
                            unreadCount > 0
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground',
                        )}
                    >
                        {session.lastMessage?.content || 'No messages yet'}
                    </p>
                    {unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shrink-0">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {isQueued && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        <Clock className="size-2.5" />
                        Waiting in queue
                    </span>
                )}
            </div>
        </button>
    );
}

function AttachmentPreview({ url }: { url: string }) {
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

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    isFirstInGroup: boolean;
}

function MessageBubble({ message, isOwn, isFirstInGroup }: MessageBubbleProps) {
    const isSystem = message.senderModel === 'System';
    if (isSystem) {
        return (
            <div className="flex justify-center my-3">
                <span className="text-xs text-muted-foreground bg-muted/80 px-4 py-1.5 rounded-full border border-border/30 shadow-sm">
                    {message.content}
                </span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'flex items-end gap-2.5',
                isOwn ? 'flex-row-reverse' : 'flex-row',
                // Tight stacking for grouped messages, breathing room for new groups.
                isFirstInGroup ? 'mt-3' : 'mt-0.5',
            )}
        >
            {!isOwn &&
                (isFirstInGroup ? (
                    <Avatar className="size-7 shrink-0 mb-5">
                        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-medium">
                            {message.senderName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                ) : (
                    // Spacer keeps grouped bubbles aligned under the avatar.
                    <div className="size-7 shrink-0" aria-hidden />
                ))}
            <div
                className={cn(
                    'max-w-[70%] space-y-1',
                    isOwn ? 'items-end' : 'items-start',
                )}
            >
                {!isOwn && isFirstInGroup && (
                    <p className="text-[11px] text-muted-foreground px-1 font-medium">
                        {message.senderName}
                    </p>
                )}
                <div
                    className={cn(
                        'px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm',
                        isOwn
                            ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                            : 'bg-muted text-foreground rounded-2xl rounded-bl-md',
                    )}
                >
                    {message.content}
                    {message.attachments?.length > 0 && (
                        <div className="space-y-1.5">
                            {message.attachments.map((url, i) => (
                                <AttachmentPreview key={i} url={url} />
                            ))}
                        </div>
                    )}
                </div>
                <p
                    className={cn(
                        'text-[10px] text-muted-foreground px-1',
                        isOwn && 'text-right',
                    )}
                >
                    {formatClock(message.createdAt)}
                </p>
            </div>
        </div>
    );
}

function TypingIndicator({ names }: { names: string[] }) {
    if (names.length === 0) return null;
    const label =
        names.length === 1
            ? `${names[0]} is typing`
            : 'Several people are typing';
    return (
        <div className="flex items-center gap-2.5 px-4 py-2">
            <div className="flex gap-1 items-center">
                <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-muted-foreground italic">{label}</span>
        </div>
    );
}

// ─── time spinner ────────────────────────────────────────────────────────────

function TimeSpinner({
    value,
    onChange,
    min,
    max,
    label,
    pad = 2,
}: {
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    label: string;
    pad?: number;
}) {
    const increment = () => onChange(value >= max ? min : value + 1);
    const decrement = () => onChange(value <= min ? max : value - 1);

    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                {label}
            </span>
            <div className="flex flex-col items-center">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={increment}
                >
                    <ChevronUp className="size-4" />
                </Button>
                <Input
                    type="text"
                    inputMode="numeric"
                    value={String(value).padStart(pad, '0')}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n) && n >= min && n <= max) onChange(n);
                    }}
                    className="w-14 h-10 text-center text-lg font-semibold tabular-nums"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={decrement}
                >
                    <ChevronDown className="size-4" />
                </Button>
            </div>
        </div>
    );
}

function AmPmToggle({
    value,
    onChange,
}: {
    value: 'AM' | 'PM';
    onChange: (v: 'AM' | 'PM') => void;
}) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                &nbsp;
            </span>
            <div className="flex flex-col gap-1 pt-1.5">
                <Button
                    type="button"
                    variant={value === 'AM' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => onChange('AM')}
                >
                    AM
                </Button>
                <Button
                    type="button"
                    variant={value === 'PM' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => onChange('PM')}
                >
                    PM
                </Button>
            </div>
        </div>
    );
}

// ─── meeting dialog ──────────────────────────────────────────────────────────

function ScheduleMeetingDialog({
    open,
    onOpenChange,
    clientEmail,
    clientName,
    isLoading,
    onSchedule,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clientEmail: string;
    clientName: string;
    isLoading: boolean;
    onSchedule: (data: {
        meetingTitle: string;
        scheduledAt: string;
        durationMinutes: number;
        attendeeEmails: string[];
        description: string;
    }) => void;
}) {
    const [title, setTitle] = useState(`Support call with ${clientName}`);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(
        undefined,
    );
    const [hour, setHour] = useState(10);
    const [minute, setMinute] = useState(0);
    const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
    const [duration, setDuration] = useState('30');
    const [customDuration, setCustomDuration] = useState('');
    const [description, setDescription] = useState('');
    const [calendarOpen, setCalendarOpen] = useState(false);

    useEffect(() => {
        if (open) {
            setTitle(`Support call with ${clientName}`);
            setSelectedDate(undefined);
            setHour(10);
            setMinute(0);
            setAmpm('AM');
            setDuration('30');
            setCustomDuration('');
            setDescription('');
        }
    }, [open, clientName]);

    const effectiveDuration =
        duration === 'custom'
            ? parseInt(customDuration, 10) || 0
            : parseInt(duration, 10);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || effectiveDuration <= 0) return;

        let h24 = hour;
        if (ampm === 'PM' && hour !== 12) h24 = hour + 12;
        if (ampm === 'AM' && hour === 12) h24 = 0;

        const scheduledDate = new Date(selectedDate);
        scheduledDate.setHours(h24, minute, 0, 0);

        onSchedule({
            meetingTitle: title,
            scheduledAt: scheduledDate.toISOString(),
            durationMinutes: effectiveDuration,
            attendeeEmails: clientEmail ? [clientEmail] : [],
            description,
        });
    };

    const canSubmit =
        !!selectedDate && effectiveDuration > 0 && title.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarIcon className="size-5 text-primary" />
                        Schedule Meeting
                    </DialogTitle>
                    <DialogDescription>
                        Create a meeting with {clientName}. A Google Meet link
                        will be generated automatically.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                            value={title}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setTitle(e.target.value)
                            }
                            required
                            placeholder="Meeting title"
                        />
                    </div>

                    {/* Date picker */}
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Popover
                            open={calendarOpen}
                            onOpenChange={setCalendarOpen}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                        'w-full justify-start text-left font-normal',
                                        !selectedDate && 'text-muted-foreground',
                                    )}
                                >
                                    <CalendarIcon className="size-4 mr-2" />
                                    {selectedDate
                                        ? format(selectedDate, 'PPP')
                                        : 'Pick a date'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(date) => {
                                        setSelectedDate(date ?? undefined);
                                        setCalendarOpen(false);
                                    }}
                                    disabled={(date) =>
                                        date < new Date(new Date().setHours(0, 0, 0, 0))
                                    }
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Time picker */}
                    <div className="space-y-2">
                        <Label>Time</Label>
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                            <TimeSpinner
                                label="Hour"
                                value={hour}
                                onChange={setHour}
                                min={1}
                                max={12}
                            />
                            <div className="flex flex-col items-center justify-center pt-7">
                                <span className="text-xl font-bold text-muted-foreground">
                                    :
                                </span>
                            </div>
                            <TimeSpinner
                                label="Min"
                                value={minute}
                                onChange={setMinute}
                                min={0}
                                max={59}
                            />
                            <AmPmToggle value={ampm} onChange={setAmpm} />
                        </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                        <Label>Duration</Label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="15">15 minutes</SelectItem>
                                <SelectItem value="30">30 minutes</SelectItem>
                                <SelectItem value="45">45 minutes</SelectItem>
                                <SelectItem value="60">1 hour</SelectItem>
                                <SelectItem value="90">1.5 hours</SelectItem>
                                <SelectItem value="120">2 hours</SelectItem>
                                <SelectItem value="custom">
                                    Custom duration
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {duration === 'custom' && (
                            <div className="flex items-center gap-2 pt-1">
                                <Input
                                    type="number"
                                    min={1}
                                    max={480}
                                    value={customDuration}
                                    onChange={(
                                        e: ChangeEvent<HTMLInputElement>,
                                    ) => setCustomDuration(e.target.value)}
                                    placeholder="Enter minutes"
                                    className="w-32"
                                    autoFocus
                                />
                                <span className="text-sm text-muted-foreground">
                                    minutes
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add any notes for the meeting..."
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || !canSubmit}
                            className="gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <CalendarIcon className="size-4" />
                            )}
                            {isLoading ? 'Creating...' : 'Create Meeting'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── reassign dialog ──────────────────────────────────────────────────────────

function ReassignDialog({
    open,
    onOpenChange,
    agents,
    isLoading,
    onReassign,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agents: AgentInfo[];
    isLoading: boolean;
    onReassign: (agentUserId: string) => void;
}) {
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (open) setSearch('');
    }, [open]);

    const filtered = agents.filter((a) =>
        (a.userId?.name || a.name || '')
            .toLowerCase()
            .includes(search.toLowerCase()),
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="size-5 text-primary" />
                        Reassign Chat
                    </DialogTitle>
                    <DialogDescription>
                        Transfer this conversation to another support agent.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search agents..."
                            value={search}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setSearch(e.target.value)
                            }
                            className="pl-9"
                            autoFocus
                        />
                    </div>
                    <ScrollArea className="max-h-[300px]">
                        <div className="space-y-1">
                            {filtered.map((agent) => (
                                <button
                                    key={agent._id}
                                    onClick={() =>
                                        onReassign(agent.userId?._id || '')
                                    }
                                    disabled={isLoading}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                                >
                                    <Avatar className="size-9">
                                        <AvatarImage
                                            src={agent.userId?.image}
                                        />
                                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                                            {(
                                                agent.userId?.name ||
                                                agent.name ||
                                                '?'
                                            )
                                                .charAt(0)
                                                .toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {agent.userId?.name || agent.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {agent.userId?.email}
                                        </p>
                                    </div>
                                </button>
                            ))}
                            {filtered.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No agents found.
                                </p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── main page ──────────────────────────────────────────────────────────────

type TabType = 'queued' | 'active';

export default function LiveChatPage() {
    const dispatch = useDispatch<AppDispatch>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: authSession } = useSession();

    const chatParam = searchParams.get('chat');

    // RTK Query
    const { data: queuedSessions = [], isLoading: queuedLoading } =
        useGetQueuedSessionsQuery(undefined, { pollingInterval: 30_000 });
    const { data: activeSessions = [], isLoading: activeLoading } =
        useGetActiveSessionsQuery(undefined, { pollingInterval: 30_000 });
    const { data: serverUnreadCounts = {} } = useGetUnreadCountsQuery(
        undefined,
        { pollingInterval: 15_000 },
    );
    const [claimSession, { isLoading: isClaiming }] =
        useClaimSessionMutation();
    const [closeSession, { isLoading: isClosing }] =
        useCloseSessionMutation();
    const [convertToTicket, { isLoading: isConverting }] =
        useConvertToTicketMutation();
    const [requestPresignedUrl] = useRequestPresignedUrlMutation();
    const { data: availableAgents = [] } = useGetAvailableAgentsQuery();
    const [reassignSession, { isLoading: isReassigning }] =
        useReassignSessionMutation();
    const [createMeeting, { isLoading: isScheduling }] =
        useCreateMeetingMutation();

    // UI state
    const [tab, setTab] = useState<TabType>('queued');
    const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
        null,
    );
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [typingNames, setTypingNames] = useState<
        { id: string; name: string }[]
    >([]);
    const [inputValue, setInputValue] = useState('');
    const [sessionEnded, setSessionEnded] = useState(false);
    const [socketConnected, setSocketConnected] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
    const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const selectedClientId = selectedSession?.clientId?._id;
    const { data: clientMeetings = [] } = useGetClientMeetingsQuery(
        selectedClientId!,
        { skip: !selectedClientId },
    );

    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingExpiryTimers = useRef<
        Map<string, ReturnType<typeof setTimeout>>
    >(new Map());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectedSessionRef = useRef<ChatSession | null>(null);

    const { playSound, enabled: soundEnabled, toggleSound, isPageVisible } =
        useNotificationSound();

    const currentUserId = authSession?.user?.id ?? '';

    useEffect(() => {
        selectedSessionRef.current = selectedSession;
    }, [selectedSession]);

    const unreadCounts = serverUnreadCounts;

    // ── URL param restore ────────────────────────────────────────────────────
    useEffect(() => {
        if (!chatParam) return;
        const allSessions = [...queuedSessions, ...activeSessions];
        const match = allSessions.find((s) => s.sessionId === chatParam);
        if (match && selectedSession?.sessionId !== chatParam) {
            setSelectedSession(match);
            if (match.status === 'active') setTab('active');
            else if (match.status === 'queued') setTab('queued');
        }
    }, [chatParam, queuedSessions, activeSessions, selectedSession?.sessionId]);

    // ── socket bootstrap ──────────────────────────────────────────────────────
    useEffect(() => {
        const socket = connectSocket();
        socketRef.current = socket;

        const onConnect = () => {
            setSocketConnected(true);
            socket.emit('agent:register_presence');
        };

        const onDisconnect = () => setSocketConnected(false);

        const onQueueUpdate = () => {
            dispatch(baseApi.util.invalidateTags(['QueuedSessions']));
        };

        // A brand-new session was created (visitor escalated via REST). Refresh
        // the queue immediately so it appears without waiting for the poll.
        const onSessionCreated = () => {
            dispatch(baseApi.util.invalidateTags(['QueuedSessions']));
        };

        // State changed (claimed / closed / reassigned). Invalidate BOTH lists so
        // a claimed session leaves the queue and enters active live.
        const onSessionStateChange = () => {
            dispatch(
                baseApi.util.invalidateTags([
                    'QueuedSessions',
                    'ActiveSessions',
                    'UnreadCounts',
                ]),
            );
        };

        // Live sidebar update: a message landed on some session. Refresh the
        // lists (last-message preview + time) and unread badges immediately.
        const onSessionNewMessage = ({ sessionId }: { sessionId?: string }) => {
            const tags: ('QueuedSessions' | 'ActiveSessions' | 'UnreadCounts')[] = [
                'QueuedSessions',
                'ActiveSessions',
            ];
            // The session the agent is actively viewing is marked read via
            // `chat:seen`, so skip the unread refetch here to avoid a phantom
            // badge flicker; let the seen-receipt path settle it to zero.
            if (sessionId !== selectedSessionRef.current?.sessionId) {
                tags.push('UnreadCounts');
            }
            dispatch(baseApi.util.invalidateTags(tags));
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('queue:new_message', onQueueUpdate);
        socket.on('session:created', onSessionCreated);
        socket.on('session:state_change', onSessionStateChange);
        socket.on('session:new_message', onSessionNewMessage);

        if (socket.connected) onConnect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('queue:new_message', onQueueUpdate);
            socket.off('session:created', onSessionCreated);
            socket.off('session:state_change', onSessionStateChange);
            socket.off('session:new_message', onSessionNewMessage);
        };
    }, [dispatch]);

    // ── join / leave session room ─────────────────────────────────────────────
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket || !selectedSession) return;

        setMessages([]);
        setTypingNames([]);
        typingExpiryTimers.current.forEach((t) => clearTimeout(t));
        typingExpiryTimers.current.clear();
        setSessionEnded(
            selectedSession.status === 'ended' ||
                selectedSession.status === 'converted_to_ticket',
        );

        socket.emit('chat:join', { sessionId: selectedSession.sessionId });

        const onJoined = ({ messages: msgs }: { messages: ChatMessage[] }) => {
            setMessages(msgs ?? []);
            // mark all messages as read
            socket.emit('chat:seen', {
                sessionId: selectedSession.sessionId,
            });
            // invalidate unread counts so sidebar updates
            dispatch(baseApi.util.invalidateTags(['UnreadCounts']));
        };

        const onMessage = (msg: ChatMessage) => {
            setMessages((prev) => {
                if (prev.some((m) => m._id === msg._id)) return prev;
                return [...prev, msg];
            });

            if (msg.sender !== currentUserId) {
                const currentSelected = selectedSessionRef.current;
                if (
                    currentSelected &&
                    msg.sessionId === currentSelected._id
                ) {
                    socket.emit('chat:seen', {
                        sessionId: currentSelected.sessionId,
                    });
                    dispatch(
                        baseApi.util.invalidateTags(['UnreadCounts']),
                    );
                }

                if (!isPageVisible.current) {
                    playSound();
                }
            }
        };

        const onTyping = ({
            userId,
            userName,
            isTyping,
        }: {
            userId: string;
            userName: string;
            isTyping: boolean;
        }) => {
            if (isTyping) {
                const existing = typingExpiryTimers.current.get(userId);
                if (existing) clearTimeout(existing);

                const timer = setTimeout(() => {
                    setTypingNames((prev) =>
                        prev.filter((u) => u.id !== userId),
                    );
                    typingExpiryTimers.current.delete(userId);
                }, 3000);
                typingExpiryTimers.current.set(userId, timer);

                setTypingNames((prev) =>
                    prev.some((u) => u.id === userId)
                        ? prev
                        : [...prev, { id: userId, name: userName }],
                );
            } else {
                const timer = typingExpiryTimers.current.get(userId);
                if (timer) clearTimeout(timer);
                typingExpiryTimers.current.delete(userId);
                setTypingNames((prev) =>
                    prev.filter((u) => u.id !== userId),
                );
            }
        };

        const onClosed = () => {
            setSessionEnded(true);
            dispatch(
                baseApi.util.invalidateTags([
                    'ActiveSessions',
                    'QueuedSessions',
                ]),
            );
        };

        socket.on('chat:joined', onJoined);
        socket.on('chat:message', onMessage);
        socket.on('chat:typing', onTyping);
        socket.on('chat:closed', onClosed);

        return () => {
            socket.off('chat:joined', onJoined);
            socket.off('chat:message', onMessage);
            socket.off('chat:typing', onTyping);
            socket.off('chat:closed', onClosed);
            typingExpiryTimers.current.forEach((t) => clearTimeout(t));
            typingExpiryTimers.current.clear();
        };
    }, [selectedSession?.sessionId, dispatch, currentUserId, playSound, isPageVisible]);

    // ── auto-scroll ───────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── handlers ──────────────────────────────────────────────────────────────
    const handleSelectSession = useCallback(
        (session: ChatSession) => {
            setSelectedSession(session);
            setMeetingDialogOpen(false);
            setReassignDialogOpen(false);
            const params = new URLSearchParams(searchParams.toString());
            params.set('chat', session.sessionId);
            router.replace(`?${params.toString()}`, { scroll: false });
        },
        [router, searchParams],
    );

    const handleClaim = useCallback(
        async (session: ChatSession) => {
            const result = await claimSession(session.sessionId);
            if ('data' in result && result.data) {
                // Announce the claim so the visitor sees "agent has joined" and
                // every agent's sidebar moves the session queued → active.
                socketRef.current?.emit('chat:claim', {
                    sessionId: session.sessionId,
                });
                setSelectedSession(result.data);
                setTab('active');
                const params = new URLSearchParams(searchParams.toString());
                params.set('chat', session.sessionId);
                router.replace(`?${params.toString()}`, { scroll: false });
            }
        },
        [claimSession, router, searchParams],
    );

    const handleClose = useCallback(async () => {
        if (!selectedSession) return;
        await closeSession(selectedSession.sessionId);
        setSessionEnded(true);
        router.replace('/live-chat', { scroll: false });
    }, [selectedSession, closeSession, router]);

    const handleConvert = useCallback(async () => {
        if (!selectedSession) return;
        const result = await convertToTicket({
            sessionId: selectedSession.sessionId,
        });
        if ('data' in result) {
            setSessionEnded(true);
            router.replace('/live-chat', { scroll: false });
        }
    }, [selectedSession, convertToTicket, router]);

    const emitTyping = useCallback(
        (isTyping: boolean) => {
            if (!selectedSession || !socketRef.current) return;
            socketRef.current.emit('chat:typing', {
                sessionId: selectedSession.sessionId,
                isTyping,
            });
        },
        [selectedSession],
    );

    const handleInputChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setInputValue(e.target.value);
            if (!selectedSession) return;
            emitTyping(true);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => emitTyping(false), 2000);
        },
        [selectedSession, emitTyping],
    );

    const sendMessage = useCallback(
        (text?: string, attachments?: string[]) => {
            const messageText = text ?? inputValue.trim();
            if (
                !messageText &&
                (!attachments || attachments.length === 0)
            )
                return;
            if (!selectedSession || !socketRef.current || sessionEnded) return;

            setIsSending(true);
            socketRef.current.emit(
                'chat:message',
                {
                    sessionId: selectedSession.sessionId,
                    text: messageText,
                    attachments: attachments || [],
                },
                () => setIsSending(false),
            );
            if (!text) setInputValue('');
            emitTyping(false);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            setTimeout(() => setIsSending(false), 500);
            // Sending a message means we've seen everything
            dispatch(baseApi.util.invalidateTags(['UnreadCounts']));
        },
        [inputValue, selectedSession, sessionEnded, emitTyping, dispatch],
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        },
        [sendMessage],
    );

    const handleFileUpload = useCallback(
        async (e: ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (!files?.length || !selectedSession) return;

            setUploading(true);
            const uploadedUrls: string[] = [];

            for (const file of Array.from(files)) {
                try {
                    const result = await requestPresignedUrl({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        folder: 'chats',
                        referenceId: selectedSession.sessionId,
                    }).unwrap();

                    await fetch(result.uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': file.type },
                        body: file,
                    });

                    uploadedUrls.push(result.fileUrl);
                } catch {
                    // skip failed uploads
                }
            }

            if (uploadedUrls.length > 0) {
                sendMessage('', uploadedUrls);
            }

            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        [selectedSession, requestPresignedUrl, sendMessage],
    );

    const handleReassign = useCallback(
        async (agentUserId: string) => {
            if (!selectedSession) return;
            await reassignSession({
                sessionId: selectedSession.sessionId,
                agentId: agentUserId,
            });
            setReassignDialogOpen(false);
        },
        [selectedSession, reassignSession],
    );

    const handleScheduleMeeting = useCallback(
        async (data: {
            meetingTitle: string;
            scheduledAt: string;
            durationMinutes: number;
            attendeeEmails: string[];
            description: string;
        }) => {
            if (!selectedSession) return;
            await createMeeting({
                ...data,
                createdBy: currentUserId,
                clientId: selectedSession.clientId?._id,
            });
            setMeetingDialogOpen(false);
            sendMessage(
                `Meeting scheduled: ${data.meetingTitle} on ${new Date(data.scheduledAt).toLocaleString()}`,
            );
        },
        [selectedSession, createMeeting, currentUserId, sendMessage],
    );

    // ── render helpers ────────────────────────────────────────────────────────
    const sessionUser = selectedSession
        ? getSessionUser(selectedSession)
        : null;
    const canSend =
        selectedSession?.status === 'active' && !sessionEnded && socketConnected;
    const canClaim = selectedSession?.status === 'queued';

    const tabSessions = tab === 'queued' ? queuedSessions : activeSessions;
    const tabLoading = tab === 'queued' ? queuedLoading : activeLoading;

    const filteredSessions = searchQuery
        ? tabSessions.filter((s) => {
              const user = getSessionUser(s);
              return (
                  user.name
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                  user.email
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
              );
          })
        : tabSessions;

    return (
        <div className="flex h-full overflow-hidden bg-background">
            {/* ── Session list ──────────────────────────────────────────────── */}
            <aside className="w-[320px] shrink-0 flex flex-col border-r overflow-hidden">
                {/* Header */}
                <div className="px-4 pt-4 pb-3 space-y-3">
                    <h1 className="text-lg font-semibold">Live Chat</h1>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setSearchQuery(e.target.value)
                            }
                            className="pl-9 h-9"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-4 pb-2">
                    <Tabs
                        value={tab}
                        onValueChange={(v) => setTab(v as TabType)}
                    >
                        <TabsList className="w-full">
                            <TabsTrigger value="queued" className="flex-1 gap-1.5">
                                Queued
                                {queuedSessions.length > 0 && (
                                    <Badge
                                        variant="destructive"
                                        className="h-5 min-w-5 px-1.5 text-[10px]"
                                    >
                                        {queuedSessions.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="active"
                                className="flex-1 gap-1.5"
                            >
                                Active
                                {activeSessions.length > 0 && (
                                    <Badge
                                        variant="secondary"
                                        className="h-5 min-w-5 px-1.5 text-[10px]"
                                    >
                                        {activeSessions.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* List */}
                <ScrollArea className="flex-1">
                    {tabLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <SessionSkeleton key={i} />
                        ))
                    ) : filteredSessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                            <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                                <MessageSquare className="size-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium">
                                No {tab} sessions
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {tab === 'queued'
                                    ? 'No clients are waiting right now.'
                                    : 'No active chats at the moment.'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {filteredSessions.map((s) => (
                                <SessionItem
                                    key={s._id}
                                    session={s}
                                    isSelected={
                                        selectedSession?._id === s._id
                                    }
                                    onSelect={() => handleSelectSession(s)}
                                    unreadCount={
                                        unreadCounts[s.sessionId] ?? 0
                                    }
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* Socket status + Sound toggle */}
                <Separator />
                <div className="px-4 py-2.5 flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                'size-2 rounded-full',
                                socketConnected
                                    ? 'bg-emerald-500'
                                    : 'bg-muted-foreground animate-pulse',
                            )}
                        />
                        <span className="text-xs text-muted-foreground">
                            {socketConnected ? 'Connected' : 'Connecting...'}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={toggleSound}
                        title={
                            soundEnabled
                                ? 'Mute notifications'
                                : 'Unmute notifications'
                        }
                    >
                        {soundEnabled ? (
                            <Volume2 className="size-3.5" />
                        ) : (
                            <VolumeX className="size-3.5" />
                        )}
                    </Button>
                </div>
            </aside>

            {/* ── Chat window ───────────────────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
                {!selectedSession ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
                        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
                            <MessageSquare className="size-7 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-base font-medium">
                                Select a conversation
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Choose a session from the list to start
                                chatting.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="shrink-0 border-b bg-background">
                            {/* Top row: user info + actions */}
                            <div className="flex items-center justify-between px-5 h-14 gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative">
                                        <Avatar className="size-10 shrink-0">
                                            <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                                                {sessionUser?.name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        {selectedSession.status ===
                                            'active' && (
                                            <Circle className="absolute -bottom-0.5 -right-0.5 size-3 fill-emerald-500 text-background stroke-[3]" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold truncate">
                                                {sessionUser?.name}
                                            </p>
                                            <Badge
                                                variant={
                                                    selectedSession.status ===
                                                    'active'
                                                        ? 'default'
                                                        : selectedSession.status ===
                                                            'queued'
                                                          ? 'secondary'
                                                          : 'outline'
                                                }
                                                className="text-[10px] px-2 py-0 h-5"
                                            >
                                                {selectedSession.status ===
                                                'converted_to_ticket'
                                                    ? 'Converted'
                                                    : selectedSession.status}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {sessionUser?.email}
                                        </p>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {canClaim && (
                                        <Button
                                            size="sm"
                                            onClick={() =>
                                                handleClaim(selectedSession)
                                            }
                                            disabled={isClaiming}
                                            className="gap-1.5"
                                        >
                                            {isClaiming ? (
                                                <Loader2 className="size-3.5 animate-spin" />
                                            ) : (
                                                <UserCheck className="size-3.5" />
                                            )}
                                            Claim
                                        </Button>
                                    )}
                                    {selectedSession.status === 'active' &&
                                        !sessionEnded && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setMeetingDialogOpen(
                                                            true,
                                                        )
                                                    }
                                                    className="gap-1.5"
                                                >
                                                    <CalendarIcon className="size-3.5" />
                                                    Meeting
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setReassignDialogOpen(
                                                            true,
                                                        )
                                                    }
                                                    className="gap-1.5"
                                                >
                                                    <UserPlus className="size-3.5" />
                                                    Reassign
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleConvert}
                                                    disabled={isConverting}
                                                    className="gap-1.5"
                                                >
                                                    {isConverting ? (
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <Ticket className="size-3.5" />
                                                    )}
                                                    To Ticket
                                                </Button>
                                                <Separator
                                                    orientation="vertical"
                                                    className="h-6"
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={handleClose}
                                                    disabled={isClosing}
                                                    className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    {isClosing ? (
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <X className="size-3.5" />
                                                    )}
                                                    Close
                                                </Button>
                                            </>
                                        )}
                                </div>
                            </div>

                            {/* Scheduled meetings strip */}
                            {clientMeetings.length > 0 && (
                                <div className="px-5 py-2 border-t border-border/50 bg-muted/30">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                                            <CalendarIcon className="size-3.5" />
                                            <span className="font-medium">
                                                Upcoming:
                                            </span>
                                        </div>
                                        {clientMeetings.map((meeting) => (
                                            <div
                                                key={meeting._id}
                                                className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs shadow-sm"
                                            >
                                                <Video className="size-3.5 text-primary shrink-0" />
                                                <span className="font-medium truncate max-w-[180px]">
                                                    {meeting.meetingTitle}
                                                </span>
                                                <Separator
                                                    orientation="vertical"
                                                    className="h-3"
                                                />
                                                <span className="text-muted-foreground whitespace-nowrap">
                                                    {format(
                                                        new Date(
                                                            meeting.scheduledAt,
                                                        ),
                                                        'MMM d, h:mm a',
                                                    )}
                                                </span>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[9px] px-1.5 py-0 h-4"
                                                >
                                                    {meeting.durationMinutes}m
                                                </Badge>
                                                {meeting.googleMeetLink && (
                                                    <a
                                                        href={
                                                            meeting.googleMeetLink
                                                        }
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:text-primary/80 transition-colors"
                                                        title="Join Google Meet"
                                                    >
                                                        <ExternalLink className="size-3" />
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <div className="px-5 py-5">
                                {messages.length === 0 && (
                                    <div className="flex justify-center py-12">
                                        <p className="text-sm text-muted-foreground">
                                            No messages yet. Start the
                                            conversation!
                                        </p>
                                    </div>
                                )}
                                {messages.map((msg, i) => {
                                    const prev = i > 0 ? messages[i - 1] : null;
                                    // Start a new group when the sender changes,
                                    // across a system boundary, or after a >60s gap.
                                    const isFirstInGroup =
                                        !prev ||
                                        prev.senderModel === 'System' ||
                                        msg.senderModel === 'System' ||
                                        prev.sender !== msg.sender ||
                                        new Date(msg.createdAt).getTime() -
                                            new Date(prev.createdAt).getTime() >
                                            60_000;
                                    return (
                                        <MessageBubble
                                            key={msg._id}
                                            message={msg}
                                            isOwn={msg.sender === currentUserId}
                                            isFirstInGroup={isFirstInGroup}
                                        />
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Typing indicator */}
                        <TypingIndicator
                            names={typingNames.map((u) => u.name)}
                        />

                        {/* Session ended banner */}
                        {sessionEnded && (
                            <div className="px-5 py-3 bg-muted/50 border-t text-center">
                                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                                    <CheckCheck className="size-4" />
                                    {selectedSession.status ===
                                    'converted_to_ticket'
                                        ? 'This chat was converted to a ticket.'
                                        : 'This chat session has ended.'}
                                </p>
                            </div>
                        )}

                        {/* Input */}
                        {!sessionEnded && (
                            <div className="px-5 py-4 border-t shrink-0 bg-background">
                                {canClaim ? (
                                    <div className="flex items-center justify-center py-2">
                                        <p className="text-sm text-muted-foreground">
                                            Claim this session to start
                                            chatting.
                                        </p>
                                    </div>
                                ) : (
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
                                            disabled={!canSend || uploading}
                                        >
                                            {uploading ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Paperclip className="size-4" />
                                            )}
                                        </Button>
                                        <Input
                                            type="text"
                                            value={inputValue}
                                            onChange={handleInputChange}
                                            onKeyDown={handleKeyDown}
                                            placeholder={
                                                canSend
                                                    ? 'Type a message...'
                                                    : !socketConnected
                                                      ? 'Connecting...'
                                                      : 'Cannot send messages'
                                            }
                                            disabled={!canSend}
                                            className="flex-1"
                                        />
                                        <Button
                                            size="icon"
                                            onClick={() => sendMessage()}
                                            disabled={
                                                !canSend ||
                                                !inputValue.trim() ||
                                                isSending
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
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Dialogs ──────────────────────────────────────────────────── */}
            {sessionUser && (
                <ScheduleMeetingDialog
                    open={meetingDialogOpen}
                    onOpenChange={setMeetingDialogOpen}
                    clientEmail={sessionUser.email}
                    clientName={sessionUser.name}
                    isLoading={isScheduling}
                    onSchedule={handleScheduleMeeting}
                />
            )}

            <ReassignDialog
                open={reassignDialogOpen}
                onOpenChange={setReassignDialogOpen}
                agents={availableAgents}
                isLoading={isReassigning}
                onReassign={handleReassign}
            />
        </div>
    );
}
