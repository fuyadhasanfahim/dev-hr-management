'use client';

import { useSession } from '@/lib/auth-client';
import { useGetMyPermissionsQuery } from '@/redux/features/me/meApi';

const has = (perms: string[], key: string) => perms.includes('*') || perms.includes(key) || perms.includes(`${key.split('.')[0]}.*`);

/** Who the signed-in agent is, for the inbox's assignment rules (the server enforces them too). */
export function useSupportAgent() {
    const { data: session } = useSession();
    const permissions = useGetMyPermissionsQuery().data?.permissions ?? [];
    return {
        id: session?.user.id ?? null,
        canAccess: has(permissions, 'support.access'),
        canManage: has(permissions, 'support.manage'),
    };
}
