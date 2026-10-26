'use client';

import { Suspense, useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { Bot, CalendarClock, Clock, Pencil, Plus, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { SearchInput } from '@/components/ui/search-input';
import { readPaging, useClampPage, useUrlState } from '@/hooks/use-url-state';
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
    return (
        <Suspense fallback={<Skeleton className="m-6 h-64 rounded-xl" />}>
            <AiControls />
        </Suspense>
    );
}

// Schedule search, page and page size live in the URL: ?q=night&page=2&limit=50
function AiControls() {
    const url = useUrlState({ limit: '20' });
    const { page, limit } = readPaging(url.get);
    const scheduleQuery = url.get('q');

    const { can } = usePermissions();
    const canManage = can('ai.manage');

    const { data, isLoading, isError, error, refetch } = useGetAiSettingsQuery(undefined, { pollingInterval: 30_000 });
    const [update, { isLoading: saving }] = useUpdateAiSettingsMutation();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<AiSchedule | null>(null);
    const [deleting, setDeleting] = useState<AiSchedule | null>(null);
    const [minutesDraft, setMinutesDraft] = useState<string | null>(null);

    const settings = data?.settings;
    const status = data?.status;

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
    const matching = useMemo(() => {
        const q = scheduleQuery.toLowerCase();
        if (!q) return schedules;
        return schedules.filter((s) => `${s.label} ${describeSchedule(s)} ${s.action === 'off_during' ? 'turns ai off' : 'ai on only'}`.toLowerCase().includes(q));
    }, [schedules, scheduleQuery]);
    const totalPages = Math.max(1, Math.ceil(matching.length / limit));
    const shown = matching.slice((page - 1) * limit, page * limit);
    useClampPage(page, totalPages, (n) => url.set({ page: n }));

    // Pausing and resuming are per AI: pausing WhatsApp never touches the website assistant (and the reverse).
    const quickPause = (opt: (typeof QUICK_PAUSES)[number], feature: AiFeature) => {
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
            features: [feature],
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            days: [],
        };
        void apply({ schedules: [...schedules, pause] }, `${FEATURE_META[feature].title} paused until ${format(end, 'MMM d, h:mm a')}`);
    };

    // Turns one AI back on: its own switch, and any running pause is trimmed to the other AIs only.
    const resumeNow = async (feature: AiFeature) => {
        const now = Date.now();
        const running = (x: AiSchedule) =>
            x.kind === 'once' && x.action === 'off_during' && x.startAt && x.endAt && new Date(x.startAt).getTime() <= now && now < new Date(x.endAt).getTime();
        const remaining = schedules.flatMap((x) => {
            if (!running(x) || !(x.features.length === 0 || x.features.includes(feature))) return [x];
            const others = (x.features.length === 0 ? [...AI_FEATURES] : x.features).filter((f) => f !== feature);
            return others.length ? [{ ...x, features: others }] : [];
        });
        await apply({ masterMode: 'on', schedules: remaining, features: { [feature]: { enabled: true } } }, `${FEATURE_META[feature].title} resumed`);
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
                {(error as { status?: number } | undefined)?.status === 403 ? (
                    <>
                        <p className="text-sm font-medium">You don’t have access to AI Controls.</p>
                        <p className="max-w-sm text-sm text-muted-foreground">Ask a super admin to give your role the “AI Controls” permission (Roles &amp; Permissions).</p>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">Couldn’t load the AI controls.</p>
                        <Button variant="outline" onClick={() => refetch()}>
                            Try again
                        </Button>
                    </>
                )}
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
                    <p className="text-sm text-muted-foreground">Turn each AI on or off, pause or schedule it, and decide how the WhatsApp AI comes back after your team replies.</p>
                </div>
            </header>

            {!canManage && (
                <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">You can view these settings but not change them.</p>
            )}

            {/* The old "all AI off" master switch is retired: every AI has its own switch below. If someone still has it
                off through the API, say so here so nobody is stuck. */}
            {settings?.masterMode === 'off' && (
                <Card className="border-rose-500/40">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                        <p className="text-sm">
                            <span className="font-semibold">An old “all AI off” switch is still on.</span> Nothing answers until you turn it back on. Use the switches below to control each AI separately.
                        </p>
                        {canManage && (
                            <Button size="sm" disabled={saving} onClick={() => apply({ masterMode: 'on' }, 'Old master switch turned off')}>
                                Clear it
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── Each AI works on its own ───────────────────────────── */}
            <section className="space-y-3">
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Each AI works on its own</h2>
                    <p className="text-xs text-muted-foreground">Switching off or pausing one never changes the others.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
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

                                {canManage && (
                                    <div className="space-y-2 border-t pt-3">
                                        <p className="flex items-center gap-1.5 text-xs font-medium">
                                            <Timer className="size-3.5 text-muted-foreground" /> Pause for a while
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {QUICK_PAUSES.map((q) => (
                                                <Button key={q.label} size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={saving} onClick={() => quickPause(q, f)}>
                                                    {q.label}
                                                </Button>
                                            ))}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2 text-xs"
                                                disabled={saving}
                                                onClick={() => {
                                                    setEditing({ id: '', label: '', kind: 'once', action: 'off_during', enabled: true, features: [f], days: [] });
                                                    setDialogOpen(true);
                                                }}
                                            >
                                                Custom…
                                            </Button>
                                            {status && !status[f].active && (
                                                <Button size="sm" className="h-7 px-2 text-xs" disabled={saving} onClick={() => resumeNow(f)}>
                                                    Resume now
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {f === 'web_chat' && (
                                    <div className="space-y-3 border-t pt-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium">AI raises tickets</p>
                                                <p className="text-xs text-muted-foreground">It collects name, email and phone, then opens the ticket itself. It shows in Tickets.</p>
                                            </div>
                                            <Switch
                                                aria-label="AI raises tickets from the website"
                                                checked={settings?.web.createTickets ?? true}
                                                disabled={!canManage || saving || isLoading}
                                                onCheckedChange={(v) => apply({ web: { createTickets: v } }, v ? 'The website AI can raise tickets' : 'The website AI will not raise tickets')}
                                            />
                                        </div>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium">AI remembers visitors</p>
                                                <p className="text-xs text-muted-foreground">Keeps a short profile of each visitor (business, what they asked) and uses it in later chats.</p>
                                            </div>
                                            <Switch
                                                aria-label="Website AI remembers visitors"
                                                checked={settings?.web.remember ?? true}
                                                disabled={!canManage || saving || isLoading}
                                                onCheckedChange={(v) => apply({ web: { remember: v } }, v ? 'The website AI remembers visitors' : 'The website AI will not keep a memory')}
                                            />
                                        </div>
                                    </div>
                                )}
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
                        <CardDescription>Switch an AI off (or allow it only) at set times — once, daily, weekly or monthly. Pick which AI each schedule is for.</CardDescription>
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
                        <>
                        <SearchInput value={scheduleQuery} placeholder="Search schedules…" onSearch={(q) => url.set({ q, page: null })} />
                        {matching.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">No schedules match your search.</p>
                        ) : (
                        <ul className="divide-y rounded-lg border">
                            {shown.map((s) => (
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
                        {matching.length > 0 && (
                            <PaginationBar
                                page={page}
                                limit={limit}
                                total={matching.length}
                                totalPages={totalPages}
                                onPageChange={(n) => url.set({ page: n })}
                                onLimitChange={(n) => url.set({ limit: n, page: null })}
                            />
                        )}
                        </>
                    )}
                    {settings?.updatedBy && settings.updatedAt && (
                        <p className="text-xs text-muted-foreground">
                            Last changed by {settings.updatedBy.name} on {format(new Date(settings.updatedAt), 'MMM d, h:mm a')}.
                        </p>
                    )}
                </CardContent>
            </Card>

            <ScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} schedule={editing} saving={saving} onSave={saveSchedule} />

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
