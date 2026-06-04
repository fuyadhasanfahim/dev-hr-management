'use client';

import { useState, useMemo } from 'react';
import {
    useGetConsultationsQuery,
    useGetConsultationStatsQuery,
    useUpdateConsultationMutation,
    useDeleteConsultationMutation,
    type Consultation,
} from '@/redux/features/consultation/consultationApi';
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
    RefreshCw,
    Video,
    Clock,
    ChevronLeft,
    ChevronRight,
    Loader,
    Ban,
    Trash2,
    CheckCircle2,
    Filter,
    Eye,
    CalendarPlus,
    MessageSquare,
    Mail,
    Phone,
    FileText,
    ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateTimePicker } from '@/components/shared/DateTimePicker';
import { IconSearch } from '@tabler/icons-react';

// ─── Status Helpers ────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
    pending: {
        label: 'Pending',
        className: 'bg-amber-100/60 text-amber-800 border-amber-200/50',
    },
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

const sourceConfig: Record<string, { label: string; className: string }> = {
    ai_chat: {
        label: 'AI Chat',
        className: 'bg-purple-100/60 text-purple-800 border-purple-200/50',
    },
    manual: {
        label: 'Manual',
        className: 'bg-slate-100/60 text-slate-800 border-slate-200/50',
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

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ─── Main Page ─────────────────────────────────────────────────

export default function ConsultationsPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const limit = 20;

    const { data, isLoading, isFetching, refetch } = useGetConsultationsQuery({
        page,
        limit,
        status: statusFilter || undefined,
        search: search || undefined,
    });

    const { data: statsData } = useGetConsultationStatsQuery();
    const stats = statsData?.data || { pending: 0, scheduled: 0, completed: 0, cancelled: 0, total: 0 };

    const consultations = data?.data?.consultations || [];
    const pagination = data?.data?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

    return (
        <div className="space-y-8 p-1">
            {/* Header & Stats */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            Consultations
                        </h2>
                        <p className="text-muted-foreground mt-1">
                            Manage consultation requests from AI chat and schedule meetings.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="bg-background border-border"
                        onClick={() => refetch()}
                        disabled={isFetching}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/5 hover:border-amber-500/30">
                        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-amber-500/10 blur-2xl transition-all duration-300 group-hover:bg-amber-500/20" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-amber-500/20">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-medium bg-amber-500/5 text-amber-500 border-amber-500/20 px-1.5 py-0 h-5">
                                    New
                                </Badge>
                            </div>
                            <h3 className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">{stats.pending}</h3>
                            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-amber-500/10 font-medium">Pending Requests</p>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-blue-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-500/30">
                        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-blue-500/10 blur-2xl transition-all duration-300 group-hover:bg-blue-500/20" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-500/20">
                                    <CalendarPlus className="h-5 w-5" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-medium bg-blue-500/5 text-blue-500 border-blue-500/20 px-1.5 py-0 h-5">
                                    Scheduled
                                </Badge>
                            </div>
                            <h3 className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{stats.scheduled}</h3>
                            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-blue-500/10 font-medium">Scheduled Meetings</p>
                        </div>
                    </div>

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
                            <h3 className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">{stats.completed}</h3>
                            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-green-500/10 font-medium">Completed</p>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-red-500/10 via-card to-card p-5 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/5 hover:border-red-500/30">
                        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-red-500/10 blur-2xl transition-all duration-300 group-hover:bg-red-500/20" />
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-all duration-300 group-hover:scale-110 group-hover:bg-red-500/20">
                                    <Ban className="h-5 w-5" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-medium bg-red-500/5 text-red-500 border-red-500/20 px-1.5 py-0 h-5">
                                    Cancelled
                                </Badge>
                            </div>
                            <h3 className="text-3xl font-bold tracking-tight text-red-600 dark:text-red-400">{stats.cancelled}</h3>
                            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-red-500/10 font-medium">Cancelled</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Table Card */}
            <Card className="border-border/60 shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        Consultation Requests
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2">
                            <div className="bg-primary/10 p-2 rounded-full">
                                <Filter className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm font-medium">Filters:</span>
                        </div>

                        <div className="relative flex-1 min-w-[200px]">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
                            <Input
                                placeholder="Search by name, email, or project..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="pl-9 bg-background/60 h-9"
                            />
                        </div>

                        <Select
                            value={statusFilter}
                            onValueChange={(val) => { setStatusFilter(val === 'all' ? '' : val); setPage(1); }}
                        >
                            <SelectTrigger className="w-[140px] h-9 bg-background/60">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-lg border border-border/50">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <RefreshCw className="h-8 w-8 animate-spin text-primary/40" />
                            </div>
                        ) : consultations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <MessageSquare className="h-12 w-12 mb-4 opacity-30" />
                                <p className="font-medium text-lg text-foreground">No consultations found</p>
                                <p className="text-sm mt-1 text-muted-foreground">Consultation requests from AI chat will appear here</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
                                        <TableHead className="font-semibold text-muted-foreground h-11">Client</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground h-11">Project</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground h-11">Source</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground h-11">Status</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground h-11">Submitted</TableHead>
                                        <TableHead className="font-semibold text-muted-foreground text-right h-11">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {consultations.map((consultation) => (
                                        <ConsultationRow key={consultation._id} consultation={consultation} />
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 0 && (
                        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-muted-foreground">
                                Showing <span className="font-medium text-foreground">{consultations.length}</span> of{' '}
                                <span className="font-medium text-foreground">{pagination.total}</span> consultations
                            </div>
                            {pagination.totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8 bg-background border-border" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm font-medium px-3 text-foreground/80">{page} / {pagination.totalPages}</span>
                                    <Button variant="outline" size="icon" className="h-8 w-8 bg-background border-border" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
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

// ─── Consultation Row ─────────────────────────────────────────

function ConsultationRow({ consultation }: { consultation: Consultation }) {
    const [updateConsultation, { isLoading: isUpdating }] = useUpdateConsultationMutation();
    const [deleteConsultation, { isLoading: isDeleting }] = useDeleteConsultationMutation();

    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);

    const config = statusConfig[consultation.status] || statusConfig.pending;
    const source = sourceConfig[consultation.source] || sourceConfig.manual;

    const getDefaultDateTime = () => {
        const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
        d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
        return d.toISOString();
    };

    const [scheduleForm, setScheduleForm] = useState({
        scheduledAt: getDefaultDateTime(),
        durationMinutes: 30,
        adminNotes: consultation.adminNotes || '',
    });

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scheduleForm.scheduledAt) {
            toast.error('Please select a date and time');
            return;
        }

        try {
            await updateConsultation({
                id: consultation._id,
                data: {
                    status: 'scheduled',
                    scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
                    durationMinutes: scheduleForm.durationMinutes,
                    adminNotes: scheduleForm.adminNotes,
                },
            }).unwrap();
            toast.success('Consultation scheduled! Meeting created with Google Meet link.');
            setIsScheduleOpen(false);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to schedule consultation');
        }
    };

    const handleStatusChange = async (status: string) => {
        try {
            await updateConsultation({
                id: consultation._id,
                data: { status: status as any },
            }).unwrap();
            toast.success(`Consultation marked as ${status}`);
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to update status');
        }
    };

    const handleDelete = async () => {
        try {
            await deleteConsultation(consultation._id).unwrap();
            toast.success('Consultation deleted');
        } catch (err: any) {
            toast.error(err?.data?.message || 'Failed to delete');
        }
    };

    const meeting = typeof consultation.meetingId === 'object' ? consultation.meetingId : null;

    return (
        <TableRow className="group hover:bg-muted/30 transition-all duration-200 border-b border-border/60">
            {/* Client Info */}
            <TableCell className="py-3.5">
                <div>
                    <p className="font-semibold text-sm text-foreground tracking-tight">{consultation.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{consultation.email}</span>
                    </div>
                    {consultation.phone && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{consultation.phone}</span>
                        </div>
                    )}
                </div>
            </TableCell>

            {/* Project */}
            <TableCell className="py-3.5">
                <div>
                    {consultation.projectType && (
                        <Badge variant="outline" className="text-[10px] font-medium mb-1">{consultation.projectType}</Badge>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2 max-w-[220px]">
                        {consultation.projectDescription}
                    </p>
                </div>
            </TableCell>

            {/* Source */}
            <TableCell className="py-3.5">
                <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider h-5.5 ${source.className}`}>
                    {source.label}
                </Badge>
            </TableCell>

            {/* Status */}
            <TableCell className="py-3.5">
                <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider h-5.5 ${config.className}`}>
                    {config.label}
                </Badge>
                {meeting?.googleMeetLink && (
                    <a
                        href={meeting.googleMeetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                    >
                        <Video className="h-3 w-3" />
                        Join Meet
                        <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                )}
            </TableCell>

            {/* Submitted */}
            <TableCell className="py-3.5">
                <span className="text-sm text-foreground/80 font-medium whitespace-nowrap">
                    {timeAgo(consultation.createdAt)}
                </span>
            </TableCell>

            {/* Actions */}
            <TableCell className="py-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    {/* View */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-teal-600 hover:bg-teal-50" onClick={() => setIsViewOpen(true)} title="View Details">
                        <Eye className="h-4 w-4" />
                    </Button>

                    {/* Schedule (only for pending) */}
                    {consultation.status === 'pending' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => setIsScheduleOpen(true)} title="Schedule Meeting">
                            <CalendarPlus className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Mark complete (only for scheduled) */}
                    {consultation.status === 'scheduled' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50" onClick={() => handleStatusChange('completed')} disabled={isUpdating} title="Mark Completed">
                            <CheckCircle2 className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Cancel (pending or scheduled) */}
                    {(consultation.status === 'pending' || consultation.status === 'scheduled') && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleStatusChange('cancelled')} disabled={isUpdating} title="Cancel">
                            <Ban className="h-4 w-4" />
                        </Button>
                    )}

                    {/* Delete */}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50" title="Delete">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                                    <Ban className="h-5 w-5" />
                                    Delete Consultation
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete the consultation request from &quot;{consultation.name}&quot;? This cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                                    {isDeleting ? <Loader className="h-4 w-4 animate-spin" /> : 'Delete'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </TableCell>

            {/* View Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="max-w-lg p-6 rounded-lg shadow-xl border">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Consultation Details
                        </DialogTitle>
                        <DialogDescription>Full information about this consultation request.</DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[60vh] pr-1">
                        <div className="space-y-4 py-4">
                            <DetailRow label="Name" value={consultation.name} />
                            <DetailRow label="Email" value={consultation.email} />
                            {consultation.phone && <DetailRow label="Phone" value={consultation.phone} />}
                            {consultation.projectType && <DetailRow label="Project Type" value={consultation.projectType} />}
                            <DetailRow label="Description" value={consultation.projectDescription} />
                            <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                <span className="text-sm font-semibold text-muted-foreground">Source:</span>
                                <span className="col-span-2">
                                    <Badge variant="outline" className={source.className}>{source.label}</Badge>
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                <span className="text-sm font-semibold text-muted-foreground">Status:</span>
                                <span className="col-span-2">
                                    <Badge variant="outline" className={config.className}>{config.label}</Badge>
                                </span>
                            </div>
                            {consultation.scheduledAt && (
                                <DetailRow label="Scheduled" value={formatDate(consultation.scheduledAt)} />
                            )}
                            {meeting?.googleMeetLink && (
                                <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                    <span className="text-sm font-semibold text-muted-foreground">Meet Link:</span>
                                    <a href={meeting.googleMeetLink} target="_blank" rel="noreferrer" className="col-span-2 text-sm text-teal-600 hover:underline font-medium break-all flex items-center gap-1">
                                        {meeting.googleMeetLink} <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            )}
                            {consultation.adminNotes && <DetailRow label="Admin Notes" value={consultation.adminNotes} />}
                            <DetailRow label="Submitted" value={formatDate(consultation.createdAt)} />

                            {consultation.chatTranscript && (
                                <div className="border-t pt-4">
                                    <p className="text-sm font-semibold text-muted-foreground mb-2">Chat Transcript:</p>
                                    <pre className="text-xs text-foreground/80 bg-muted/30 p-3 rounded-lg border whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                        {consultation.chatTranscript}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="border-t pt-4">
                        <Button onClick={() => setIsViewOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Schedule Dialog */}
            <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col">
                    <form onSubmit={handleSchedule} className="flex flex-col">
                        <DialogHeader className="px-6 pt-5 pb-4 border-b">
                            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                                <CalendarPlus className="h-5 w-5 text-teal-600" />
                                Schedule Consultation
                            </DialogTitle>
                            <DialogDescription>
                                Schedule a meeting with <strong>{consultation.name}</strong>. A Google Meet link will be auto-generated and sent to {consultation.email}.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="px-6 py-5 flex flex-col gap-5">
                            <div className="flex flex-col gap-2">
                                <Label className="font-medium">
                                    Date & Time <span className="text-red-500">*</span>
                                </Label>
                                <DateTimePicker
                                    value={scheduleForm.scheduledAt ? new Date(scheduleForm.scheduledAt) : undefined}
                                    onChange={(date) => setScheduleForm((f) => ({ ...f, scheduledAt: date ? date.toISOString() : '' }))}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label className="font-medium">Duration</Label>
                                <Select
                                    value={String(scheduleForm.durationMinutes)}
                                    onValueChange={(val) => setScheduleForm((f) => ({ ...f, durationMinutes: parseInt(val) }))}
                                >
                                    <SelectTrigger className="bg-background border-border w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {durationOptions.map((d) => (
                                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label className="font-medium">Admin Notes</Label>
                                <Textarea
                                    placeholder="Internal notes about this consultation..."
                                    value={scheduleForm.adminNotes}
                                    onChange={(e) => setScheduleForm((f) => ({ ...f, adminNotes: e.target.value }))}
                                    className="bg-background border-border min-h-[80px] resize-y"
                                />
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isUpdating} className="bg-teal-600 hover:bg-teal-700 text-white min-w-[160px]">
                                {isUpdating ? (
                                    <Loader className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <CalendarPlus className="h-4 w-4" />
                                        Schedule & Create Meet
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </TableRow>
    );
}

// ─── Detail Row Helper ────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
            <span className="text-sm font-semibold text-muted-foreground">{label}:</span>
            <span className="text-sm text-foreground col-span-2 font-medium break-words">{value}</span>
        </div>
    );
}
