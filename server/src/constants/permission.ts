/**
 * Phase 1 — Permission catalog (RBAC + fine-grained permissions).
 *
 * The catalog of permission *keys* lives in code on purpose:
 *   - API guards (Phase 3) reference typed constants, so a typo is a
 *     compile error instead of a silent security hole.
 *   - Nobody can invent a new permission string by writing to the DB.
 *
 * Roles (stored in the DB, editable at runtime) and per-user overrides
 * (`extraPermissions` / `deniedPermissions` on the Better Auth user) may
 * only ever contain strings that appear here. Anything else is ignored by
 * the resolver (Phase 2).
 *
 * Key format: `resource.action`. The resolver also understands two
 * wildcards:
 *   - `resource.*` — every action on that resource
 *   - `*`          — superuser, every permission
 */

export interface PermissionGroupDef {
    /** Human label for the admin UI section. */
    label: string;
    /** Action suffixes available on this resource. */
    actions: readonly string[];
}

/**
 * Source of truth for every permission in the system, grouped by resource.
 * Add an action here and it is instantly available to roles, the resolver,
 * and the admin permission matrix.
 */
export const PERMISSION_GROUPS = {
    order: {
        label: 'Orders',
        // viewFinancials — see prices / amounts on orders + quotations
        // viewClient     — see client identity (name, email, requirements) on
        //                  orders + quotations
        // Without these the API strips those fields from the response
        // (see utils/masking.ts) — it is not a UI-only mask.
        actions: [
            'read',
            'create',
            'update',
            'delete',
            'assign',
            'changeStatus',
            'viewFinancials',
            'viewClient',
        ],
    },
    quotation: {
        label: 'Quotations',
        actions: ['read', 'create', 'update', 'delete', 'approve', 'convert'],
    },
    receipt: {
        label: 'Receipts',
        actions: ['read', 'create', 'update', 'delete'],
    },
    invoice: {
        label: 'Invoices',
        actions: ['read', 'create', 'update', 'delete', 'void'],
    },
    client: {
        label: 'Clients',
        actions: ['read', 'create', 'update', 'delete'],
    },
    lead: {
        label: 'Leads',
        actions: ['read', 'create', 'update', 'delete', 'assign', 'convert'],
    },
    leadSetting: {
        label: 'Lead Settings',
        actions: ['read', 'manage'],
    },
    staff: {
        label: 'Staff',
        actions: ['read', 'create', 'update', 'delete', 'terminate'],
    },
    attendance: {
        label: 'Attendance',
        actions: ['read', 'manage', 'regularize'],
    },
    leave: {
        label: 'Leave',
        actions: ['read', 'apply', 'approve', 'manage'],
    },
    shift: {
        label: 'Shifts',
        actions: ['read', 'create', 'update', 'delete', 'assign'],
    },
    payroll: {
        label: 'Payroll',
        actions: ['read', 'process', 'run', 'lock', 'bankSettings'],
    },
    expense: {
        label: 'Expenses',
        actions: ['read', 'create', 'update', 'delete'],
    },
    earning: {
        label: 'Earnings',
        actions: ['read', 'create', 'update', 'delete'],
    },
    debit: {
        label: 'Debits',
        actions: ['read', 'create', 'update', 'delete'],
    },
    profitShare: {
        label: 'Profit Share',
        actions: ['read', 'manage'],
    },
    wallet: {
        label: 'Wallet / Balances',
        // read   — see the Balances page (own wallet + transactions)
        // manage — see every staff member's balance, all transactions, and
        //          process admin withdrawals
        actions: ['read', 'manage'],
    },
    returnFileFormat: {
        label: 'Return File Formats',
        actions: ['read', 'manage'],
    },
    department: {
        label: 'Departments',
        actions: ['read', 'manage'],
    },
    designation: {
        label: 'Designations',
        actions: ['read', 'manage'],
    },
    branch: {
        label: 'Branches',
        actions: ['read', 'manage'],
    },
    policy: {
        label: 'Policies',
        actions: ['read', 'manage'],
    },
    notice: {
        label: 'Notices',
        actions: ['read', 'create', 'update', 'delete'],
    },
    meeting: {
        label: 'Meetings',
        actions: ['read', 'create', 'update', 'delete'],
    },
    task: {
        label: 'Tasks',
        actions: ['read', 'create', 'update', 'delete', 'review'],
    },
    project: {
        label: 'Projects',
        actions: ['read', 'create', 'update', 'delete'],
    },
    service: {
        label: 'Services',
        actions: ['read', 'create', 'update', 'delete'],
    },
    consultation: {
        label: 'Consultations',
        actions: ['read', 'create', 'update', 'delete'],
    },
    career: {
        label: 'Careers / Job Positions',
        actions: ['read', 'manage'],
    },
    externalBusiness: {
        label: 'External Business',
        actions: ['read', 'manage'],
    },
    analytics: {
        label: 'Analytics',
        actions: ['read'],
    },
    dashboard: {
        label: 'Dashboard',
        actions: ['read'],
    },
    notification: {
        label: 'Notifications',
        actions: ['read', 'manage'],
    },
    invitation: {
        label: 'Invitations',
        actions: ['read', 'create', 'delete'],
    },
    outbox: {
        label: 'Outbox / Event Log',
        actions: ['read', 'replay'],
    },
    role: {
        label: 'Roles & Permissions',
        // read  — view roles/permissions
        // manage — create / edit / delete roles
        // assign — attach roles or override permissions on a user
        actions: ['read', 'manage', 'assign'],
    },
} as const satisfies Record<string, PermissionGroupDef>;

export type PermissionGroup = keyof typeof PERMISSION_GROUPS;

/** Union of every concrete `resource.action` string in the catalog. */
export type PermissionKey = {
    [G in PermissionGroup]: `${G}.${(typeof PERMISSION_GROUPS)[G]['actions'][number]}`;
}[PermissionGroup];

/** Flat list of every permission key. */
export const ALL_PERMISSIONS: PermissionKey[] = (
    Object.entries(PERMISSION_GROUPS) as [PermissionGroup, PermissionGroupDef][]
).flatMap(([group, def]) =>
    def.actions.map((action) => `${group}.${action}` as PermissionKey),
);

const ALL_PERMISSIONS_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);

/** Superuser wildcard — grants every permission. */
export const WILDCARD_ALL = '*';

/**
 * Default human labels for action suffixes, used by the admin permission
 * matrix. A group may not use every action; unused entries are harmless.
 */
export const ACTION_LABELS: Record<string, string> = {
    read: 'View',
    create: 'Create',
    update: 'Edit',
    delete: 'Delete',
    manage: 'Manage',
    assign: 'Assign',
    approve: 'Approve',
    review: 'Review',
    convert: 'Convert',
    void: 'Void',
    process: 'Process',
    run: 'Run',
    lock: 'Lock',
    regularize: 'Regularize',
    changeStatus: 'Change status',
    bankSettings: 'Bank settings',
    apply: 'Apply',
    terminate: 'Terminate',
    viewFinancials: 'View amounts',
    viewClient: 'View client info',
};

/**
 * True when `value` is a concrete permission key from the catalog.
 * Wildcards (`*`, `resource.*`) are intentionally NOT valid concrete keys —
 * they are only meaningful inside a role's permission list, validated
 * separately by {@link isAssignablePermission}.
 */
export function isKnownPermission(value: string): value is PermissionKey {
    return ALL_PERMISSIONS_SET.has(value);
}

/**
 * True when `value` may be stored on a role's `permissions` array: either a
 * concrete catalog key, a resource wildcard (`order.*`) for a known
 * resource, or the global `*`.
 */
export function isAssignablePermission(value: string): boolean {
    if (value === WILDCARD_ALL) return true;
    if (isKnownPermission(value)) return true;
    if (value.endsWith('.*')) {
        const resource = value.slice(0, -2);
        return Object.prototype.hasOwnProperty.call(PERMISSION_GROUPS, resource);
    }
    return false;
}

/** Filters an arbitrary string list down to valid, de-duplicated permissions. */
export function sanitizePermissions(values: readonly string[]): string[] {
    return [...new Set(values.filter(isAssignablePermission))];
}
