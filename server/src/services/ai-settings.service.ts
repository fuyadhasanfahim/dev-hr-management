import { randomUUID } from 'node:crypto';
import AiSettingsModel, {
    AI_FEATURES,
    type AiFeature,
    type IAiSchedule,
    type IAiSettings,
} from '../models/ai-settings.model.js';

export { AI_FEATURES, type AiFeature };

export type AiOffReason = 'env' | 'master' | 'feature' | 'schedule' | 'outside_hours';
export interface AiStatus {
    active: boolean;
    reason: AiOffReason | null;
    detail?: string; // schedule label, when reason is schedule
    nextChangeAt: string | null; // when the on/off state next flips (looked ahead 7 days)
}

export class AiSettingsError extends Error {}

type Plain = Omit<IAiSettings, 'updatedBy'> & { updatedBy?: { id: string; name: string } | null; updatedAt?: Date };

const DEFAULTS: Plain = {
    key: 'global',
    masterMode: 'on',
    timezone: 'Asia/Dhaka',
    features: { whatsapp: { enabled: true }, web_chat: { enabled: true }, chat_summary: { enabled: true } },
    autoResume: { enabled: true, minutes: 5 },
    pauseOnAgentReply: true,
    schedules: [],
    updatedBy: null,
};

// ─── settings (cached briefly so the hot path — every WhatsApp message — stays cheap) ───

const CACHE_MS = 10_000;
let cache: { value: Plain; at: number } | null = null;

function normalise(doc: any): Plain {
    const o = doc ? (doc.toObject?.() ?? doc) : {};
    return {
        ...DEFAULTS,
        ...o,
        features: {
            whatsapp: { enabled: o.features?.whatsapp?.enabled ?? true },
            web_chat: { enabled: o.features?.web_chat?.enabled ?? true },
            chat_summary: { enabled: o.features?.chat_summary?.enabled ?? true },
        },
        autoResume: { enabled: o.autoResume?.enabled ?? true, minutes: o.autoResume?.minutes ?? 5 },
        pauseOnAgentReply: o.pauseOnAgentReply ?? true,
        schedules: (o.schedules ?? []).map((s: any) => ({ ...s })),
    };
}

export async function getSettings(): Promise<Plain> {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
    // A failure to read settings must never take the AI (or the inbox) down: fall back to the last good copy.
    try {
        const doc = await AiSettingsModel.findOne({ key: 'global' });
        cache = { value: normalise(doc), at: Date.now() };
    } catch {
        cache = { value: cache?.value ?? DEFAULTS, at: Date.now() };
    }
    return cache.value;
}

// ─── time helpers ───

const formatters = new Map<string, Intl.DateTimeFormat>();
function zoned(date: Date, timeZone: string) {
    let f = formatters.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            weekday: 'short',
        });
        formatters.set(timeZone, f);
    }
    const p: Record<string, string> = {};
    for (const part of f.formatToParts(date)) p[part.type] = part.value;
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday!);
    const year = Number(p.year);
    const month = Number(p.month);
    return {
        minutes: Number(p.hour) * 60 + Number(p.minute),
        weekday,
        day: Number(p.day),
        daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    };
}

const toMinutes = (hhmm: string | undefined) => {
    const [h, m] = (hhmm ?? '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

function dayMatches(s: IAiSchedule, z: ReturnType<typeof zoned>): boolean {
    if (s.kind === 'daily') return true;
    if (s.kind === 'weekly') return s.days.includes(z.weekday);
    return s.days.includes(z.day) || (s.days.includes(0) && z.day === z.daysInMonth);
}

function windowActive(s: IAiSchedule, at: Date, tz: string): boolean {
    if (s.kind === 'once') {
        return !!s.startAt && !!s.endAt && s.startAt.getTime() <= at.getTime() && at.getTime() < s.endAt.getTime();
    }
    const start = toMinutes(s.startTime);
    const end = toMinutes(s.endTime);
    const now = zoned(at, tz);
    if (start === end) return dayMatches(s, now); // all day
    if (start < end) return dayMatches(s, now) && now.minutes >= start && now.minutes < end;
    // Runs past midnight: the evening part belongs to today, the morning part to yesterday's run.
    if (now.minutes >= start) return dayMatches(s, now);
    return now.minutes < end && dayMatches(s, zoned(new Date(at.getTime() - 24 * 3600_000), tz));
}

export function evaluateAt(settings: Plain, feature: AiFeature, at: Date): Omit<AiStatus, 'nextChangeAt'> {
    if (settings.masterMode === 'off') return { active: false, reason: 'master' };
    if (!settings.features[feature]?.enabled) return { active: false, reason: 'feature' };

    const rules = settings.schedules.filter((s) => s.enabled && (!s.features?.length || s.features.includes(feature)));
    const hit = rules.find((s) => s.action === 'off_during' && windowActive(s, at, settings.timezone));
    if (hit) return { active: false, reason: 'schedule', detail: hit.label || undefined };

    const onlyOn = rules.filter((s) => s.action === 'only_on');
    if (onlyOn.length && !onlyOn.some((s) => windowActive(s, at, settings.timezone))) {
        return { active: false, reason: 'outside_hours' };
    }
    return { active: true, reason: null };
}

function nextChange(settings: Plain, feature: AiFeature, now: Date, current: boolean): string | null {
    if (settings.masterMode === 'off' || !settings.features[feature]?.enabled) return null;
    if (!settings.schedules.some((s) => s.enabled)) return null;
    for (let i = 1; i <= 7 * 24 * 60; i++) {
        const t = new Date(now.getTime() + i * 60_000);
        if (evaluateAt(settings, feature, t).active !== current) return t.toISOString();
    }
    return null;
}

// ─── the gate every AI entry point goes through ───

/** True when this AI may answer right now. Never throws. */
export async function isAiActive(feature: AiFeature): Promise<boolean> {
    if (process.env.WHATSAPP_AI_DISABLED === '1' && feature === 'whatsapp') return false; // legacy hard kill switch
    return evaluateAt(await getSettings(), feature, new Date()).active;
}

export async function getStatus(): Promise<Record<AiFeature, AiStatus>> {
    const settings = await getSettings();
    const now = new Date();
    const out = {} as Record<AiFeature, AiStatus>;
    for (const f of AI_FEATURES) {
        const r =
            process.env.WHATSAPP_AI_DISABLED === '1' && f === 'whatsapp'
                ? ({ active: false, reason: 'env' } as const)
                : evaluateAt(settings, f, now);
        out[f] = { ...r, nextChangeAt: nextChange(settings, f, now, r.active) };
    }
    return out;
}

/** When an agent has just replied: should the chat's AI switch off, and when does it come back? */
export async function agentReplyPolicy(from = new Date()): Promise<{ pause: boolean; resumeAt: Date | null }> {
    const s = await getSettings();
    if (!s.pauseOnAgentReply) return { pause: false, resumeAt: null };
    return {
        pause: true,
        resumeAt: s.autoResume.enabled ? new Date(from.getTime() + s.autoResume.minutes * 60_000) : null,
    };
}

export async function isAutoResumeEnabled(): Promise<boolean> {
    return (await getSettings()).autoResume.enabled;
}

// ─── updates ───

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanSchedule(raw: any): IAiSchedule {
    const kind = raw?.kind;
    if (!['once', 'daily', 'weekly', 'monthly'].includes(kind)) throw new AiSettingsError('Invalid schedule type');
    const action = raw.action === 'only_on' ? 'only_on' : 'off_during';
    const features = (Array.isArray(raw.features) ? raw.features : []).filter((f: any) => AI_FEATURES.includes(f));
    const base = {
        id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : randomUUID(),
        label: String(raw.label ?? '').slice(0, 80),
        kind,
        action,
        enabled: raw.enabled !== false,
        features,
        days: [] as number[],
    } as IAiSchedule;

    if (kind === 'once') {
        const startAt = new Date(raw.startAt);
        const endAt = new Date(raw.endAt);
        if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) throw new AiSettingsError('Choose a valid start and end');
        if (endAt <= startAt) throw new AiSettingsError('End must be after start');
        return { ...base, startAt, endAt };
    }

    if (!HHMM.test(raw.startTime ?? '') || !HHMM.test(raw.endTime ?? '')) throw new AiSettingsError('Use HH:mm times');
    const days = [...new Set<number>((Array.isArray(raw.days) ? raw.days : []).map(Number))].filter((d) =>
        kind === 'weekly' ? d >= 0 && d <= 6 : kind === 'monthly' ? d >= 0 && d <= 31 : false,
    );
    if (kind !== 'daily' && days.length === 0) throw new AiSettingsError('Pick at least one day');
    return { ...base, startTime: raw.startTime, endTime: raw.endTime, days: days as number[] };
}

export async function updateSettings(patch: any, user: { id: string; name: string }): Promise<Plain> {
    const current = await getSettings();
    const next: Plain = { ...current };

    if (patch.masterMode !== undefined) {
        if (!['on', 'off'].includes(patch.masterMode)) throw new AiSettingsError('masterMode must be on or off');
        next.masterMode = patch.masterMode;
    }
    if (patch.timezone !== undefined) {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: String(patch.timezone) });
        } catch {
            throw new AiSettingsError('Unknown timezone');
        }
        next.timezone = String(patch.timezone);
    }
    if (patch.features) {
        next.features = { ...current.features };
        for (const f of AI_FEATURES) {
            if (typeof patch.features[f]?.enabled === 'boolean') next.features[f] = { enabled: patch.features[f].enabled };
        }
    }
    if (patch.autoResume) {
        const minutes = patch.autoResume.minutes !== undefined ? Number(patch.autoResume.minutes) : current.autoResume.minutes;
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new AiSettingsError('Minutes must be 1–1440');
        next.autoResume = {
            enabled: typeof patch.autoResume.enabled === 'boolean' ? patch.autoResume.enabled : current.autoResume.enabled,
            minutes,
        };
    }
    if (typeof patch.pauseOnAgentReply === 'boolean') next.pauseOnAgentReply = patch.pauseOnAgentReply;
    if (patch.schedules !== undefined) {
        if (!Array.isArray(patch.schedules) || patch.schedules.length > 50) throw new AiSettingsError('Too many schedules');
        next.schedules = patch.schedules.map(cleanSchedule);
    }

    const saved = await AiSettingsModel.findOneAndUpdate(
        { key: 'global' },
        {
            masterMode: next.masterMode,
            timezone: next.timezone,
            features: next.features,
            autoResume: next.autoResume,
            pauseOnAgentReply: next.pauseOnAgentReply,
            schedules: next.schedules,
            key: 'global',
            updatedBy: { id: user.id, name: user.name },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Turning auto-resume off cancels every countdown already running.
    if (!next.autoResume.enabled && current.autoResume.enabled) {
        const { default: Conv } = await import('../models/whatsapp-conversation.model.js');
        await Conv.updateMany({ aiResumeAt: { $ne: null } }, { $set: { aiResumeAt: null } });
    }

    cache = { value: normalise(saved), at: Date.now() };
    return cache.value;
}

export default { getSettings, updateSettings, getStatus, isAiActive, agentReplyPolicy, isAutoResumeEnabled };
