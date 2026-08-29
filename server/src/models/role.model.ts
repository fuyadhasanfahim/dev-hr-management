import { model, Schema, Types, type Document } from 'mongoose';

/**
 * Phase 1 — Role model.
 *
 * A role is a named bundle of permission strings. The five built-in roles
 * (`super_admin`, `admin`, `hr_manager`, `team_leader`, `staff`) are seeded
 * with `isSystem: true` and cannot be deleted; admins may create additional
 * custom roles at runtime.
 *
 * `slug` is the stable identifier stored on the Better Auth user's `role`
 * field. `name` is the display label.
 */
export interface IRole extends Document {
    name: string;
    slug: string;
    description?: string;
    /** Permission keys / wildcards from the catalog in `constants/permission.ts`. */
    permissions: string[];
    /** Built-in role — protected from deletion and slug changes. */
    isSystem: boolean;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true,
            index: true,
        },
        description: {
            type: String,
            trim: true,
        },
        permissions: {
            type: [String],
            default: [],
        },
        isSystem: {
            type: Boolean,
            default: false,
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true },
);

const RoleModel = model<IRole>('Role', roleSchema);
export default RoleModel;
