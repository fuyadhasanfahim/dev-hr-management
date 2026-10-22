import { baseApi } from './baseApi';

export interface KnowledgeChunk {
    id: string;
    text: string;
    source: string | null;
    createdByName: string | null;
    createdAt: string;
}

export interface KnowledgeGap {
    id: string;
    question: string;
    reason: 'escalated' | 'low_confidence';
    topScore: number | null;
    count: number;
    lastAskedAt: string;
}

export interface KnowledgeTestMatch {
    id: string;
    text: string;
    source: string | null;
    score: number; // cosine similarity, 0-1
}

export interface KnowledgeTestResult {
    reply: string;
    escalate: boolean;
    escalateReason: string | null;
    stage: string;
    stageReason: string;
    priceAllowed: boolean;
    lowConfidence: boolean;
    lowConfidenceBelow: number;
    matches: KnowledgeTestMatch[];
}

export interface AiReply {
    id: string;
    conversationId: string | null;
    customerName: string | null;
    customerMessage: string;
    context: string | null;
    aiReply: string;
    escalated: boolean;
    topScore: number | null;
    sources: string[];
    status: 'ok' | 'corrected';
    createdAt: string;
}

export interface AiExample {
    id: string;
    kind: 'qa' | 'correction' | 'agent';
    question: string;
    context: string | null;
    answer: string;
    badAnswer: string | null;
    approved: boolean;
    agentName: string | null;
    createdByName: string | null;
    createdAt: string;
}

export interface PageMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface Paged<T> {
    items: T[];
    meta: PageMeta;
}
export interface PageArgs {
    page: number;
    limit: number;
    q?: string;
}
export interface KnowledgeStats {
    total: number; // knowledge entries
    chars: number;
    over: number;
    rules: number;
    gaps: number;
    replies: number;
    repliesCorrected: number;
    taught: number;
    humanNew: number;
    humanTaught: number;
}

const EMPTY_META: PageMeta = { page: 1, limit: 20, total: 0, totalPages: 1 };
const paged = <T>(res: { data?: T[]; meta?: PageMeta }): Paged<T> => ({ items: res.data ?? [], meta: res.meta ?? EMPTY_META });
const qs = (args: Record<string, string | number | boolean | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(args)) if (v !== undefined && v !== '') p.set(k, String(v));
    return p.toString();
};

export const knowledgeBaseApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getKnowledgeStats: builder.query<KnowledgeStats, void>({
            query: () => '/support/knowledge-base/stats',
            transformResponse: (res: { data: KnowledgeStats }) => res.data,
            providesTags: ['KnowledgeBase', 'AiLearning'],
        }),
        getKnowledgeChunks: builder.query<Paged<KnowledgeChunk>, PageArgs>({
            query: (args) => `/support/knowledge-base?${qs({ ...args })}`,
            transformResponse: paged<KnowledgeChunk>,
            providesTags: ['KnowledgeBase'],
        }),
        createKnowledgeChunk: builder.mutation<KnowledgeChunk, { text: string; source?: string }>({
            query: (body) => ({
                url: '/support/knowledge-base',
                method: 'POST',
                body,
            }),
            transformResponse: (res: { data: KnowledgeChunk }) => res.data,
            invalidatesTags: ['KnowledgeBase'],
        }),
        updateKnowledgeChunk: builder.mutation<KnowledgeChunk, { id: string; text: string; source?: string }>({
            query: ({ id, ...body }) => ({
                url: `/support/knowledge-base/${id}`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (res: { data: KnowledgeChunk }) => res.data,
            invalidatesTags: ['KnowledgeBase'],
        }),
        // Questions the AI escalated or had no good knowledge for — staff turn them into entries.
        getKnowledgeGaps: builder.query<Paged<KnowledgeGap>, PageArgs>({
            query: (args) => `/support/knowledge-base/gaps?${qs({ ...args })}`,
            transformResponse: paged<KnowledgeGap>,
            providesTags: ['KnowledgeBase'],
        }),
        deleteKnowledgeGap: builder.mutation<void, string>({
            query: (id) => ({ url: `/support/knowledge-base/gaps/${id}`, method: 'DELETE' }),
            invalidatesTags: ['KnowledgeBase'],
        }),
        // Staff write the reply for an unanswered question; the AI uses it from now on.
        answerKnowledgeGap: builder.mutation<AiExample, { id: string; reply: string }>({
            query: ({ id, reply }) => ({ url: `/support/knowledge-base/gaps/${id}/answer`, method: 'POST', body: { reply } }),
            invalidatesTags: ['KnowledgeBase', 'AiLearning'],
        }),
        getAiReplies: builder.query<Paged<AiReply>, PageArgs & { status?: 'ok' | 'corrected' }>({
            query: (args) => `/support/knowledge-base/replies?${qs({ ...args })}`,
            transformResponse: paged<AiReply>,
            providesTags: ['AiLearning'],
        }),
        correctAiReply: builder.mutation<AiExample, { id: string; reply: string }>({
            query: ({ id, reply }) => ({ url: `/support/knowledge-base/replies/${id}/correct`, method: 'POST', body: { reply } }),
            invalidatesTags: ['AiLearning'],
        }),
        // kind 'taught' = everything staff wrote or corrected (not the human-agent replies).
        getAiExamples: builder.query<Paged<AiExample>, PageArgs & { kind?: AiExample['kind'] | 'taught'; approved?: boolean }>({
            query: (args) => `/support/knowledge-base/examples?${qs({ ...args })}`,
            transformResponse: paged<AiExample>,
            providesTags: ['AiLearning'],
        }),
        createAiExample: builder.mutation<AiExample, { question: string; reply: string }>({
            query: (body) => ({ url: '/support/knowledge-base/examples', method: 'POST', body }),
            invalidatesTags: ['AiLearning'],
        }),
        updateAiExample: builder.mutation<AiExample, { id: string; question?: string; reply?: string; approved?: boolean }>({
            query: ({ id, ...body }) => ({ url: `/support/knowledge-base/examples/${id}`, method: 'PATCH', body }),
            invalidatesTags: ['AiLearning'],
        }),
        deleteAiExample: builder.mutation<void, string>({
            query: (id) => ({ url: `/support/knowledge-base/examples/${id}`, method: 'DELETE' }),
            invalidatesTags: ['AiLearning'],
        }),
        draftStyleGuide: builder.mutation<{ text: string }, void>({
            query: () => ({ url: '/support/knowledge-base/examples/style-guide', method: 'POST' }),
            transformResponse: (res: { data: { text: string } }) => res.data,
        }),
        // Runs the real AI on a question (nothing is saved) and returns what it read.
        testKnowledgeBase: builder.mutation<KnowledgeTestResult, string>({
            query: (message) => ({ url: '/support/knowledge-base/test', method: 'POST', body: { message } }),
            transformResponse: (res: { data: KnowledgeTestResult }) => res.data,
        }),
        deleteKnowledgeChunk: builder.mutation<void, string>({
            query: (id) => ({
                url: `/support/knowledge-base/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['KnowledgeBase'],
        }),
    }),
});

export const {
    useGetKnowledgeStatsQuery,
    useGetKnowledgeChunksQuery,
    useCreateKnowledgeChunkMutation,
    useUpdateKnowledgeChunkMutation,
    useDeleteKnowledgeChunkMutation,
    useGetKnowledgeGapsQuery,
    useDeleteKnowledgeGapMutation,
    useTestKnowledgeBaseMutation,
    useAnswerKnowledgeGapMutation,
    useGetAiRepliesQuery,
    useCorrectAiReplyMutation,
    useGetAiExamplesQuery,
    useCreateAiExampleMutation,
    useUpdateAiExampleMutation,
    useDeleteAiExampleMutation,
    useDraftStyleGuideMutation,
} = knowledgeBaseApi;
