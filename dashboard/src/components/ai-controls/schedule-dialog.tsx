'use client';

import { useState } from 'react';
import { Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AI_FEATURES, type AiFeature, type AiSchedule, type ScheduleAction, type ScheduleKind } from '@/redux/features/ai-settings/aiSettingsApi';

export const FEATURE_META: Record<AiFeature, { title: string; hint: string }> = {
    whatsapp: { title: 'WhatsApp (Mira)', hint: 'Auto-replies to customers in the WhatsApp inbox' },
    web_chat: { title: 'Website chat AI', hint: 'The AI assistant on the website chat widget' },
    chat_summary: { title: 'Chat summaries', hint: 'AI summary inside the chat-resolved email' },
};

const KINDS: { value: ScheduleKind; label: string }[] = [
    { value: 'once', label: 'Custom range' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');
// <input type="datetime-local"> works in the browser's local time.
const toLocalInput = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface Draft {
    id?: string;
    label: string;
    kind: ScheduleKind;
    action: ScheduleAction;
    enabled: boolean;
    features: AiFeature[];
    startAt: string;
    endAt: string;
    startTime: string;
    endTime: string;
    days: number[];
}

const blank = (): Draft => ({
    label: '',
    kind: 'daily',
    action: 'off_during',
    enabled: true,
    features: [],
    startAt: '',
    endAt: '',
    startTime: '22:00',
    endTime: '09:00',
    days: [],
});

function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'h-9 min-w-9 rounded-md border px-3 text-sm font-medium transition-colors',
                active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
            )}
        >
            {children}
        </button>
    );
}

// Mounted only while the dialog is open, so the draft always starts from the schedule being edited.
function ScheduleForm({
    schedule,
    saving,
    onCancel,
    onSave,
}: {
    schedule: AiSchedule | null; // null = new
    saving: boolean;
    onCancel: () => void;
    onSave: (s: AiSchedule) => void;
}) {
    const [error, setError] = useState('');
    const [d, setD] = useState<Draft>(() =>
            schedule
                ? {
                      id: schedule.id,
                      label: schedule.label,
                      kind: schedule.kind,
                      action: schedule.action,
                      enabled: schedule.enabled,
                      features: schedule.features,
                      startAt: toLocalInput(schedule.startAt),
                      endAt: toLocalInput(schedule.endAt),
                      startTime: schedule.startTime || '22:00',
                      endTime: schedule.endTime || '09:00',
                      days: schedule.days,
                  }
                : blank(),
    );

    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
    const toggleDay = (n: number) => set('days', d.days.includes(n) ? d.days.filter((x) => x !== n) : [...d.days, n]);
    const toggleFeature = (f: AiFeature) => set('features', d.features.includes(f) ? d.features.filter((x) => x !== f) : [...d.features, f]);

    const submit = () => {
        if (d.kind === 'once') {
            if (!d.startAt || !d.endAt) return setError('Choose a start and an end.');
            if (new Date(d.endAt) <= new Date(d.startAt)) return setError('The end must be after the start.');
        } else if (d.kind !== 'daily' && d.days.length === 0) {
            return setError(d.kind === 'weekly' ? 'Pick at least one weekday.' : 'Pick at least one day of the month.');
        }
        setError('');
        onSave({
            id: d.id ?? '',
            label: d.label.trim(),
            kind: d.kind,
            action: d.action,
            enabled: d.enabled,
            features: d.features,
            startAt: d.kind === 'once' ? new Date(d.startAt).toISOString() : null,
            endAt: d.kind === 'once' ? new Date(d.endAt).toISOString() : null,
            startTime: d.startTime,
            endTime: d.endTime,
            days: d.kind === 'once' || d.kind === 'daily' ? [] : d.days,
        });
    };

    return (
        <>
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="ai-sched-label">Name (optional)</Label>
                        <Input id="ai-sched-label" value={d.label} maxLength={80} placeholder="e.g. Night break, Friday off" onChange={(e) => set('label', e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label>What should happen</Label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {(
                                [
                                    ['off_during', 'Turn AI off during this time', 'AI works normally at all other times.'],
                                    ['only_on', 'Turn AI on only during this time', 'AI stays off at every other time.'],
                                ] as const
                            ).map(([value, title, hint]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => set('action', value)}
                                    aria-pressed={d.action === value}
                                    className={cn('rounded-lg border p-3 text-left transition-colors', d.action === value ? 'border-primary bg-primary/5' : 'hover:bg-accent')}
                                >
                                    <p className="text-sm font-medium">{title}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Repeat</Label>
                        <div className="flex flex-wrap gap-2">
                            {KINDS.map((k) => (
                                <Chip key={k.value} active={d.kind === k.value} onClick={() => set('kind', k.value)}>
                                    {k.label}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    {d.kind === 'once' ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="ai-sched-from">From</Label>
                                <Input id="ai-sched-from" type="datetime-local" value={d.startAt} onChange={(e) => set('startAt', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ai-sched-to">Until</Label>
                                <Input id="ai-sched-to" type="datetime-local" value={d.endAt} onChange={(e) => set('endAt', e.target.value)} />
                            </div>
                            <p className="text-xs text-muted-foreground sm:col-span-2">Uses your device’s time zone.</p>
                        </div>
                    ) : (
                        <>
                            {d.kind === 'weekly' && (
                                <div className="space-y-2">
                                    <Label>Days of the week</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {WEEKDAYS.map((w, i) => (
                                            <Chip key={w} active={d.days.includes(i)} onClick={() => toggleDay(i)}>
                                                {w}
                                            </Chip>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {d.kind === 'monthly' && (
                                <div className="space-y-2">
                                    <Label>Days of the month</Label>
                                    <div className="grid grid-cols-7 gap-1.5">
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                                            <Chip key={n} active={d.days.includes(n)} onClick={() => toggleDay(n)}>
                                                {n}
                                            </Chip>
                                        ))}
                                    </div>
                                    <Chip active={d.days.includes(0)} onClick={() => toggleDay(0)}>
                                        Last day of the month
                                    </Chip>
                                </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="ai-sched-start">From</Label>
                                    <Input id="ai-sched-start" type="time" value={d.startTime} onChange={(e) => set('startTime', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ai-sched-end">Until</Label>
                                    <Input id="ai-sched-end" type="time" value={d.endTime} onChange={(e) => set('endTime', e.target.value)} />
                                </div>
                                <p className="text-xs text-muted-foreground sm:col-span-2">
                                    Same “from” and “until” = the whole day. An earlier “until” (e.g. 22:00 → 09:00) runs past midnight. Uses the time zone set on this page.
                                </p>
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <Label>Applies to</Label>
                        <div className="flex flex-wrap gap-2">
                            <Chip active={d.features.length === 0} onClick={() => set('features', [])}>
                                All AI
                            </Chip>
                            {AI_FEATURES.map((f) => (
                                <Chip key={f} active={d.features.includes(f)} onClick={() => toggleFeature(f)}>
                                    {FEATURE_META[f].title}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                        <div>
                            <p className="text-sm font-medium">Schedule is active</p>
                            <p className="text-xs text-muted-foreground">Switch off to keep it saved without applying it.</p>
                        </div>
                        <Switch checked={d.enabled} onCheckedChange={(v) => set('enabled', v)} aria-label="Schedule is active" />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={saving}>
                        {saving && <Loader className="mr-2 size-4 animate-spin" />}
                        Save schedule
                    </Button>
                </DialogFooter>
        </>
    );
}

export function ScheduleDialog({
    open,
    onOpenChange,
    schedule,
    saving,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedule: AiSchedule | null;
    saving: boolean;
    onSave: (s: AiSchedule) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{schedule ? 'Edit schedule' : 'New schedule'}</DialogTitle>
                    <DialogDescription>Decide when the AI is switched off — or when it is allowed to work.</DialogDescription>
                </DialogHeader>
                <ScheduleForm schedule={schedule} saving={saving} onCancel={() => onOpenChange(false)} onSave={onSave} />
            </DialogContent>
        </Dialog>
    );
}
