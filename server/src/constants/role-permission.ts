/**
 * Phase 1 — Default permission sets for the five built-in ("system") roles.
 *
 * These are reverse-engineered from the current hard-coded `authorize(...)`
 * / `restrictTo(...)` guards on the routes, so seeding them preserves
 * today's behaviour exactly. After seeding, an admin can edit any of these
 * roles from the UI (except their slug / `isSystem` flag) or create new
 * roles entirely.
 *
 * Wildcards (`resource.*`, `*`) are expanded by the resolver in Phase 2.
 */

import { Role } from './role.js';

/** Slug -> permission list for each built-in role. */
export const SYSTEM_ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
    [Role.SUPER_ADMIN]: ['*'],

    [Role.ADMIN]: [
        'order.*',
        'quotation.*',
        'receipt.*',
        'invoice.*',
        'client.*',
        'lead.*',
        'leadSetting.*',
        'staff.*',
        'attendance.*',
        'leave.*',
        'shift.*',
        'payroll.*',
        'expense.*',
        'earning.*',
        'debit.*',
        'profitShare.*',
        'department.*',
        'designation.*',
        'branch.*',
        'policy.*',
        'notice.*',
        'meeting.*',
        'task.*',
        'project.*',
        'service.*',
        'consultation.*',
        'career.*',
        'externalBusiness.*',
        'analytics.*',
        'dashboard.*',
        'notification.*',
        'invitation.*',
        'outbox.*', // Phase 6d — was OUTBOX_ADMIN_ROLES
        // Role administration stays with super_admin only by default.
    ],

    [Role.HR_MANAGER]: [
        'staff.*',
        'attendance.*',
        'leave.*',
        'shift.*',
        'department.*',
        'designation.*',
        'payroll.*',
        'expense.*',
        'earning.*',
        'debit.*',
        'policy.*',
        'notice.*',
        'invitation.*',
        'career.*', // recruiting is an HR function — job positions + applications
        'branch.*', // Phase 6d — branch write routes allowed HR
        'client.*', // Phase 6d — authorizeTelemarketer allowed HR all client ops
        'meeting.read',
        'task.*', // Phase 6d — HR was in ADMIN_LEAD_ROLES (task create/review/delete)
        'analytics.read',
        'dashboard.read',
        'notification.read',
        // Phase 6d — HR was in quotation/order STAFF_ROLES
        'quotation.read',
        'quotation.create',
        'quotation.update',
        'order.read',
        'order.create',
        'order.assign',
        'order.changeStatus',
    ],

    [Role.TEAM_LEADER]: [
        'task.*',
        'order.read',
        'order.assign',
        'order.changeStatus',
        'order.create', // Phase 6d — convert-quotation was in STAFF_ROLES
        'project.read',
        'client.read',
        'attendance.read',
        'leave.apply',
        'leave.read',
        'shift.read',
        'shift.assign',
        'shift.create', // Phase 6d — shift create/list allowed TL
        'meeting.read',
        'notice.read',
        'dashboard.read',
        'notification.read',
        // Phase 6d — TL was in RECEIPT_ROLES / MEETING_ROLES / quotation
        // STAFF_ROLES / payroll readAccess / expense summary
        'receipt.read',
        'receipt.create',
        'receipt.update',
        'meeting.create',
        'meeting.update',
        'meeting.delete',
        'quotation.read',
        'quotation.create',
        'quotation.update',
        'payroll.read',
        'expense.read',
    ],

    [Role.STAFF]: [
        'dashboard.read',
        'task.read',
        'task.update',
        'attendance.read',
        'leave.apply',
        'leave.read',
        'notice.read',
        'meeting.read',
        'order.read',
        'project.read',
        'policy.read',
        'notification.read',
        // Phase 6d — STAFF was in order/quotation STAFF_ROLES and the
        // expense-summary + payroll-preview allow-lists
        'order.create',
        'order.assign',
        'order.changeStatus',
        'quotation.read',
        'quotation.create',
        'quotation.update',
        'expense.read',
    ],
};

export interface SystemRoleSeed {
    slug: Role;
    name: string;
    description: string;
    permissions: readonly string[];
}

/** Ordered list consumed by `scripts/seed-roles.ts`. */
export const SYSTEM_ROLES: readonly SystemRoleSeed[] = [
    {
        slug: Role.SUPER_ADMIN,
        name: 'Super Admin',
        description: 'Full, unrestricted access to every part of the system.',
        permissions: SYSTEM_ROLE_PERMISSIONS[Role.SUPER_ADMIN],
    },
    {
        slug: Role.ADMIN,
        name: 'Admin',
        description: 'Company-wide operational access. Cannot manage roles by default.',
        permissions: SYSTEM_ROLE_PERMISSIONS[Role.ADMIN],
    },
    {
        slug: Role.HR_MANAGER,
        name: 'HR Manager',
        description: 'People operations: staff, attendance, leave, shifts, payroll and HR finance.',
        permissions: SYSTEM_ROLE_PERMISSIONS[Role.HR_MANAGER],
    },
    {
        slug: Role.TEAM_LEADER,
        name: 'Team Leader',
        description: 'Leads a team: full task control plus read access to orders and projects.',
        permissions: SYSTEM_ROLE_PERMISSIONS[Role.TEAM_LEADER],
    },
    {
        slug: Role.STAFF,
        name: 'Staff',
        description: 'Base employee access: own tasks, attendance, leave and read-only visibility.',
        permissions: SYSTEM_ROLE_PERMISSIONS[Role.STAFF],
    },
];

/** Slugs that may never be deleted and whose slug/isSystem cannot change. */
export const SYSTEM_ROLE_SLUGS: ReadonlySet<string> = new Set(
    SYSTEM_ROLES.map((r) => r.slug),
);
