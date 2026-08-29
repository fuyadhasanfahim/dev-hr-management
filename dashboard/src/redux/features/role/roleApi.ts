import { apiSlice } from '@/redux/api/apiSlice';

export interface RoleDoc {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    permissions: string[];
    isSystem: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CatalogPermission {
    key: string;
    action: string;
    label: string;
}

export interface CatalogGroup {
    resource: string;
    label: string;
    permissions: CatalogPermission[];
}

export interface PermissionCatalog {
    groups: CatalogGroup[];
    all: string[];
}

interface CreateRoleBody {
    name: string;
    slug?: string;
    description?: string;
    permissions: string[];
}

type UpdateRoleBody = Partial<{
    name: string;
    description: string;
    permissions: string[];
    isActive: boolean;
}>;

interface AssignUserAccessBody {
    role?: string;
    extraPermissions?: string[];
    deniedPermissions?: string[];
}

export const roleApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getRoles: builder.query<RoleDoc[], void>({
            query: () => '/roles',
            transformResponse: (res: { data: RoleDoc[] }) => res.data,
            providesTags: ['Role'],
        }),
        getPermissionCatalog: builder.query<PermissionCatalog, void>({
            query: () => '/roles/catalog',
            transformResponse: (res: { data: PermissionCatalog }) => res.data,
        }),
        createRole: builder.mutation<RoleDoc, CreateRoleBody>({
            query: (body) => ({ url: '/roles', method: 'POST', body }),
            transformResponse: (res: { data: RoleDoc }) => res.data,
            invalidatesTags: ['Role'],
        }),
        updateRole: builder.mutation<
            RoleDoc,
            { slug: string; body: UpdateRoleBody }
        >({
            query: ({ slug, body }) => ({
                url: `/roles/${slug}`,
                method: 'PATCH',
                body,
            }),
            transformResponse: (res: { data: RoleDoc }) => res.data,
            // a role's permissions changed -> the current user's resolved
            // permissions may have too
            invalidatesTags: ['Role', 'MyPermissions'],
        }),
        deleteRole: builder.mutation<{ slug: string }, string>({
            query: (slug) => ({ url: `/roles/${slug}`, method: 'DELETE' }),
            invalidatesTags: ['Role'],
        }),
        assignUserAccess: builder.mutation<
            unknown,
            { userId: string; body: AssignUserAccessBody }
        >({
            query: ({ userId, body }) => ({
                url: `/roles/users/${userId}/access`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['MyPermissions', 'User', 'Staff'],
        }),
    }),
});

export const {
    useGetRolesQuery,
    useGetPermissionCatalogQuery,
    useCreateRoleMutation,
    useUpdateRoleMutation,
    useDeleteRoleMutation,
    useAssignUserAccessMutation,
} = roleApi;
