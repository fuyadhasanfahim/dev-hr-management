import { z } from 'zod';

/**
 * Phase 5 — request schemas for role administration.
 * Permission strings are only shape-checked here; the real
 * "is this a known / assignable permission" + privilege-escalation checks
 * happen in `lib/role-guard.ts`.
 */

const permissionList = z.array(z.string().min(1).max(100)).max(500);

const slug = z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'slug may only contain a-z, 0-9, "-" and "_"');

export const CreateRoleValidation = z.object({
    body: z.object({
        name: z.string().min(2).max(60).trim(),
        slug: slug.optional(),
        description: z.string().max(300).trim().optional(),
        permissions: permissionList.optional().default([]),
    }),
});

export const UpdateRoleValidation = z.object({
    params: z.object({ slug: z.string().min(1) }),
    body: z
        .object({
            name: z.string().min(2).max(60).trim().optional(),
            description: z.string().max(300).trim().optional(),
            permissions: permissionList.optional(),
            isActive: z.boolean().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, {
            message: 'Provide at least one field to update',
        }),
});

export const AssignUserAccessValidation = z.object({
    params: z.object({ userId: z.string().min(1) }),
    body: z
        .object({
            role: z.string().min(1).max(50).optional(),
            extraPermissions: permissionList.optional(),
            deniedPermissions: permissionList.optional(),
        })
        .refine((v) => Object.keys(v).length > 0, {
            message: 'Provide role, extraPermissions or deniedPermissions',
        }),
});
