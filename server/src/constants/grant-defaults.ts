/**
 * Phase 6 — default permission grants for departments / designations.
 *
 * These are applied by `seed:roles` ONLY to a scope that currently has no
 * permissions of its own, so admin edits made from the UI survive re-runs.
 * Matched case-insensitively against the scope's `name` or `code`.
 *
 * The "Telemarketing" department carries the access telemarketers need on
 * top of their base `staff` role: their own leads + clients, order
 * create/update, and — crucially — `order.viewFinancials` / `order.viewClient`
 * so the API does NOT strip prices / client identity from their order and
 * quotation responses (everyone else in those roles gets them masked; see
 * utils/masking.ts). Row-level scoping (only their own clients) is enforced
 * separately in client.controller.ts.
 *
 * This replaces the old `telemarketer` *designation* grant — the access is
 * now department-driven.
 */

export interface ScopeGrantSeed {
    /** Matched against the scope's name / code (case-insensitive). */
    match: string;
    permissions: string[];
}

export const DEPARTMENT_GRANT_DEFAULTS: readonly ScopeGrantSeed[] = [
    {
        match: 'telemarketing',
        permissions: [
            'lead.read',
            'lead.create',
            'lead.update',
            'lead.convert',
            'lead.assign',
            'client.read',
            'client.create',
            'client.update',
            'order.read',
            'order.create',
            'order.update',
            'order.viewFinancials',
            'order.viewClient',
        ],
    },
];

/** No designation-level defaults any more — kept for the seed's loop shape. */
export const DESIGNATION_GRANT_DEFAULTS: readonly ScopeGrantSeed[] = [];
