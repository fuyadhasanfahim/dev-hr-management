'use client';

import { useState, useMemo } from 'react';
import {
    useGetMeetingsQuery,
    useCancelMeetingMutation,
    useUpdateMeetingMutation,
    useDeleteMeetingMutation,
    type Meeting,
} from '@/redux/features/meeting/meetingApi';
import { useGetClientsQuery } from '@/redux/features/client/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    CalendarPlus,
    RefreshCw,
    Video,
    X,
    Search,
    ExternalLink,
    Clock,
    ChevronLeft,
    ChevronRight,
    Loader,
    Ban,
    Phone,
    Plus,
    Edit,
    Trash2,
    CheckCircle2,
    Filter,
} from 'lucide-react';
import {
    useCreateMeetingMutation,
    type CreateMeetingInput,
} from '@/redux/features/meeting/meetingApi';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateTimePicker } from '@/components/shared/DateTimePicker';
import { IconPlus, IconSearch, IconTrashOff, IconX } from '@tabler/icons-react';

// ─── Status Helpers ────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
    scheduled: {
        label: 'Scheduled',
        className: 'bg-blue-100/60 text-blue-800 border-blue-200/50',
    },
    completed: {
        label: 'Completed',
        className: 'bg-teal-100/60 text-teal-800 border-teal-200/50',
    },
    cancelled: {
        label: 'Cancelled',
        className: 'bg-red-100/60 text-red-800 border-red-200/50',
    },
};

const durationOptions = [
    { value: '15', label: '15 min' },
    { value: '30', label: '30 min' },
    { value: '45', label: '45 min' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
    { value: '120', label: '2 hours' },
];

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dhaka',
    });
}

function isUpcoming(dateStr: string) {
    return new Date(dateStr) > new Date();
}

// ─── Main Page ─────────────────────────────────────────────────

export default function MeetingsPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [search, setSearch] = useState('');
    const limit = 20;

    const { data, isLoading, isFetching, refetch } = useGetMeetingsQuery({
        page,
        limit,
        status: statusFilter || undefined,
        clientId: clientFilter || undefined,
    });

    const { data: allMeetingsData } = useGetMeetingsQuery({ limit: 1000 });
    const allMeetings = allMeetingsData?.data || [];

    const stats = useMemo(() => {
        return {
            total: allMeetings.length,
            active: allMeetings.filter(m => m.status === 'scheduled').length,
            done: allMeetings.filter(m => m.status === 'completed').length,
            missed: allMeetings.filter(m => m.status === 'cancelled').length,
        };
    }, [allMeetings]);

    const { data: clientsData } = useGetClientsQuery({ limit: 200 });
    const clients = clientsData?.clients || [];

    const meetings = data?.data || [];
    const meta = data?.meta || { page: 1, total: 0, totalPages: 1 };

    const filteredMeetings = useMemo(() => {
        if (!search) return meetings;
        const q = search.toLowerCase();
        return meetings.filter(
            (m) =>
                m.meetingTitle.toLowerCase().includes(q) ||
                (typeof m.clientId === 'object' &&
                    m.clientId.name.toLowerCase().includes(q)),
        );
    }, [meetings, search]);

    return (
        <div className="space-y-8 p-1">
            {/* Header & Stats Overview */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            Meetings Overview
                        </h2>
                        <p className="text-muted-foreground mt-1">
                            Track, manage, and schedule client meetings.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            className="bg-background border-border"
                            onClick={() => refetch()}
                            disabled={isFetching}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <ScheduleMeetingDialog clients={clients} />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Card */}
                    <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-slate-500/5 hover:border-slate-500/30">
                        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-slate-500/10 blur-2xl transition-all duration-300 group-hover:bg-slate-500/20" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-slate-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-slate-500/20">
                                    <Video className="h-5 w-5" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-medium opacity-70 group-hover:opacity-100">
                                    Total
                                </Badge>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold tracking-tight text-slate-600 dark:text-slate-300">
                                    {stats.total}
                                </h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-slate-500/10 font-medium">
                                Total Scheduled
                            </p>
                        </div>
                    </div>

                    {/* Active Card */}
                    <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-500/30">
                        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-blue-500/10 blur-2xl transition-all duration-300 group-hover:bg-blue-500/20" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/20">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-medium bg-blue-500/5 text-blue-500 border-blue-500/20 px-1.5 py-0 h-5">
                                    Active
                                </Badge>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                                    {stats.active}
                                </h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-blue-500/10 font-medium">
                                Upcoming Meetings
                            </p>
                        </div>
                    </div>

                    {/* Done Card */}
                    <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-green-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/5 hover:border-green-500/30">
                        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-green-500/10 blur-2xl transition-all duration-300 group-hover:bg-green-500/20" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-green-500/20">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-medium bg-green-500/5 text-green-500 border-green-500/20 px-1.5 py-0 h-5">
                                    Done
                                </Badge>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
                                    {stats.done}
                                </h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-green-500/10 font-medium">
                                Completed Meetings
                            </p>
                        </div>
                    </div>

                    {/* Missed Card */}
                    <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-red-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/5 hover:border-red-500/30">
                        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-red-500/10 blur-2xl transition-all duration-300 group-hover:bg-red-500/20" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-red-500/20">
                                    <Ban className="h-5 w-5" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-medium bg-red-500/5 text-red-500 border-red-500/20 px-1.5 py-0 h-5">
                                    Missed
                                </Badge>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold tracking-tight text-red-600 dark:text-red-400">
                                    {stats.missed}
                                </h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-red-500/10 font-medium">
                                Cancelled Meetings
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <Card className="border-border/60 shadow-md">
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                            <Video className="h-5 w-5 text-primary" />
                            Recent Meetings
                        </CardTitle>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Filters Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2">
                            <div className="bg-primary/10 p-2 rounded-full">
                                <Filter className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm font-medium">Filters:</span>
                        </div>

                        {/* Search field */}
                        <div className="relative flex-1 min-w-[200px]">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                            <Input
                                placeholder="Search meetings or clients..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 bg-background/60 h-9"
                            />
                        </div>

                        {/* Status Filter */}
                        <Select
                            value={statusFilter}
                            onValueChange={(val) => {
                                setStatusFilter(val === 'all' ? '' : val);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[140px] h-9 bg-background/60">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Client Filter */}
                        <Select
                            value={clientFilter}
                            onValueChange={(val) => {
                                setClientFilter(val === 'all' ? '' : val);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[160px] h-9 bg-background/60">
                                <SelectValue placeholder="All Clients" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {clients.map((c) => (
                                    <SelectItem key={c._id} value={c._id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-lg border border-border/50">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <RefreshCw className="h-8 w-8 animate-spin text-primary/40" />
                            </div>
                        ) : filteredMeetings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <Video className="h-12 w-12 mb-4 opacity-30" />
                                <p className="font-medium text-lg text-slate-900">No meetings found</p>
                                <p className="text-sm mt-1">Schedule your first meeting to get started</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
                                        <TableHead className="font-semibold text-muted-foreground h-11">Meeting</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground h-11">Client</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground h-11">Date & Time</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground h-11">Duration</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground h-11">Status</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground h-11">Google Meet</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground text-right h-11">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredMeetings.map((meeting) => (
                                        <MeetingRow key={meeting._id} meeting={meeting} clients={clients} />
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {/* Pagination */}
                    {meta.totalPages > 0 && (
                        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-slate-500">
                                Showing{' '}
                                <span className="font-medium text-slate-900">
                                    {filteredMeetings.length}
                                </span>{' '}
                                of{' '}
                                <span className="font-medium text-slate-900">
                                    {meta.total}
                                </span>{' '}
                                meetings
                            </div>
                            {meta.totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 bg-background border-border"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm font-medium px-3 text-foreground/80">
                                        {page} / {meta.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 bg-background border-border"
                                        disabled={page >= meta.totalPages}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Meeting Row ───────────────────────────────────────────────

function MeetingRow({ meeting, clients }: { meeting: Meeting; clients: any[] }) {
    const [cancelMeeting, { isLoading: isCancelling }] = useCancelMeetingMutation();
    const [updateMeeting, { isLoading: isUpdating }] = useUpdateMeetingMutation();
    const [deleteMeeting, { isLoading: isDeleting }] = useDeleteMeetingMutation();

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const client = typeof meeting.clientId === 'object' ? meeting.clientId : null;
    const config = statusConfig[meeting.status] || statusConfig.scheduled;
    const upcoming = isUpcoming(meeting.scheduledAt);

    // Form for edit
    const [form, setForm] = useState({
        meetingTitle: meeting.meetingTitle || '',
        description: meeting.description || '',
        scheduledAt: meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString() : '',
        durationMinutes: meeting.durationMinutes || 30,
        notes: meeting.notes || '',
        attendeeEmails: meeting.attendeeEmails || [],
    });
    const [extraEmail, setExtraEmail] = useState('');

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.meetingTitle || !form.scheduledAt) {
            toast.error('Please fill in all required fields');
            return;
        }
        try {
            await updateMeeting({
                id: meeting._id,
                data: {
                    ...form,
                    scheduledAt: new Date(form.scheduledAt).toISOString(),
                },
            }).unwrap();
            toast.success('Meeting updated successfully');
            setIsEditDialogOpen(false);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to update meeting');
        }
    };

    const handleDelete = async () => {
        try {
            await deleteMeeting(meeting._id).unwrap();
            toast.success('Meeting deleted successfully');
            setIsDeleteDialogOpen(false);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to delete meeting');
        }
    };

    const handleCancel = async () => {
        try {
            await cancelMeeting(meeting._id).unwrap();
            toast.success('Meeting cancelled successfully');
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to cancel meeting');
        }
    };

    const addExtraEmail = () => {
        if (extraEmail && /\S+@\S+\.\S+/.test(extraEmail)) {
            setForm((f) => ({
                ...f,
                attendeeEmails: [...(f.attendeeEmails || []), extraEmail],
            }));
            setExtraEmail('');
        }
    };

    const removeExtraEmail = (email: string) => {
        setForm((f) => ({
            ...f,
            attendeeEmails: (f.attendeeEmails || []).filter((e) => e !== email),
        }));
    };

    return (
        <TableRow className="group hover:bg-muted/30 transition-all duration-200 border-b border-border/60">
            <TableCell className="py-3.5">
                <div>
                    <p className="font-semibold text-sm text-foreground tracking-tight leading-normal">
                        {meeting.meetingTitle}
                    </p>
                    {meeting.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1 font-normal max-w-[260px]">
                            {meeting.description}
                        </p>
                    )}
                </div>
            </TableCell>
            <TableCell className="py-3.5">
                {client ? (
                    <div className="flex items-center gap-2">
                        <div>
                            <p className="text-sm font-semibold text-foreground">
                                {client.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-muted-foreground font-medium">
                                    {client.clientId}
                                </p>
                                {client.currency === 'BDT' && (
                                    <Badge
                                        variant="outline"
                                        className="h-4 px-1 text-[9px] font-bold text-orange-700 border-orange-300 bg-orange-50/60 flex items-center gap-0.5"
                                    >
                                        <Phone className="h-2.5 w-2.5" />
                                        SMS
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground font-medium">—</span>
                )}
            </TableCell>
            <TableCell className="py-3.5">
                <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-foreground/80 font-medium whitespace-nowrap">
                        {formatDate(meeting.scheduledAt)}
                    </span>
                </div>
            </TableCell>
            <TableCell className="py-3.5">
                <span className="text-sm text-foreground/80 font-semibold whitespace-nowrap">
                    {meeting.durationMinutes} min
                </span>
            </TableCell>
            <TableCell className="py-3.5">
                <Badge
                    variant="outline"
                    className={
                        config.className + ' text-[10px] font-bold uppercase tracking-wider h-5.5 flex items-center'
                    }
                >
                    {config.label}
                </Badge>
            </TableCell>
            <TableCell className="py-3.5">
                {meeting.googleMeetLink ? (
                    <a
                        href={meeting.googleMeetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline transition-all hover:scale-101"
                    >
                        <Video className="h-3.5 w-3.5" />
                        Join Meet
                        <ExternalLink className="h-3 w-3" />
                    </a>
                ) : (
                    <span className="text-xs text-muted-foreground font-medium select-none">No link</span>
                )}
            </TableCell>
            <TableCell className="py-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    {/* Edit button and Dialog */}
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-teal-600 hover:bg-teal-50"
                                title="Edit Meeting"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-lg bg-white overflow-hidden p-0 flex flex-col h-[95vh] gap-0">
                            <form onSubmit={handleEditSubmit} className="flex flex-col h-full gap-0">
                                <DialogHeader className="px-6 pt-5 pb-4 shrink-0 border-b border-slate-100">
                                    <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                                        <Edit className="h-5 w-5 text-teal-600" />
                                        Edit Meeting
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-500">
                                        Update the details of this meeting. Attendees will receive updated notifications.
                                    </DialogDescription>
                                </DialogHeader>

                                <ScrollArea className="flex-1 overflow-hidden">
                                    <div className="px-6 py-5 flex flex-col gap-5">
                                        {/* Title */}
                                        <div className="flex flex-col gap-2">
                                            <Label className="text-foreground/90 font-medium">
                                                Meeting Title{' '}
                                                <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                placeholder="e.g., Project Kickoff Call"
                                                value={form.meetingTitle}
                                                onChange={(e) =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        meetingTitle: e.target.value,
                                                    }))
                                                }
                                                className="bg-background border-border"
                                            />
                                        </div>

                                        {/* Date/Time + Duration */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <Label className="text-foreground/90 font-medium">
                                                    Select Date
                                                    <span className="text-red-500">*</span>
                                                </Label>
                                                <DateTimePicker
                                                    value={
                                                        form.scheduledAt
                                                            ? new Date(form.scheduledAt)
                                                            : undefined
                                                    }
                                                    onChange={(date) =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            scheduledAt: date
                                                                ? date.toISOString()
                                                                : '',
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Label className="text-foreground/90 font-medium">
                                                    Duration
                                                </Label>
                                                <Select
                                                    value={String(form.durationMinutes)}
                                                    onValueChange={(val) =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            durationMinutes: parseInt(val),
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger className="bg-background border-border w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {durationOptions.map((d) => (
                                                            <SelectItem
                                                                key={d.value}
                                                                value={d.value}
                                                            >
                                                                {d.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Extra Attendees */}
                                        <div className="flex flex-col gap-2">
                                            <Label className="text-foreground/90 font-medium">
                                                Additional Attendees
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="email"
                                                    placeholder="extra@email.com"
                                                    value={extraEmail}
                                                    onChange={(e) => setExtraEmail(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addExtraEmail();
                                                        }
                                                    }}
                                                    className="bg-background border-border"
                                                />
                                                <Button type="button" variant="outline" className="border-border bg-background" onClick={addExtraEmail}>
                                                    <IconPlus /> Add
                                                </Button>
                                            </div>
                                            {(form.attendeeEmails?.length ?? 0) > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {form.attendeeEmails?.map((email) => (
                                                        <Badge
                                                            key={email}
                                                            onClick={() => removeExtraEmail(email)}
                                                            variant="outline"
                                                            className="cursor-pointer hover:border-destructive hover:text-red-600 hover:bg-red-500/10 transition-colors duration-200"
                                                            title="Remove"
                                                        >
                                                            {email}
                                                            <IconX className="h-3.5 w-3.5 ml-1" />
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <div className="flex flex-col gap-2">
                                            <Label className="text-foreground/90 font-medium">
                                                Description
                                            </Label>
                                            <Textarea
                                                placeholder="Meeting agenda or notes..."
                                                value={form.description || ''}
                                                onChange={(e) =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        description: e.target.value,
                                                    }))
                                                }
                                                className="bg-background border-border min-h-[100px] resize-y"
                                            />
                                        </div>

                                        {/* Internal Notes */}
                                        <div className="flex flex-col gap-2">
                                            <Label className="text-foreground/90 font-medium">
                                                Internal Notes
                                            </Label>
                                            <Input
                                                placeholder="Internal notes (not shared with client)"
                                                value={form.notes || ''}
                                                onChange={(e) =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        notes: e.target.value,
                                                    }))
                                                }
                                                className="bg-background border-border"
                                            />
                                        </div>
                                    </div>
                                </ScrollArea>

                                <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsEditDialogOpen(false)}
                                        className="border-border bg-background"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isUpdating}
                                        className="bg-teal-600 hover:bg-teal-700 text-white min-w-[140px]"
                                    >
                                        {isUpdating ? (
                                            <Loader className="h-4 w-4 animate-spin" />
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Delete button and Dialog */}
                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                title="Delete Meeting"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                    <Ban className="h-5 w-5" />
                                    Delete Meeting
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete the meeting "{meeting.meetingTitle}"? This will cancel the Google Calendar event and notify attendees.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-slate-200 hover:bg-slate-100">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    {isDeleting ? <Loader className="h-4 w-4 animate-spin" /> : 'Delete'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Cancel meeting action */}
                    {meeting.status === 'scheduled' && upcoming && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={handleCancel}
                            disabled={isCancelling}
                            title="Cancel Meeting"
                        >
                            {isCancelling ? (
                                <Loader className="h-3 w-3 animate-spin" />
                            ) : (
                                <Ban className="h-4 w-4" />
                            )}
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}

// ─── Schedule Meeting Dialog ───────────────────────────────────

function ScheduleMeetingDialog({
    clients,
}: {
    clients: {
        _id: string;
        name: string;
        clientId: string;
        emails: string[];
    }[];
}) {
    const [open, setOpen] = useState(false);
    // Default to 1 hour from now, rounded to next 15 min
    const getDefaultDateTime = () => {
        const d = new Date(Date.now() + 60 * 60 * 1000);
        d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
        return d.toISOString();
    };

    const [createMeeting, { isLoading }] = useCreateMeetingMutation();

    const [form, setForm] = useState<CreateMeetingInput>({
        meetingTitle: '',
        description: '',
        scheduledAt: getDefaultDateTime(),
        durationMinutes: 30,
        clientId: '',
        attendeeEmails: [],
        notes: '',
    });
    const [extraEmail, setExtraEmail] = useState('');

    const selectedClient = clients.find((c) => c._id === form.clientId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.meetingTitle || !form.scheduledAt || !form.clientId) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const result = await createMeeting({
                ...form,
                scheduledAt: new Date(form.scheduledAt).toISOString(),
            }).unwrap();
            toast.success('Meeting scheduled successfully!');
            if (result.data?.googleMeetLink) {
                toast.info(`Meet link: ${result.data.googleMeetLink}`);
            }
            setOpen(false);
            resetForm();
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to schedule meeting');
        }
    };

    const resetForm = () => {
        setForm({
            meetingTitle: '',
            description: '',
            scheduledAt: getDefaultDateTime(),
            durationMinutes: 30,
            clientId: '',
            attendeeEmails: [],
            notes: '',
        });
        setExtraEmail('');
    };

    const addExtraEmail = () => {
        if (extraEmail && /\S+@\S+\.\S+/.test(extraEmail)) {
            setForm((f) => ({
                ...f,
                attendeeEmails: [...(f.attendeeEmails || []), extraEmail],
            }));
            setExtraEmail('');
        }
    };

    const removeExtraEmail = (email: string) => {
        setForm((f) => ({
            ...f,
            attendeeEmails: (f.attendeeEmails || []).filter((e) => e !== email),
        }));
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) resetForm();
            }}
        >
            <DialogTrigger asChild>
                <Button className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
                    <Plus className="h-4 w-4" />
                    Schedule Meeting
                </Button>
            </DialogTrigger>
            <DialogContent className="w-lg bg-background border-border overflow-hidden p-0 flex flex-col h-[95vh] gap-0">
                <form onSubmit={handleSubmit} className="flex flex-col h-full gap-0">
                    <DialogHeader className="px-6 pt-5 pb-4 shrink-0 border-b border-border">
                        <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-foreground">
                            <Video className="h-5 w-5 text-teal-600" />
                            Schedule New Meeting
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Create a meeting with Google Meet. Attendees will
                            receive an email invitation.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 overflow-hidden">
                        <div className="px-6 py-5 flex flex-col gap-5">
                            {/* Title */}
                            <div className="flex flex-col gap-2">
                                <Label className="text-slate-700 font-medium">
                                    Meeting Title{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    placeholder="e.g., Project Kickoff Call"
                                    value={form.meetingTitle}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            meetingTitle: e.target.value,
                                        }))
                                    }
                                    className="bg-white border-slate-200"
                                />
                            </div>

                            {/* Client */}
                            <div className="flex flex-col gap-2">
                                <Label className="text-slate-700 font-medium">
                                    Client{' '}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={form.clientId}
                                    onValueChange={(val) =>
                                        setForm((f) => ({
                                            ...f,
                                            clientId: val,
                                        }))
                                    }
                                >
                                    <SelectTrigger className="bg-white border-slate-200 w-full">
                                        <SelectValue placeholder="Select a client" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.map((c) => (
                                            <SelectItem
                                                key={c._id}
                                                value={c._id}
                                            >
                                                {c.name} ({c.clientId})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                    {selectedClient &&
                                        selectedClient.emails.map((email) => (
                                            <Badge
                                                key={email}
                                                variant="secondary"
                                                className="text-teal-600 border-teal-500/30 bg-teal-500/10"
                                            >
                                                {email}
                                            </Badge>
                                        ))}
                                </div>
                            </div>

                            {/* Date/Time + Duration */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <Label className="text-slate-700 font-medium">
                                        Select Date
                                        <span className="text-red-500">*</span>
                                    </Label>
                                    <DateTimePicker
                                        value={
                                            form.scheduledAt
                                                ? new Date(form.scheduledAt)
                                                : undefined
                                        }
                                        onChange={(date) =>
                                            setForm((f) => ({
                                                ...f,
                                                scheduledAt: date
                                                    ? date.toISOString()
                                                    : '',
                                            }))
                                        }
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label className="text-foreground/90 font-medium">
                                        Duration
                                    </Label>
                                    <Select
                                        value={String(form.durationMinutes)}
                                        onValueChange={(val) =>
                                            setForm((f) => ({
                                                ...f,
                                                durationMinutes: parseInt(val),
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="bg-background border-border w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {durationOptions.map((d) => (
                                                <SelectItem
                                                    key={d.value}
                                                    value={d.value}
                                                >
                                                    {d.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Extra Attendees */}
                            <div className="flex flex-col gap-2">
                                <Label className="text-foreground/90 font-medium">
                                    Additional Attendees
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="email"
                                        placeholder="extra@email.com"
                                        value={extraEmail}
                                        onChange={(e) =>
                                            setExtraEmail(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addExtraEmail();
                                            }
                                        }}
                                        className="bg-background border-border"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-border bg-background"
                                        onClick={addExtraEmail}
                                    >
                                        <IconPlus />
                                        Add
                                    </Button>
                                </div>
                                {(form.attendeeEmails?.length ?? 0) > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {form.attendeeEmails?.map((email) => (
                                            <Badge
                                                key={email}
                                                onClick={() =>
                                                    removeExtraEmail(email)
                                                }
                                                variant="outline"
                                                className="cursor-pointer hover:border-destructive hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
                                                title="Remove"
                                            >
                                                {email}
                                                <IconX className="h-3.5 w-3.5 ml-1" />
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div className="flex flex-col gap-2">
                                <Label className="text-foreground/90 font-medium">
                                    Description
                                </Label>
                                <Textarea
                                    placeholder="Meeting agenda or notes..."
                                    value={form.description || ''}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            description: e.target.value,
                                            }))
                                        }
                                    className="bg-background border-border min-h-[100px] resize-y"
                                />
                            </div>

                            {/* Internal Notes */}
                            <div className="flex flex-col gap-2">
                                <Label className="text-foreground/90 font-medium">
                                    Internal Notes
                                </Label>
                                <Input
                                    placeholder="Internal notes (not shared with client)"
                                    value={form.notes || ''}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            notes: e.target.value,
                                        }))
                                    }
                                    className="bg-background border-border"
                                />
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="border-border bg-background hover:bg-muted/30"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-teal-600 hover:bg-teal-700 text-white min-w-[140px]"
                        >
                            {isLoading ? (
                                <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <CalendarPlus className="h-4 w-4" />
                                    Schedule Meeting
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
