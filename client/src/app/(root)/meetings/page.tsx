"use client";

import { useState, useMemo } from "react";
import {
    useGetMeetingsQuery,
    useCancelMeetingMutation,
    type Meeting,
} from "@/redux/features/meeting/meetingApi";
import { useGetClientsQuery } from "@/redux/features/client/clientApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import { useCreateMeetingMutation, type CreateMeetingInput } from "@/redux/features/meeting/meetingApi";
import { toast } from "sonner";

// ─── Status Helpers ────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
    scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800 border-blue-200" },
    completed: { label: "Completed", className: "bg-teal-100 text-teal-800 border-teal-200" },
    cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 border-red-200" },
};

const durationOptions = [
    { value: "15", label: "15 min" },
    { value: "30", label: "30 min" },
    { value: "45", label: "45 min" },
    { value: "60", label: "1 hour" },
    { value: "90", label: "1.5 hours" },
    { value: "120", label: "2 hours" },
];

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Dhaka",
    });
}

function isUpcoming(dateStr: string) {
    return new Date(dateStr) > new Date();
}

// ─── Main Page ─────────────────────────────────────────────────

export default function MeetingsPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState("");
    const [clientFilter, setClientFilter] = useState("");
    const [search, setSearch] = useState("");
    const limit = 20;

    const { data, isLoading, isFetching, refetch } = useGetMeetingsQuery({
        page,
        limit,
        status: statusFilter || undefined,
        clientId: clientFilter || undefined,
    });

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
                (typeof m.clientId === "object" && m.clientId.name.toLowerCase().includes(q))
        );
    }, [meetings, search]);

    return (
        <div className="w-full space-y-8 bg-slate-50/50 min-h-screen">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Video className="h-6 w-6 text-teal-600" />
                        Meetings
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                        Schedule and manage client meetings with Google Meet
                        {isFetching && (
                            <Loader className="h-3 w-3 animate-spin text-teal-600" />
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="bg-white"
                        onClick={() => refetch()}
                        disabled={isFetching}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <ScheduleMeetingDialog clients={clients} />
                </div>
            </div>

            <Card className="border-slate-200 bg-white">
                {/* Filters */}
                <div className="p-4 border-b border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search meetings..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-9 border-slate-200 bg-white"
                            />
                        </div>
                        <Select
                            value={statusFilter}
                            onValueChange={(val) => {
                                setStatusFilter(val === "all" ? "" : val);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-9 border-slate-200 bg-white">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={clientFilter}
                            onValueChange={(val) => {
                                setClientFilter(val === "all" ? "" : val);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-9 border-slate-200 bg-white">
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
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 text-slate-500"
                            onClick={() => {
                                setSearch("");
                                setStatusFilter("");
                                setClientFilter("");
                                setPage(1);
                            }}
                        >
                            <X className="h-4 w-4 mr-2" />
                            Clear
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <RefreshCw className="h-8 w-8 animate-spin text-teal-600/40" />
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
                                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-100">
                                    <TableHead className="font-semibold text-slate-600">Meeting</TableHead>
                                    <TableHead className="font-semibold text-slate-600">Client</TableHead>
                                    <TableHead className="font-semibold text-slate-600">Date & Time</TableHead>
                                    <TableHead className="font-semibold text-slate-600">Duration</TableHead>
                                    <TableHead className="font-semibold text-slate-600">Status</TableHead>
                                    <TableHead className="font-semibold text-slate-600">Google Meet</TableHead>
                                    <TableHead className="font-semibold text-slate-600 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMeetings.map((meeting) => (
                                    <MeetingRow key={meeting._id} meeting={meeting} />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {/* Pagination */}
                {meta.totalPages > 0 && (
                    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-medium text-slate-900">{filteredMeetings.length}</span> of{" "}
                            <span className="font-medium text-slate-900">{meta.total}</span> meetings
                        </div>
                        {meta.totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 bg-white border-slate-200"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium px-3 text-slate-700">
                                    {page} / {meta.totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 bg-white border-slate-200"
                                    disabled={page >= meta.totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}

// ─── Meeting Row ───────────────────────────────────────────────

function MeetingRow({ meeting }: { meeting: Meeting }) {
    const [cancelMeeting, { isLoading: isCancelling }] = useCancelMeetingMutation();
    const client = typeof meeting.clientId === "object" ? meeting.clientId : null;
    const config = statusConfig[meeting.status] || statusConfig.scheduled;
    const upcoming = isUpcoming(meeting.scheduledAt);

    const handleCancel = async () => {
        if (!confirm("Are you sure you want to cancel this meeting?")) return;
        try {
            await cancelMeeting(meeting._id).unwrap();
            toast.success("Meeting cancelled successfully");
        } catch {
            toast.error("Failed to cancel meeting");
        }
    };

    return (
        <TableRow className="group hover:bg-slate-50 transition-colors border-slate-100">
            <TableCell>
                <div>
                    <p className="font-medium text-sm text-slate-900">{meeting.meetingTitle}</p>
                    {meeting.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{meeting.description}</p>
                    )}
                </div>
            </TableCell>
            <TableCell>
                {client ? (
                    <div className="flex items-center gap-2">
                        <div>
                            <p className="text-sm font-medium text-slate-900">{client.name}</p>
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs text-slate-500">{client.clientId}</p>
                                {client.currency === "BDT" && (
                                    <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold text-orange-700 border-orange-300 bg-orange-50">
                                        <Phone className="h-2.5 w-2.5 mr-0.5" />
                                        SMS
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <span className="text-xs text-slate-400">—</span>
                )}
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-sm text-slate-700">{formatDate(meeting.scheduledAt)}</span>
                </div>
            </TableCell>
            <TableCell>
                <span className="text-sm text-slate-700">{meeting.durationMinutes} min</span>
            </TableCell>
            <TableCell>
                <Badge variant="outline" className={config.className + " text-[10px] font-bold uppercase"}>
                    {config.label}
                </Badge>
            </TableCell>
            <TableCell>
                {meeting.googleMeetLink ? (
                    <a
                        href={meeting.googleMeetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline transition-colors"
                    >
                        <Video className="h-3.5 w-3.5" />
                        Join Meet
                        <ExternalLink className="h-3 w-3" />
                    </a>
                ) : (
                    <span className="text-xs text-slate-400">No link</span>
                )}
            </TableCell>
            <TableCell className="text-right">
                {meeting.status === "scheduled" && upcoming && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={handleCancel}
                        disabled={isCancelling}
                    >
                        {isCancelling ? (
                            <Loader className="h-3 w-3 animate-spin" />
                        ) : (
                            <>
                                <Ban className="h-3 w-3 mr-1" />
                                Cancel
                            </>
                        )}
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}

// ─── Schedule Meeting Dialog ───────────────────────────────────

function ScheduleMeetingDialog({ clients }: { clients: { _id: string; name: string; clientId: string; emails: string[] }[] }) {
    const [open, setOpen] = useState(false);
    const [createMeeting, { isLoading }] = useCreateMeetingMutation();

    const [form, setForm] = useState<CreateMeetingInput>({
        meetingTitle: "",
        description: "",
        scheduledAt: "",
        durationMinutes: 30,
        clientId: "",
        attendeeEmails: [],
        notes: "",
    });
    const [extraEmail, setExtraEmail] = useState("");

    const selectedClient = clients.find((c) => c._id === form.clientId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.meetingTitle || !form.scheduledAt || !form.clientId) {
            toast.error("Please fill in all required fields");
            return;
        }

        try {
            const result = await createMeeting({
                ...form,
                scheduledAt: new Date(form.scheduledAt).toISOString(),
            }).unwrap();
            toast.success("Meeting scheduled successfully!");
            if (result.data?.googleMeetLink) {
                toast.info(`Meet link: ${result.data.googleMeetLink}`);
            }
            setOpen(false);
            resetForm();
        } catch (err: any) {
            toast.error(err?.data?.message || "Failed to schedule meeting");
        }
    };

    const resetForm = () => {
        setForm({
            meetingTitle: "",
            description: "",
            scheduledAt: "",
            durationMinutes: 30,
            clientId: "",
            attendeeEmails: [],
            notes: "",
        });
        setExtraEmail("");
    };

    const addExtraEmail = () => {
        if (extraEmail && /\S+@\S+\.\S+/.test(extraEmail)) {
            setForm((f) => ({
                ...f,
                attendeeEmails: [...(f.attendeeEmails || []), extraEmail],
            }));
            setExtraEmail("");
        }
    };

    const removeExtraEmail = (email: string) => {
        setForm((f) => ({
            ...f,
            attendeeEmails: (f.attendeeEmails || []).filter((e) => e !== email),
        }));
    };

    // Default to 1 hour from now, rounded to next 15 min
    const getDefaultDateTime = () => {
        const d = new Date(Date.now() + 60 * 60 * 1000);
        d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
        return d.toISOString().slice(0, 16);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
                <Button className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Meeting
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto bg-white">
                <div className="px-1 py-1 shrink-0">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                            <Video className="h-5 w-5 text-teal-600" />
                            Schedule New Meeting
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            Create a meeting with Google Meet. Attendees will receive an email invitation.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 mt-2 px-1">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium">
                            Meeting Title <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            placeholder="e.g., Project Kickoff Call"
                            value={form.meetingTitle}
                            onChange={(e) => setForm((f) => ({ ...f, meetingTitle: e.target.value }))}
                            className="bg-white border-slate-200"
                        />
                    </div>

                    {/* Client */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium">
                            Client <span className="text-red-500">*</span>
                        </Label>
                        <Select
                            value={form.clientId}
                            onValueChange={(val) => setForm((f) => ({ ...f, clientId: val }))}
                        >
                            <SelectTrigger className="bg-white border-slate-200">
                                <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map((c) => (
                                    <SelectItem key={c._id} value={c._id}>
                                        {c.name} ({c.clientId})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedClient && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {selectedClient.emails.map((email) => (
                                    <Badge key={email} variant="secondary" className="text-[10px] font-medium bg-slate-100 text-slate-700">
                                        {email}
                                    </Badge>
                                ))}
                                <span className="text-[10px] text-slate-500 self-center ml-1">
                                    (auto-invited)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Date/Time + Duration */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-medium">
                                Date & Time <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                type="datetime-local"
                                value={form.scheduledAt || getDefaultDateTime()}
                                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                                className="bg-white border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-700 font-medium">Duration</Label>
                            <Select
                                value={String(form.durationMinutes)}
                                onValueChange={(val) => setForm((f) => ({ ...f, durationMinutes: parseInt(val) }))}
                            >
                                <SelectTrigger className="bg-white border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {durationOptions.map((d) => (
                                        <SelectItem key={d.value} value={d.value}>
                                            {d.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Extra Attendees */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium">Additional Attendees</Label>
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                placeholder="extra@email.com"
                                value={extraEmail}
                                onChange={(e) => setExtraEmail(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtraEmail(); } }}
                                className="bg-white border-slate-200"
                            />
                            <Button type="button" variant="outline" size="sm" onClick={addExtraEmail} className="border-slate-200">
                                Add
                            </Button>
                        </div>
                        {(form.attendeeEmails?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {form.attendeeEmails?.map((email) => (
                                    <Badge
                                        key={email}
                                        variant="secondary"
                                        className="text-[10px] font-medium cursor-pointer hover:bg-red-100 bg-slate-100 text-slate-700"
                                        onClick={() => removeExtraEmail(email)}
                                    >
                                        {email}
                                        <X className="h-2.5 w-2.5 ml-1" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium">Description</Label>
                        <Textarea
                            placeholder="Meeting agenda or notes..."
                            value={form.description || ""}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            className="bg-white border-slate-200 min-h-[80px] resize-y"
                        />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label className="text-slate-700 font-medium">Internal Notes</Label>
                        <Input
                            placeholder="Internal notes (not shared with client)"
                            value={form.notes || ""}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            className="bg-white border-slate-200"
                        />
                    </div>

                    <DialogFooter className="pt-4 border-t border-slate-100 mt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-slate-200">
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
                                    <CalendarPlus className="h-4 w-4 mr-2" />
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
