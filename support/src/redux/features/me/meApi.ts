import { apiSlice } from '@/redux/api/apiSlice';

export interface MyPermissions {
    /** Role slug, or null if the user has none. */
    role: string | null;
    /**
     * Fully-resolved permission keys (wildcards already expanded server-side).
     * `["*"]` means superuser — treat as "everything allowed".
     */
    permissions: string[];
}

export const meApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getMyPermissions: builder.query<MyPermissions, void>({
            query: () => '/me/permissions',
            transformResponse: (res: { success: boolean; data: MyPermissions }) =>
                res.data,
            providesTags: ['MyPermissions'],
        }),
    }),
});

export const { useGetMyPermissionsQuery } = meApi;
