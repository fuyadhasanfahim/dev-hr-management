'use client';

import { useState } from 'react';
import {
    useUpdateConsultationMutation,
    useDeleteConsultationMutation,
    type Consultation,
} from '@/redux/features/consultation/consultationApi';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateTimePicker } from '@/components/shared/DateTimePicker';
import {
    Video,
    Loader,
    Ban,
    Trash2,
    CheckCircle2,
    Eye,
    CalendarPlus,
    Mail,
    Phone,
    FileText,
    ExternalLink,
    MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
    pending: { label: 'Pending', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
    scheduled: { label: 'Scheduled', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
    completed: { label: 'Completed', dot: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-400' },
    cancelled: { label: 'Cancelled', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
};

const sourceConfig: Record<string, { label: string; className: string }> = {
    ai_chat: { label: 'AI Chat', className: 'bg-purple-100/60 text-purple-800 border-purple-200/50 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900/50' },
    manual: { label: 'Manual', className: 'bg-slate-100/60 text-slate-800 border-slate-200/50 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800' },
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

interface ConsultationTableProps {
    consultations: Consultation[];
    isLoading: boolean;
}

export function ConsultationTable({ consultations, isLoading }: ConsultationTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                        <TableRow key={index} className="border-b border-border/60">
                            <TableCell className="pl-6"><Skeleton className="h-3.5 w-[140px]" /></TableCell>
                            <TableCell><Skeleton className="h-3.5 w-[160px]" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-[70px] rounded-md" /></TableCell>
                            <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
                            <TableCell><Skeleton className="h-3.5 w-[70px]" /></TableCell>
                            <TableCell className="pr-6">
                                <div className="flex justify-end gap-1">
                                    <Skeleton className="h-7 w-7 rounded-md" />
                                    <Skeleton className="h-7 w-7 rounded-md" />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                ) : consultations.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-40 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                                    <MessageSquare className="h-5 w-5 text-brand-primary" />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    No consultations found matching your criteria.
                                </p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    consultations.map((consultation) => (
                        <ConsultationRow key={consultation._id} consultation={consultation} />
                    ))
                )}
            </TableBody>
        </Table>
    );
}

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

    const [scheduleForm, setScheduleForm] = useState(() => ({
        scheduledAt: getDefaultDateTime(),
        durationMinutes: 30,
        adminNotes: consultation.adminNotes || '',
    }));

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
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e2 = err as any;
            toast.error(e2?.data?.message || 'Failed to schedule consultation');
        }
    };

    const handleStatusChange = async (status: string) => {
        try {
            await updateConsultation({
                id: consultation._id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: { status: status as any },
            }).unwrap();
            toast.success(`Consultation marked as ${status}`);
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e2 = err as any;
            toast.error(e2?.data?.message || 'Failed to update status');
        }
    };

    const handleDelete = async () => {
        try {
            await deleteConsultation(consultation._id).unwrap();
            toast.success('Consultation deleted');
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e2 = err as any;
            toast.error(e2?.data?.message || 'Failed to delete');
        }
    };

    const meeting = typeof consultation.meetingId === 'object' ? consultation.meetingId : null;

    return (
        <TableRow>
            {/* Client Info */}
            <TableCell className="pl-6">
                <div>
                    <p className="text-sm text-foreground">{consultation.name}</p>
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
            <TableCell>
                <div>
                    {consultation.projectType && (
                        <Badge variant="outline" className="text-[10px] font-normal mb-1">{consultation.projectType}</Badge>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2 max-w-[220px]">
                        {consultation.projectDescription}
                    </p>
                </div>
            </TableCell>

            {/* Source */}
            <TableCell>
                <Badge variant="outline" className={cn("text-[10px] font-medium", source.className)}>
                    {source.label}
                </Badge>
            </TableCell>

            {/* Status */}
            <TableCell>
                <span className={cn("inline-flex items-center gap-1.5 text-sm", config.text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
                    {config.label}
                </span>
                {meeting?.googleMeetLink && (
                    <a
                        href={meeting.googleMeetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1 text-[11px] font-medium text-teal-600 hover:text-teal-700 hover:underline"
                    >
                        <Video className="h-3 w-3" />
                        Join Meet
                        <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                )}
            </TableCell>

            {/* Submitted */}
            <TableCell>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {timeAgo(consultation.createdAt)}
                </span>
            </TableCell>

            {/* Actions */}
            <TableCell className="pr-6 text-right">
                <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10" onClick={() => setIsViewOpen(true)} title="View Details">
                        <Eye className="h-3.5 w-3.5" />
                    </Button>

                    {consultation.status === 'pending' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10" onClick={() => setIsScheduleOpen(true)} title="Schedule Meeting">
                            <CalendarPlus className="h-3.5 w-3.5" />
                        </Button>
                    )}

                    {consultation.status === 'scheduled' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10" onClick={() => handleStatusChange('completed')} disabled={isUpdating} title="Mark Completed">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                    )}

                    {(consultation.status === 'pending' || consultation.status === 'scheduled') && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleStatusChange('cancelled')} disabled={isUpdating} title="Cancel">
                            <Ban className="h-3.5 w-3.5" />
                        </Button>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Consultation</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete the consultation request from &quot;{consultation.name}&quot;? This cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {isDeleting ? <Loader className="h-4 w-4 animate-spin" /> : 'Delete'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </TableCell>

            {/* View Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
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
                                <span className="text-sm text-muted-foreground">Source:</span>
                                <span className="col-span-2">
                                    <Badge variant="outline" className={source.className}>{source.label}</Badge>
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                <span className="text-sm text-muted-foreground">Status:</span>
                                <span className="col-span-2 inline-flex items-center gap-1.5 text-sm">
                                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
                                    {config.label}
                                </span>
                            </div>
                            {consultation.scheduledAt && (
                                <DetailRow label="Scheduled" value={formatDate(consultation.scheduledAt)} />
                            )}
                            {meeting?.googleMeetLink && (
                                <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                    <span className="text-sm text-muted-foreground">Meet Link:</span>
                                    <a href={meeting.googleMeetLink} target="_blank" rel="noreferrer" className="col-span-2 text-sm text-teal-600 hover:underline break-all flex items-center gap-1">
                                        {meeting.googleMeetLink} <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            )}
                            {consultation.adminNotes && <DetailRow label="Admin Notes" value={consultation.adminNotes} />}
                            <DetailRow label="Submitted" value={formatDate(consultation.createdAt)} />

                            {consultation.chatTranscript && (
                                <div className="border-t pt-4">
                                    <p className="text-sm text-muted-foreground mb-2">Chat Transcript:</p>
                                    <pre className="text-xs text-foreground/80 bg-muted/30 p-3 rounded-lg border whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                                        {consultation.chatTranscript}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter>
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

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
            <span className="text-sm text-muted-foreground">{label}:</span>
            <span className="text-sm text-foreground col-span-2 break-words">{value}</span>
        </div>
    );
}
