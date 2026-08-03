'use client';

import { useState } from 'react';
import {
    useCancelMeetingMutation,
    useUpdateMeetingMutation,
    useDeleteMeetingMutation,
    useCreateMeetingMutation,
    type Meeting,
    type CreateMeetingInput,
} from '@/redux/features/meeting/meetingApi';
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
import { Skeleton } from '@/components/ui/skeleton';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateTimePicker } from '@/components/shared/DateTimePicker';
import {
    CalendarPlus,
    Video,
    ExternalLink,
    Clock,
    Loader,
    Ban,
    Phone,
    Plus,
    Edit,
    Trash2,
    Copy,
    Eye,
} from 'lucide-react';
import { IconPlus, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
    scheduled: { label: 'Scheduled', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400' },
    completed: { label: 'Completed', dot: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-400' },
    cancelled: { label: 'Cancelled', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
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

interface ClientOption {
    _id: string;
    name: string;
    clientId?: string;
    emails?: string[];
    phone?: string;
    currency?: string;
}

interface MeetingTableProps {
    meetings: Meeting[];
    isLoading: boolean;
}

export function MeetingTable({ meetings, isLoading }: MeetingTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">Meeting</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date & Time</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Google Meet</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                        <TableRow key={index} className="border-b border-border/60">
                            <TableCell className="pl-6"><Skeleton className="h-3.5 w-[160px]" /></TableCell>
                            <TableCell><Skeleton className="h-3.5 w-[110px]" /></TableCell>
                            <TableCell><Skeleton className="h-3.5 w-[140px]" /></TableCell>
                            <TableCell><Skeleton className="h-3.5 w-[60px]" /></TableCell>
                            <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
                            <TableCell><Skeleton className="h-3.5 w-[90px]" /></TableCell>
                            <TableCell className="pr-6">
                                <div className="flex justify-end gap-1">
                                    <Skeleton className="h-7 w-7 rounded-md" />
                                    <Skeleton className="h-7 w-7 rounded-md" />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                ) : meetings.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="h-40 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                                    <Video className="h-5 w-5 text-brand-primary" />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    No meetings found matching your criteria.
                                </p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    meetings.map((meeting) => (
                        <MeetingRow key={meeting._id} meeting={meeting} />
                    ))
                )}
            </TableBody>
        </Table>
    );
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
    const [cancelMeeting, { isLoading: isCancelling }] = useCancelMeetingMutation();
    const [updateMeeting, { isLoading: isUpdating }] = useUpdateMeetingMutation();
    const [deleteMeeting, { isLoading: isDeleting }] = useDeleteMeetingMutation();

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

    const client = typeof meeting.clientId === 'object' ? meeting.clientId : null;
    const config = statusConfig[meeting.status] || statusConfig.scheduled;
    const upcoming = isUpcoming(meeting.scheduledAt);

    const [form, setForm] = useState({
        meetingTitle: meeting.meetingTitle || '',
        description: meeting.description || '',
        scheduledAt: meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString() : '',
        durationMinutes: meeting.durationMinutes || 30,
        notes: meeting.notes || '',
        attendeeEmails: meeting.attendeeEmails || [],
        attendeePhones: meeting.attendeePhones || [],
    });
    const [extraEmail, setExtraEmail] = useState('');
    const [extraPhone, setExtraPhone] = useState('');

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.meetingTitle || !form.scheduledAt) {
            toast.error('Please fill in all required fields');
            return;
        }

        const finalAttendeeEmails = [...(form.attendeeEmails || [])];
        if (extraEmail && /\S+@\S+\.\S+/.test(extraEmail)) {
            if (!finalAttendeeEmails.includes(extraEmail)) {
                finalAttendeeEmails.push(extraEmail);
            }
        }

        const finalAttendeePhones = [...(form.attendeePhones || [])];
        if (extraPhone && /^\+?[0-9\s-]{6,15}$/.test(extraPhone)) {
            if (!finalAttendeePhones.includes(extraPhone)) {
                finalAttendeePhones.push(extraPhone);
            }
        }

        try {
            await updateMeeting({
                id: meeting._id,
                data: {
                    ...form,
                    attendeeEmails: finalAttendeeEmails,
                    attendeePhones: finalAttendeePhones,
                    scheduledAt: new Date(form.scheduledAt).toISOString(),
                },
            }).unwrap();
            toast.success('Meeting updated successfully');
            setIsEditDialogOpen(false);
            setExtraEmail('');
            setExtraPhone('');
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e2 = err as any;
            toast.error(e2?.data?.message || 'Failed to update meeting');
        }
    };

    const handleDelete = async () => {
        try {
            await deleteMeeting(meeting._id).unwrap();
            toast.success('Meeting deleted successfully');
            setIsDeleteDialogOpen(false);
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e2 = err as any;
            toast.error(e2?.data?.message || 'Failed to delete meeting');
        }
    };

    const handleCancel = async () => {
        try {
            await cancelMeeting(meeting._id).unwrap();
            toast.success('Meeting cancelled successfully');
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e2 = err as any;
            toast.error(e2?.data?.message || 'Failed to cancel meeting');
        }
    };

    const addExtraEmail = () => {
        if (extraEmail && /\S+@\S+\.\S+/.test(extraEmail)) {
            setForm((f) => ({ ...f, attendeeEmails: [...(f.attendeeEmails || []), extraEmail] }));
            setExtraEmail('');
        }
    };

    const removeExtraEmail = (email: string) => {
        setForm((f) => ({ ...f, attendeeEmails: (f.attendeeEmails || []).filter((e) => e !== email) }));
    };

    const addExtraPhone = () => {
        if (extraPhone && /^\+?[0-9\s-]{6,15}$/.test(extraPhone)) {
            setForm((f) => ({ ...f, attendeePhones: [...(f.attendeePhones || []), extraPhone] }));
            setExtraPhone('');
        } else {
            toast.error('Invalid phone number format');
        }
    };

    const removeExtraPhone = (phone: string) => {
        setForm((f) => ({ ...f, attendeePhones: (f.attendeePhones || []).filter((p) => p !== phone) }));
    };

    return (
        <TableRow>
            <TableCell className="pl-6">
                <div>
                    <p className="text-sm text-foreground">{meeting.meetingTitle}</p>
                    {meeting.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 max-w-[220px]">
                            {meeting.description}
                        </p>
                    )}
                </div>
            </TableCell>
            <TableCell>
                {client ? (
                    <div>
                        <p className="text-sm text-foreground">{client.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground">{client.clientId}</p>
                            {client.currency === 'BDT' && (
                                <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal text-orange-700 border-orange-300 bg-orange-50/60 dark:bg-orange-950/20 dark:border-orange-900/50 flex items-center gap-0.5">
                                    <Phone className="h-2.5 w-2.5" />
                                    SMS
                                </Badge>
                            )}
                        </div>
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                )}
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-foreground/80 whitespace-nowrap">
                        {formatDate(meeting.scheduledAt)}
                    </span>
                </div>
            </TableCell>
            <TableCell>
                <span className="text-sm text-foreground/80 whitespace-nowrap">
                    {meeting.durationMinutes} min
                </span>
            </TableCell>
            <TableCell>
                <span className={cn("inline-flex items-center gap-1.5 text-sm", config.text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
                    {config.label}
                </span>
            </TableCell>
            <TableCell>
                {meeting.googleMeetLink ? (
                    <a
                        href={meeting.googleMeetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 hover:underline"
                    >
                        <Video className="h-3.5 w-3.5" />
                        Join Meet
                        <ExternalLink className="h-3 w-3" />
                    </a>
                ) : (
                    <span className="text-xs text-muted-foreground select-none">No link</span>
                )}
            </TableCell>
            <TableCell className="pr-6 text-right">
                <div className="flex items-center justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                        onClick={() => setIsViewDialogOpen(true)}
                        title="View Details"
                    >
                        <Eye className="h-3.5 w-3.5" />
                    </Button>

                    <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Video className="h-5 w-5 text-teal-600" />
                                    Meeting Details
                                </DialogTitle>
                                <DialogDescription>
                                    Full information about this scheduled meeting.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
                                <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                    <span className="text-sm text-muted-foreground">Title:</span>
                                    <span className="text-sm text-foreground col-span-2">{meeting.meetingTitle}</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                    <span className="text-sm text-muted-foreground">Scheduled At:</span>
                                    <span className="text-sm text-foreground col-span-2">
                                        {new Date(meeting.scheduledAt).toLocaleString('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            timeZone: 'Asia/Dhaka',
                                        })}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                    <span className="text-sm text-muted-foreground">Duration:</span>
                                    <span className="text-sm text-foreground col-span-2">{meeting.durationMinutes} minutes</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                    <span className="text-sm text-muted-foreground">Status:</span>
                                    <span className="col-span-2 inline-flex items-center gap-1.5 text-sm">
                                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
                                        {config.label}
                                    </span>
                                </div>

                                {meeting.googleMeetLink && (
                                    <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                        <span className="text-sm text-muted-foreground">Meet Link:</span>
                                        <a
                                            href={meeting.googleMeetLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="col-span-2 text-sm text-teal-600 hover:underline break-all flex items-center gap-1"
                                        >
                                            {meeting.googleMeetLink}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                    <span className="text-sm text-muted-foreground">Client:</span>
                                    <span className="text-sm text-foreground col-span-2">
                                        {client?.name || 'No Client (Guest Meeting)'}
                                    </span>
                                </div>

                                {client && (
                                    <>
                                        {client.emails && client.emails.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                                <span className="text-sm text-muted-foreground">Client Emails:</span>
                                                <div className="col-span-2 flex flex-wrap gap-1">
                                                    {client.emails.map((email: string) => (
                                                        <Badge key={email} variant="secondary">{email}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {client.phone && (
                                            <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                                <span className="text-sm text-muted-foreground">Client Phone:</span>
                                                <span className="text-sm col-span-2">
                                                    <Badge variant="secondary">{client.phone}</Badge>
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}

                                {meeting.attendeeEmails && meeting.attendeeEmails.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                        <span className="text-sm text-muted-foreground">Attendees (Email):</span>
                                        <div className="col-span-2 flex flex-wrap gap-1">
                                            {meeting.attendeeEmails.map((email: string) => (
                                                <Badge key={email} variant="secondary">{email}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {meeting.attendeePhones && meeting.attendeePhones.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                        <span className="text-sm text-muted-foreground">Attendees (Phone):</span>
                                        <div className="col-span-2 flex flex-wrap gap-1">
                                            {meeting.attendeePhones.map((phone: string) => (
                                                <Badge key={phone} variant="secondary">{phone}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {meeting.description && (
                                    <div className="grid grid-cols-3 gap-2 border-b pb-3 border-border/50">
                                        <span className="text-sm text-muted-foreground">Description:</span>
                                        <span className="text-sm col-span-2 break-words">{meeting.description}</span>
                                    </div>
                                )}

                                {meeting.notes && (
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="text-sm text-muted-foreground">Internal Notes:</span>
                                        <span className="text-sm col-span-2 break-words bg-muted/30 p-2 rounded border border-border/50">{meeting.notes}</span>
                                    </div>
                                )}
                            </div>

                            <DialogFooter>
                                <Button type="button" onClick={() => setIsViewDialogOpen(false)}>
                                    Close
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-brand-accent hover:bg-brand-accent/10"
                                title="Edit Meeting"
                            >
                                <Edit className="h-3.5 w-3.5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-lg overflow-hidden p-0 flex flex-col h-[95vh] gap-0">
                            <form onSubmit={handleEditSubmit} className="flex flex-col h-full gap-0">
                                <DialogHeader className="px-6 pt-5 pb-4 shrink-0 border-b border-border">
                                    <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                                        <Edit className="h-5 w-5 text-teal-600" />
                                        Edit Meeting
                                    </DialogTitle>
                                    <DialogDescription>
                                        Update the details of this meeting. Attendees will receive updated notifications.
                                    </DialogDescription>
                                </DialogHeader>

                                <ScrollArea className="flex-1 overflow-hidden">
                                    <div className="px-6 py-5 flex flex-col gap-5">
                                        <div className="flex flex-col gap-2">
                                            <Label>Meeting Title <span className="text-destructive">*</span></Label>
                                            <Input
                                                placeholder="e.g., Project Kickoff Call"
                                                value={form.meetingTitle}
                                                onChange={(e) => setForm((f) => ({ ...f, meetingTitle: e.target.value }))}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-2">
                                                <Label>Select Date <span className="text-destructive">*</span></Label>
                                                <DateTimePicker
                                                    value={form.scheduledAt ? new Date(form.scheduledAt) : undefined}
                                                    onChange={(date) => setForm((f) => ({ ...f, scheduledAt: date ? date.toISOString() : '' }))}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <Label>Duration</Label>
                                                <Select
                                                    value={String(form.durationMinutes)}
                                                    onValueChange={(val) => setForm((f) => ({ ...f, durationMinutes: parseInt(val) }))}
                                                >
                                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {durationOptions.map((d) => (
                                                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label>Additional Attendees</Label>
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
                                                />
                                                <Button type="button" variant="outline" onClick={addExtraEmail}>
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
                                                            className="cursor-pointer hover:border-destructive hover:text-destructive hover:bg-destructive/10"
                                                            title="Remove"
                                                        >
                                                            {email}
                                                            <IconX className="h-3.5 w-3.5 ml-1" />
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label>Additional Phone Invites (SMS)</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="tel"
                                                    placeholder="+88017xxxxxxxx"
                                                    value={extraPhone}
                                                    onChange={(e) => setExtraPhone(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addExtraPhone();
                                                        }
                                                    }}
                                                />
                                                <Button type="button" variant="outline" onClick={addExtraPhone}>
                                                    <IconPlus /> Add
                                                </Button>
                                            </div>
                                            {(form.attendeePhones?.length ?? 0) > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {form.attendeePhones?.map((phone) => (
                                                        <Badge
                                                            key={phone}
                                                            onClick={() => removeExtraPhone(phone)}
                                                            variant="outline"
                                                            className="cursor-pointer hover:border-destructive hover:text-destructive hover:bg-destructive/10"
                                                            title="Remove"
                                                        >
                                                            {phone}
                                                            <IconX className="h-3.5 w-3.5 ml-1" />
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label>Description</Label>
                                            <Textarea
                                                placeholder="Meeting agenda or notes..."
                                                value={form.description || ''}
                                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                                className="min-h-[100px] resize-y"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label>Internal Notes</Label>
                                            <Input
                                                placeholder="Internal notes (not shared with client)"
                                                value={form.notes || ''}
                                                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </ScrollArea>

                                <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
                                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isUpdating} className="min-w-[140px]">
                                        {isUpdating ? <Loader className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Delete Meeting"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to delete the meeting &quot;{meeting.meetingTitle}&quot;? This will cancel the Google Calendar event and notify attendees.
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

                    {meeting.googleMeetLink && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                            onClick={() => {
                                navigator.clipboard.writeText(meeting.googleMeetLink || '');
                                toast.success('Meeting link copied to clipboard!');
                            }}
                            title="Copy Meet Link"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                    )}

                    {meeting.status === 'scheduled' && upcoming && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={handleCancel}
                            disabled={isCancelling}
                            title="Cancel Meeting"
                        >
                            {isCancelling ? <Loader className="h-3 w-3 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}

export function ScheduleMeetingDialog({ clients }: { clients: ClientOption[] }) {
    const [open, setOpen] = useState(false);
    const getDefaultDateTime = () => {
        const d = new Date(Date.now() + 60 * 60 * 1000);
        d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
        return d.toISOString();
    };

    const [createMeeting, { isLoading }] = useCreateMeetingMutation();

    const [form, setForm] = useState<CreateMeetingInput>(() => ({
        meetingTitle: '',
        description: '',
        scheduledAt: getDefaultDateTime(),
        durationMinutes: 30,
        clientId: '',
        attendeeEmails: [],
        attendeePhones: [],
        notes: '',
    }));
    const [extraEmail, setExtraEmail] = useState('');
    const [extraPhone, setExtraPhone] = useState('');

    const selectedClient = clients.find((c) => c._id === form.clientId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.meetingTitle || !form.scheduledAt) {
            toast.error('Please fill in all required fields');
            return;
        }

        const finalAttendeeEmails = [...(form.attendeeEmails || [])];
        if (extraEmail && /\S+@\S+\.\S+/.test(extraEmail)) {
            if (!finalAttendeeEmails.includes(extraEmail)) {
                finalAttendeeEmails.push(extraEmail);
            }
        }

        const finalAttendeePhones = [...(form.attendeePhones || [])];
        if (extraPhone && /^\+?[0-9\s-]{6,15}$/.test(extraPhone)) {
            if (!finalAttendeePhones.includes(extraPhone)) {
                finalAttendeePhones.push(extraPhone);
            }
        }

        try {
            const payload = {
                ...form,
                attendeeEmails: finalAttendeeEmails,
                attendeePhones: finalAttendeePhones,
            };
            if (payload.clientId === 'none' || !payload.clientId) {
                delete payload.clientId;
            }
            const result = await createMeeting({
                ...payload,
                scheduledAt: new Date(form.scheduledAt).toISOString(),
            }).unwrap();
            toast.success('Meeting scheduled successfully!');
            if (result.data?.googleMeetLink) {
                toast.info(`Meet link: ${result.data.googleMeetLink}`);
            }
            setOpen(false);
            resetForm();
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e2 = err as any;
            toast.error(e2?.data?.message || 'Failed to schedule meeting');
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
            attendeePhones: [],
            notes: '',
        });
        setExtraEmail('');
        setExtraPhone('');
    };

    const addExtraEmail = () => {
        if (extraEmail && /\S+@\S+\.\S+/.test(extraEmail)) {
            setForm((f) => ({ ...f, attendeeEmails: [...(f.attendeeEmails || []), extraEmail] }));
            setExtraEmail('');
        }
    };

    const removeExtraEmail = (email: string) => {
        setForm((f) => ({ ...f, attendeeEmails: (f.attendeeEmails || []).filter((e) => e !== email) }));
    };

    const addExtraPhone = () => {
        if (extraPhone && /^\+?[0-9\s-]{6,15}$/.test(extraPhone)) {
            setForm((f) => ({ ...f, attendeePhones: [...(f.attendeePhones || []), extraPhone] }));
            setExtraPhone('');
        } else {
            toast.error('Invalid phone number format');
        }
    };

    const removeExtraPhone = (phone: string) => {
        setForm((f) => ({ ...f, attendeePhones: (f.attendeePhones || []).filter((p) => p !== phone) }));
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
                <Button size="sm" className="h-8">
                    <Plus className="h-3.5 w-3.5" />
                    Schedule Meeting
                </Button>
            </DialogTrigger>
            <DialogContent className="w-lg overflow-hidden p-0 flex flex-col h-[95vh] gap-0">
                <form onSubmit={handleSubmit} className="flex flex-col h-full gap-0">
                    <DialogHeader className="px-6 pt-5 pb-4 shrink-0 border-b border-border">
                        <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                            <Video className="h-5 w-5 text-teal-600" />
                            Schedule New Meeting
                        </DialogTitle>
                        <DialogDescription>
                            Create a meeting with Google Meet. Attendees will receive an email invitation.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 overflow-hidden">
                        <div className="px-6 py-5 flex flex-col gap-5">
                            <div className="flex flex-col gap-2">
                                <Label>Meeting Title <span className="text-destructive">*</span></Label>
                                <Input
                                    placeholder="e.g., Project Kickoff Call"
                                    value={form.meetingTitle}
                                    onChange={(e) => setForm((f) => ({ ...f, meetingTitle: e.target.value }))}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Client (Optional)</Label>
                                <Select
                                    value={form.clientId || 'none'}
                                    onValueChange={(val) => setForm((f) => ({ ...f, clientId: val === 'none' ? '' : val }))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a client (Optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Client (Guest Meeting)</SelectItem>
                                        {clients.map((c) => (
                                            <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                    {selectedClient?.emails?.map((email) => (
                                        <Badge key={email} variant="secondary" className="text-teal-600 border-teal-500/30 bg-teal-500/10">
                                            {email}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <Label>Select Date <span className="text-destructive">*</span></Label>
                                    <DateTimePicker
                                        value={form.scheduledAt ? new Date(form.scheduledAt) : undefined}
                                        onChange={(date) => setForm((f) => ({ ...f, scheduledAt: date ? date.toISOString() : '' }))}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Duration</Label>
                                    <Select
                                        value={String(form.durationMinutes)}
                                        onValueChange={(val) => setForm((f) => ({ ...f, durationMinutes: parseInt(val) }))}
                                    >
                                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {durationOptions.map((d) => (
                                                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Additional Attendees</Label>
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
                                    />
                                    <Button type="button" variant="outline" onClick={addExtraEmail}>
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
                                                className="cursor-pointer hover:border-destructive hover:text-destructive hover:bg-destructive/10"
                                                title="Remove"
                                            >
                                                {email}
                                                <IconX className="h-3.5 w-3.5 ml-1" />
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Additional Phone Invites (SMS)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="tel"
                                        placeholder="+88017xxxxxxxx"
                                        value={extraPhone}
                                        onChange={(e) => setExtraPhone(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addExtraPhone();
                                            }
                                        }}
                                    />
                                    <Button type="button" variant="outline" onClick={addExtraPhone}>
                                        <IconPlus /> Add
                                    </Button>
                                </div>
                                {(form.attendeePhones?.length ?? 0) > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {form.attendeePhones?.map((phone) => (
                                            <Badge
                                                key={phone}
                                                onClick={() => removeExtraPhone(phone)}
                                                variant="outline"
                                                className="cursor-pointer hover:border-destructive hover:text-destructive hover:bg-destructive/10"
                                                title="Remove"
                                            >
                                                {phone}
                                                <IconX className="h-3.5 w-3.5 ml-1" />
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Description</Label>
                                <Textarea
                                    placeholder="Meeting agenda or notes..."
                                    value={form.description || ''}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    className="min-h-[100px] resize-y"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Internal Notes</Label>
                                <Input
                                    placeholder="Internal notes (not shared with client)"
                                    value={form.notes || ''}
                                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                />
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isLoading} className="min-w-[140px]">
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
