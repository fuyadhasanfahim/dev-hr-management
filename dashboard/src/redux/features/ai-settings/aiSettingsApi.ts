import { apiSlice } from '@/redux/api/apiSlice';

export const AI_FEATURES = ['whatsapp', 'web_chat', 'chat_summary'] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export type ScheduleKind = 'once' | 'daily' | 'weekly' | 'monthly';
export type ScheduleAction = 'off_during' | 'only_on';

export interface AiSchedule {
    id: string;
    label: string;
    kind: ScheduleKind;
    action: ScheduleAction;
    enabled: boolean;
    features: AiFeature[]; // empty = every AI
    startAt?: string | null;
    endAt?: string | null;
    startTime?: string;
    endTime?: string;
    days: number[];
}

export interface AiSettings {
    masterMode: 'on' | 'off';
    timezone: string;
    features: Record<AiFeature, { enabled: boolean }>;
    autoResume: { enabled: boolean; minutes: number };
    pauseOnAgentReply: boolean;
    schedules: AiSchedule[];
    updatedBy?: { id: string; name: string } | null;
    updatedAt?: string;
}

export interface AiStatus {
    active: boolean;
    reason: 'env' | 'master' | 'feature' | 'schedule' | 'outside_hours' | null;
    detail?: string;
    nextChangeAt: string | null;
}

export interface AiSnapshot {
    settings: AiSettings;
    status: Record<AiFeature, AiStatus>;
}

export type AiSettingsPatch = Partial<{
    masterMode: 'on' | 'off';
    timezone: string;
    features: Partial<Record<AiFeature, { enabled: boolean }>>;
    autoResume: Partial<{ enabled: boolean; minutes: number }>;
    pauseOnAgentReply: boolean;
    schedules: AiSchedule[];
}>;

export const aiSettingsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getAiSettings: builder.query<AiSnapshot, void>({
            query: () => '/ai-settings',
            transformResponse: (res: { data: AiSnapshot }) => res.data,
            providesTags: ['AiSettings'],
        }),
        updateAiSettings: builder.mutation<AiSnapshot, AiSettingsPatch>({
            query: (body) => ({ url: '/ai-settings', method: 'PUT', body }),
            transformResponse: (res: { data: AiSnapshot }) => res.data,
            invalidatesTags: ['AiSettings'],
        }),
    }),
});

export const { useGetAiSettingsQuery, useUpdateAiSettingsMutation } = aiSettingsApi;
