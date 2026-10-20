'use client';

import { useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { Bot, CalendarClock, Clock, Loader, Pencil, Plus, Power, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { FEATURE_META, ScheduleDialog } from '@/components/ai-controls/schedule-dialog';
import {
    AI_FEATURES,
    useGetAiSettingsQuery,
    useUpdateAiSettingsMutation,
    type AiFeature,
    type AiSchedule,
    type AiSettingsPatch,
    type AiStatus,
} from '@/store/api/aiSettingsApi';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIMEZONES = [
    'Asia/Dhaka',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Australia/Sydney',
    'UTC',
];
const RESUME_PRESETS = [2, 5, 10, 15, 30, 60];
const QUICK_PAUSES: { label: string; minutes?: number; untilTomorrow9?: boolean }[] = [
    { label: '30 minutes', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '4 hours', minutes: 240 },
    { label: 'Until tomorrow 9 AM', untilTomorrow9: true },
];

const REASON_TEXT: Record<NonNullable<AiStatus['reason']>, string> = {
    env: 'Disabled on the server',
    master: 'Turned off',
    feature: 'Switched off',
    schedule: 'Paused by schedule',
    outside_hours: 'Outside allowed hours',
};

function StatusPill({ status }: { status?: AiStatus }) {
    if (!status) return <Skeleton className="h-6 w-20 rounded-full" />;
    return (
        <Badge
            variant="outline"
            className={cn(
                'gap-1.5 whitespace-nowrap',
                status.active
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
            )}
        >
            <span className={cn('size-1.5 rounded-full', status.active ? 'bg-emerald-500' : 'bg-rose-500')} />
            {status.active ? 'Active' : 'Off'}
        </Badge>
    );
}

function statusLine(status?: AiStatus): string {
    if (!status) return '';
    if (status.active) {
        return status.nextChangeAt ? `Active — goes off in ${formatDistanceToNowStrict(new Date(status.nextChangeAt))}` : 'Active';
    }
    const base = REASON_TEXT[status.reason ?? 'master'] + (status.detail ? ` “${status.detail}”` : '');
    return status.nextChangeAt ? `${base} — back on in ${formatDistanceToNowStrict(new Date(status.nextChangeAt))}` : base;
}

function describeSchedule(s: AiSchedule): string {
    const time = s.startTime === s.endTime ? 'all day' : `${s.startTime}–${s.endTime}`;
    if (s.kind === 'once') {
        return s.startAt && s.endAt ? `${format(new Date(s.startAt), 'MMM d, h:mm a')} → ${format(new Date(s.endAt), 'MMM d, h:mm a')}` : 'Custom range';
    }
    if (s.kind === 'daily') return `Every day · ${time}`;
    if (s.kind === 'weekly') return `Every ${[...s.days].sort().map((d) => WEEKDAYS[d]).join(', ')} · ${time}`;
    const days = [...s.days].sort((a, b) => (a || 99) - (b || 99)).map((d) => (d === 0 ? 'last day' : String(d)));
    return `Monthly on ${days.join(', ')} · ${time}`;
}

export default function AiControlsPage() {
    const { can } = usePermissions();
    const canManage = can('ai.manage');

    const { data, isLoading, isError, refetch } = useGetAiSettingsQuery(undefined, { pollingInterval: 30_000 });
    const [update, { isLoading: saving }] = useUpdateAiSettingsMutation();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AiSchedule | null>(null);
    const [deleting, setDeleting] = useState<AiSchedule | null>(null);
    const [minutesDraft, setMinutesDraft] = useState<string | null>(null);
    const [confirmPermanentOff, setConfirmPermanentOff] = useState(false);

    const settings = data?.settings;
    const status = data?.status;
    const anyOff = !!status && AI_FEATURES.some((f) => !status[f].active);

    const apply = async (patch: AiSettingsPatch, success?: string) => {
        try {
            await update(patch).unwrap();
            if (success) toast.success(success);
            return true;
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Could not save the change');
            return false;
        }
    };

    const schedules = useMemo(() => settings?.schedules ?? [], [settings?.schedules]);

    const quickPause = (opt: (typeof QUICK_PAUSES)[number]) => {
        const start = new Date();
        const end = new Date(start);
        if (opt.untilTomorrow9) {
            end.setDate(end.getDate() + 1);
            end.setHours(9, 0, 0, 0);
        } else {
            end.setMinutes(end.getMinutes() + (opt.minutes ?? 60));
        }
        const pause: AiSchedule = {
            id: '',
            label: 'Quick pause',
            kind: 'once',
            action: 'off_during',
            enabled: true,
            features: [],
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            days: [],
        };
        void apply({ schedules: [...schedules, pause] }, `AI paused until ${format(end, 'MMM d, h:mm a')}`);
    };

    const resumeNow = async () => {
        const now = Date.now();
        const remaining = schedules.filter(
            (s) => !(s.kind === 'once' && s.action === 'off_during' && s.startAt && s.endAt && new Date(s.startAt).getTime() <= now && now < new Date(s.endAt).getTime()),
        );
        await apply(
            {
                masterMode: 'on',
                schedules: remaining,
                features: { whatsapp: { enabled: true }, web_chat: { enabled: true }, chat_summary: { enabled: true } },
            },
            'AI resumed',
        );
    };

    const saveSchedule = async (s: AiSchedule) => {
        const next = s.id ? schedules.map((x) => (x.id === s.id ? s : x)) : [...schedules, s];
        if (await apply({ schedules: next }, s.id ? 'Schedule updated' : 'Schedule added')) setDialogOpen(false);
    };

    const minutesValue = minutesDraft ?? String(settings?.autoResume.minutes ?? 5);
    const minutesChanged = settings && Number(minutesValue) !== settings.autoResume.minutes;

    const saveMinutes = async (value: number) => {
        if (!Number.isInteger(value) || value < 1 || value > 1440) {
            toast.error('Enter whole minutes between 1 and 1440');
            return;
        }
        if (await apply({ autoResume: { minutes: value } }, `Auto-resume set to ${value} min`)) setMinutesDraft(null);
    };

    if (isError) {
        return (
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-10 text-center">
                <p className="text-sm text-muted-foreground">Couldn’t load the AI controls.</p>
                <Button variant="outline" onClick={() => refetch()}>
                    Try again
                </Button>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
            <header className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Bot className="size-5" />
                </span>
                <div>
                    <h1 className="text-xl font-semibold tracking-tight md:text-2xl">AI Controls</h1>
                    <p className="text-sm text-muted-foreground">Turn the AI on or off, schedule it, and decide how it comes back after your team replies.</p>
                </div>
            </header>

            {!canManage && (
                <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">You can view these settings but not change them.</p>
            )}

            {/* ── Master ─────────────────────────────────────────────── */}
            <Card className={cn(settings?.masterMode === 'off' && 'border-rose-500/40')}>
                <CardContent className="space-y-4 pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className={cn('flex size-11 items-center justify-center rounded-full', settings?.masterMode === 'off' ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600')}>
                                <Power className="size-5" />
                            </span>
                            <div>
                                <p className="font-semibold">{isLoading ? 'Loading…' : settings?.masterMode === 'off' ? 'All AI is permanently off' : 'AI is on'}</p>
                                <p className="text-sm text-muted-foreground">
                                    {settings?.masterMode === 'off'
                                        ? 'Nothing is answered by AI until you turn this back on. Schedules are ignored.'
                                        : anyOff
                                          ? 'Some AI is currently off because of a switch or schedule below.'
                                          : 'Every AI is working and follows the schedules below.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{settings?.masterMode === 'off' ? 'Off' : 'On'}</span>
                            <Switch
                                aria-label="Master AI switch"
                                checked={settings?.masterMode !== 'off'}
                                disabled={!canManage || saving || isLoading}
                                onCheckedChange={(on) => (on ? apply({ masterMode: 'on' }, 'AI is on') : setConfirmPermanentOff(true))}
                            />
                        </div>
                    </div>

                    {canManage && settings?.masterMode !== 'off' && (
                        <div className="space-y-2 border-t pt-4">
                            <p className="flex items-center gap-2 text-sm font-medium">
                                <Timer className="size-4 text-muted-foreground" /> Pause for a while
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {QUICK_PAUSES.map((q) => (
                                    <Button key={q.label} size="sm" variant="outline" disabled={saving} onClick={() => quickPause(q)}>
                                        {q.label}
                                    </Button>
                                ))}
                                <Button size="sm" variant="outline" disabled={saving} onClick={() => { setEditing(null); setDialogOpen(true); }}>
                                    Custom…
                                </Button>
                                {anyOff && (
                                    <Button size="sm" disabled={saving} onClick={resumeNow}>
                                        Resume now
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                    {canManage && settings?.masterMode === 'off' && (
                        <Button size="sm" disabled={saving} onClick={resumeNow}>
                            Turn everything back on
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* ── Each AI ────────────────────────────────────────────── */}
            <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Each AI</h2>
                <div className="grid gap-3 md:grid-cols-3">
                    {AI_FEATURES.map((f: AiFeature) => (
                        <Card key={f}>
                            <CardContent className="space-y-3 pt-6">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-medium">{FEATURE_META[f].title}</p>
                                        <p className="text-xs text-muted-foreground">{FEATURE_META[f].hint}</p>
                                    </div>
                                    <Switch
                                        aria-label={`${FEATURE_META[f].title} switch`}
                                        checked={settings?.features[f].enabled ?? true}
                                        disabled={!canManage || saving || isLoading}
                                        onCheckedChange={(enabled) => apply({ features: { [f]: { enabled } } }, `${FEATURE_META[f].title} ${enabled ? 'on' : 'off'}`)}
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <StatusPill status={status?.[f]} />
                                    <span className="text-xs text-muted-foreground">{statusLine(status?.[f])}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* ── Auto resume ────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Clock className="size-4" /> When your team replies
                    </CardTitle>
                    <CardDescription>Controls what the AI does in a WhatsApp chat after an agent answers it.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <Label className="text-sm font-medium">Pause the AI in a chat when an agent replies</Label>
                            <p className="mt-0.5 text-xs text-muted-foreground">Recommended. If off, the AI keeps answering even after a teammate wrote to the customer.</p>
                        </div>
                        <Switch
                            aria-label="Pause AI when an agent replies"
                            checked={settings?.pauseOnAgentReply ?? true}
                            disabled={!canManage || saving || isLoading}
                            onCheckedChange={(v) => apply({ pauseOnAgentReply: v }, v ? 'AI will pause when an agent replies' : 'AI will keep answering after agent replies')}
                        />
                    </div>

                    <div className={cn('space-y-4 border-t pt-5', settings && !settings.pauseOnAgentReply && 'pointer-events-none opacity-50')}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <Label className="text-sm font-medium">Turn AI back on automatically</Label>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {settings?.autoResume.enabled
                                        ? `The AI returns to a chat ${settings.autoResume.minutes} min after the agent’s last reply and answers anything left unanswered.`
                                        : 'Off: after an agent replies, the AI stays off in that chat until someone switches it on by hand.'}
                                </p>
                            </div>
                            <Switch
                                aria-label="Auto-resume"
                                checked={settings?.autoResume.enabled ?? true}
                                disabled={!canManage || saving || isLoading}
                                onCheckedChange={(v) => apply({ autoResume: { enabled: v } }, v ? 'Auto-resume on' : 'Auto-resume off — running countdowns cleared')}
                            />
                        </div>

                        {settings?.autoResume.enabled && (
                            <div className="space-y-3">
                                <Label className="text-sm">Wait before the AI returns</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {RESUME_PRESETS.map((m) => (
                                        <Button
                                            key={m}
                                            size="sm"
                                            variant={settings.autoResume.minutes === m && minutesDraft === null ? 'default' : 'outline'}
                                            disabled={!canManage || saving}
                                            onClick={() => saveMinutes(m)}
                                        >
                                            {m} min
                                        </Button>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            max={1440}
                                            className="h-8 w-24"
                                            aria-label="Custom minutes"
                                            value={minutesValue}
                                            disabled={!canManage}
                                            onChange={(e) => setMinutesDraft(e.target.value)}
                                        />
                                        <span className="text-xs text-muted-foreground">min</span>
                                        {minutesChanged && (
                                            <Button size="sm" disabled={saving} onClick={() => saveMinutes(Number(minutesValue))}>
                                                Save
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">Applies to replies sent from now on; countdowns already running keep their time.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── Schedules ──────────────────────────────────────────── */}
            <Card>
                <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarClock className="size-4" /> Schedules
                        </CardTitle>
                        <CardDescription>Switch the AI off (or allow it only) at set times — once, daily, weekly or monthly.</CardDescription>
                    </div>
                    {canManage && (
                        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                            <Plus className="mr-1.5 size-4" /> Add schedule
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
                        <Label htmlFor="ai-tz" className="text-sm">Time zone for daily / weekly / monthly schedules</Label>
                        <Select
                            value={settings?.timezone ?? 'Asia/Dhaka'}
                            disabled={!canManage || saving || isLoading}
                            onValueChange={(tz) => apply({ timezone: tz }, `Time zone set to ${tz}`)}
                        >
                            <SelectTrigger id="ai-tz" className="h-8 w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(settings && !TIMEZONES.includes(settings.timezone) ? [settings.timezone, ...TIMEZONES] : TIMEZONES).map((tz) => (
                                    <SelectItem key={tz} value={tz}>
                                        {tz}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoading ? (
                        <Skeleton className="h-16 w-full" />
                    ) : schedules.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">No schedules yet. The AI follows only the switches above.</p>
                    ) : (
                        <ul className="divide-y rounded-lg border">
                            {schedules.map((s) => (
                                <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className={cn('truncate text-sm font-medium', !s.enabled && 'text-muted-foreground')}>{s.label || (s.action === 'off_during' ? 'AI off' : 'AI on only')}</p>
                                            <Badge variant="secondary" className="text-[10px]">
                                                {s.action === 'off_during' ? 'Turns AI off' : 'AI on only'}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px]">
                                                {s.features.length === 0 ? 'All AI' : s.features.map((f) => FEATURE_META[f].title).join(', ')}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{describeSchedule(s)}</p>
                                    </div>
                                    {canManage && (
                                        <div className="flex items-center gap-1">
                                            <Switch
                                                aria-label={`Toggle schedule ${s.label}`}
                                                checked={s.enabled}
                                                disabled={saving}
                                                onCheckedChange={(enabled) => apply({ schedules: schedules.map((x) => (x.id === s.id ? { ...x, enabled } : x)) })}
                                            />
                                            <Button size="icon" variant="ghost" aria-label="Edit schedule" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" aria-label="Delete schedule" className="text-destructive hover:text-destructive" onClick={() => setDeleting(s)}>
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    {settings?.updatedBy && settings.updatedAt && (
                        <p className="text-xs text-muted-foreground">
                            Last changed by {settings.updatedBy.name} on {format(new Date(settings.updatedAt), 'MMM d, h:mm a')}.
                        </p>
                    )}
                </CardContent>
            </Card>

            <ScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} schedule={editing} saving={saving} onSave={saveSchedule} />

            <AlertDialog open={confirmPermanentOff} onOpenChange={setConfirmPermanentOff}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Turn all AI off permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                            WhatsApp, the website chat and chat summaries stop using AI until you turn this back on. Customers who message in the meantime will wait for your team.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => apply({ masterMode: 'off' }, 'All AI is off')}>
                            {saving && <Loader className="mr-2 size-4 animate-spin" />}Turn off
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
                        <AlertDialogDescription>{deleting && describeSchedule(deleting)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleting && apply({ schedules: schedules.filter((x) => x.id !== deleting.id) }, 'Schedule deleted')}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
