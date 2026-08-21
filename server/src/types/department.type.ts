import { Types } from "mongoose";

export interface IDepartment {
    _id: Types.ObjectId;
    name: string;
    code: string;
    description?: string;
    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
