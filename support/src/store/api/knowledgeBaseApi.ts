import { baseApi } from './baseApi';

export interface KnowledgeChunk {
    id: string;
    text: string;
    source: string | null;
    createdAt: string;
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
} = knowledgeBaseApi;
