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
    lowConfidence: boolean;
    lowConfidenceBelow: number;
    matches: KnowledgeTestMatch[];
}

export const knowledgeBaseApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getKnowledgeChunks: builder.query<KnowledgeChunk[], void>({
            query: () => '/support/knowledge-base',
            transformResponse: (res: { data: KnowledgeChunk[] }) => res.data ?? [],
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
        getKnowledgeGaps: builder.query<KnowledgeGap[], void>({
            query: () => '/support/knowledge-base/gaps',
            transformResponse: (res: { data: KnowledgeGap[] }) => res.data ?? [],
            providesTags: ['KnowledgeBase'],
        }),
        deleteKnowledgeGap: builder.mutation<void, string>({
            query: (id) => ({ url: `/support/knowledge-base/gaps/${id}`, method: 'DELETE' }),
            invalidatesTags: ['KnowledgeBase'],
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
    useGetKnowledgeChunksQuery,
    useCreateKnowledgeChunkMutation,
    useUpdateKnowledgeChunkMutation,
    useDeleteKnowledgeChunkMutation,
    useGetKnowledgeGapsQuery,
    useDeleteKnowledgeGapMutation,
    useTestKnowledgeBaseMutation,
} = knowledgeBaseApi;
