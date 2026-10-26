import { Schema, model } from 'mongoose';

// Every AI feature the control page can switch. Add a key here (and in
// AI_FEATURES below) when a new AI is introduced, then gate it with isAiActive().
export const AI_FEATURES = ['whatsapp', 'web_chat', 'chat_summary'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export type AiScheduleKind = 'once' | 'daily' | 'weekly' | 'monthly';
// off_during  — AI is switched off while the window is active.
// only_on     — AI works only inside the window(s); it is off at every other time.
export type AiScheduleAction = 'off_during' | 'only_on';

export interface IAiSchedule {
    id: string;
    label: string;
    kind: AiScheduleKind;
    action: AiScheduleAction;
    enabled: boolean;
    features: AiFeature[]; // empty = every AI
    startAt?: Date | null; // once
    endAt?: Date | null; // once
    startTime?: string; // "HH:mm" in the settings timezone (daily/weekly/monthly)
    endTime?: string; // equal to startTime = all day; earlier than startTime = runs past midnight
    days: number[]; // weekly: 0=Sun..6=Sat · monthly: 1..31, 0 = last day of month
}

export interface IAiSettings {
    key: 'global';
    masterMode: 'on' | 'off'; // off = permanently off until someone turns it back on
    timezone: string;
    features: Record<AiFeature, { enabled: boolean }>;
    // Website assistant only (the WhatsApp assistant has its own rules): may it open tickets, and does it
    // remember a visitor across chats.
    web: { createTickets: boolean; remember: boolean };
    autoResume: { enabled: boolean; minutes: number }; // AI returns by itself after an agent goes quiet
    pauseOnAgentReply: boolean; // an agent reply switches AI off for that chat
    schedules: IAiSchedule[];
    updatedBy?: { id: string; name: string } | null;
}

const ScheduleSchema = new Schema<IAiSchedule>(
    {
        id: { type: String, required: true },
        label: { type: String, default: '', trim: true, maxlength: 80 },
        kind: { type: String, enum: ['once', 'daily', 'weekly', 'monthly'], required: true },
        action: { type: String, enum: ['off_during', 'only_on'], default: 'off_during' },
        enabled: { type: Boolean, default: true },
        features: { type: [String], default: [] },
        startAt: { type: Date, default: null },
        endAt: { type: Date, default: null },
        startTime: { type: String, default: '00:00' },
        endTime: { type: String, default: '00:00' },
        days: { type: [Number], default: [] },
    },
    { _id: false },
);

const featureDefault = { enabled: { type: Boolean, default: true } };

const AiSettingsSchema = new Schema<IAiSettings>(
    {
        key: { type: String, default: 'global', unique: true },
        masterMode: { type: String, enum: ['on', 'off'], default: 'on' },
        timezone: { type: String, default: 'Asia/Dhaka' },
        features: {
            whatsapp: { type: new Schema(featureDefault, { _id: false }), default: () => ({}) },
            web_chat: { type: new Schema(featureDefault, { _id: false }), default: () => ({}) },
            chat_summary: { type: new Schema(featureDefault, { _id: false }), default: () => ({}) },
        },
        web: {
            createTickets: { type: Boolean, default: true },
            remember: { type: Boolean, default: true },
        },
        autoResume: {
            enabled: { type: Boolean, default: true },
            minutes: { type: Number, default: 5, min: 1, max: 1440 },
        },
        pauseOnAgentReply: { type: Boolean, default: true },
        schedules: { type: [ScheduleSchema], default: [] },
        updatedBy: { type: new Schema({ id: String, name: String }, { _id: false }), default: null },
    },
    { timestamps: true },
);

export default model<IAiSettings>('AiSettings', AiSettingsSchema);
