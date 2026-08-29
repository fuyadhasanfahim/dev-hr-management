import { model, Schema, Types, type Document } from "mongoose";

export interface IDepartment extends Document {
    name: string;
    code: string;
    description?: string;
    /**
     * Phase 6 — permission keys granted to every staff member in this
     * department, on top of their role's permissions. Same catalog /
     * wildcard rules as a role's `permissions`.
     */
    permissions: string[];
    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            unique: true,
        },
        description: {
            type: String,
            trim: true,
        },
        permissions: {
            type: [String],
            default: [],
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true },
);

const DepartmentModel = model<IDepartment>("Department", departmentSchema);
export default DepartmentModel;
