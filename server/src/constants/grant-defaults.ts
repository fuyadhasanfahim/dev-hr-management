/**
 * Phase 6 — default permission grants for designations (and, later,
 * departments).
 *
 * These fold the previously hard-coded `authorizeTelemarketer` behaviour
 * into data: a staff member with the "telemarketer" designation gets lead
 * and client access on top of their role. Seeded by `seed:roles`; editable
 * afterwards from the admin UI. Matched case-insensitively against a
 * designation's `name` or `code`.
 */

export interface DesignationGrantSeed {
    /** Matched against Designation.name / Designation.code (case-insensitive). */
    match: string;
    permissions: string[];
}

export const DESIGNATION_GRANT_DEFAULTS: readonly DesignationGrantSeed[] = [
    {
        match: 'telemarketer',
        permissions: [
            'lead.read',
            'lead.create',
            'lead.update',
            'lead.convert',
            'lead.assign',
            'client.read',
            'client.create',
            'client.update',
        ],
    },
];
