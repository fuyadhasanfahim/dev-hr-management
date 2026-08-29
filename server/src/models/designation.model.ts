import { model, Schema, Types, type Document } from "mongoose";

export interface IDesignation extends Document {
    name: string;
    code: string;
    department?: string;
    description?: string;
    /**
     * Phase 6 — permission keys granted to every staff member with this
     * designation, on top of their role + department permissions. Same
     * catalog / wildcard rules as a role's `permissions`.
     */
    permissions: string[];
    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const designationSchema = new Schema<IDesignation>(
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
            trim: true,
            unique: true,
        },
        department: {
            type: String,
            trim: true,
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

const DesignationModel = model<IDesignation>("Designation", designationSchema);
export default DesignationModel;
