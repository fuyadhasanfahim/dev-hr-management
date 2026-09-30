'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Calendar, Loader } from 'lucide-react';
import { useAddLeadActivityMutation } from '@/redux/features/lead/leadApi';
import { useGetLeadSettingsQuery } from '@/redux/features/lead/leadSettingApi';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Lead, LeadSetting } from '@/types/lead.type';

const KEEP = 'keep';
const PRIORITIES = [
    { value: 'High', dot: 'bg-red-500' },
    { value: 'Medium', dot: 'bg-amber-500' },
    { value: 'Low', dot: 'bg-blue-500' },
] as const;

function Dot({ color, className }: { color?: string; className?: string }) {
    return (
        <span
            className={cn('inline-block size-2 shrink-0 rounded-full', className)}
            style={color ? { backgroundColor: color } : undefined}
        />
    );
}

/**
 * One form for everything that happens on a lead: a note, and/or a new
 * status / priority / source / follow-up. Each change lands in the history.
 */
export function LogActivityDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
    const { data: settingsData } = useGetLeadSettingsQuery(undefined);
    const [addActivity, { isLoading }] = useAddLeadActivityMutation();
    const settings: LeadSetting[] = useMemo(() => settingsData?.data ?? [], [settingsData]);
    const byType = (type: LeadSetting['type']) => settings.filter((s) => s.type === type);

    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState(KEEP);
    const [priority, setPriority] = useState(KEEP);
    const [source, setSource] = useState(KEEP);
    const [actionType, setActionType] = useState(KEEP);
    const [actionDate, setActionDate] = useState<Date | undefined>();

    const reset = () => {
        setNotes('');
        setStatus(KEEP);
        setPriority(KEEP);
        setSource(KEEP);
        setActionType(KEEP);
        setActionDate(undefined);
    };
    const close = () => {
        reset();
        onClose();
    };

    const changed = (value: string, current?: string) => value !== KEEP && value !== current;
    const statusChanged = changed(status, lead?.status?._id);
    const priorityChanged = changed(priority, lead?.priority);
    const sourceChanged = changed(source, lead?.source?._id);
    const followUp = actionType !== KEEP;
    const hasSomething = !!notes.trim() || statusChanged || priorityChanged || sourceChanged || followUp;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lead || !hasSomething) return;
        const payload: Record<string, string> = {
            activityType: statusChanged ? 'STATUS_CHANGE' : followUp ? 'FOLLOW_UP_SET' : notes.trim() ? 'NOTE_ADDED' : 'UPDATED',
        };
        if (notes.trim()) payload.notes = notes.trim();
        if (statusChanged) payload.newStatus = status;
        if (priorityChanged) payload.priority = priority;
        if (sourceChanged) payload.source = source;
        if (followUp) payload.nextActionType = actionType;
        if (followUp && actionDate) payload.nextActionDate = actionDate.toISOString();
        try {
            await addActivity({ id: lead._id, data: payload }).unwrap();
            toast.success('Activity logged');
            close();
        } catch (error: unknown) {
            toast.error((error as { data?: { message?: string } })?.data?.message || 'Couldn’t log the activity');
        }
    };

    return (
        <Dialog open={!!lead} onOpenChange={(open) => !open && close()}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
                    <DialogTitle className="text-lg">Log activity</DialogTitle>
                    <DialogDescription className="break-words">
                        {lead?.name || lead?.phone} — add a note, move the status or priority, or plan a follow-up.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                    <ScrollArea className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]]:max-h-[calc(90vh-10rem)]">
                        <div className="space-y-5 px-6 py-5">
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="What happened? E.g. had a great call, sending the quote tomorrow…"
                                    className="min-h-28 max-h-60 resize-none overflow-y-auto break-words"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select value={status} onValueChange={setStatus}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={KEEP}>
                                                <span className="text-muted-foreground">
                                                    Keep · {lead?.status?.name ?? 'None'}
                                                </span>
                                            </SelectItem>
                                            {byType('STATUS').map((s) => (
                                                <SelectItem key={s._id} value={s._id}>
                                                    <span className="flex items-center gap-2">
                                                        <Dot color={s.color} />
                                                        {s.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Priority</Label>
                                    <Select value={priority} onValueChange={setPriority}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={KEEP}>
                                                <span className="text-muted-foreground">Keep · {lead?.priority ?? 'Medium'}</span>
                                            </SelectItem>
                                            {PRIORITIES.map((p) => (
                                                <SelectItem key={p.value} value={p.value}>
                                                    <span className="flex items-center gap-2">
                                                        <Dot className={p.dot} />
                                                        {p.value}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Source</Label>
                                    <Select value={source} onValueChange={setSource}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={KEEP}>
                                                <span className="text-muted-foreground">
                                                    Keep · {lead?.source?.name ?? 'None'}
                                                </span>
                                            </SelectItem>
                                            {byType('SOURCE').map((s) => (
                                                <SelectItem key={s._id} value={s._id}>
                                                    <span className="flex items-center gap-2">
                                                        <Dot color={s.color} />
                                                        {s.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Next action</Label>
                                    <Select value={actionType} onValueChange={setActionType}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={KEEP}>
                                                <span className="text-muted-foreground">None</span>
                                            </SelectItem>
                                            {byType('ACTION_TYPE').map((a) => (
                                                <SelectItem key={a._id} value={a._id}>
                                                    {a.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {followUp && (
                                    <div className="flex flex-col space-y-2">
                                        <Label>Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        'w-full justify-start text-left font-normal',
                                                        !actionDate && 'text-muted-foreground',
                                                    )}
                                                >
                                                    <Calendar className="size-4" />
                                                    {actionDate ? format(actionDate, 'PPP') : 'Pick a date'}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <CalendarComponent
                                                    mode="single"
                                                    selected={actionDate}
                                                    onSelect={setActionDate}
                                                    autoFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}
                            </div>
                        </div>
                    </ScrollArea>

                    <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/30 px-6 py-3">
                        <Button type="button" variant="outline" onClick={close}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !hasSomething}>
                            {isLoading && <Loader className="size-4 animate-spin" />}
                            Log activity
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
