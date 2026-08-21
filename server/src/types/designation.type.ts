import { Types } from "mongoose";

export interface IDesignation {
    _id: Types.ObjectId;
    name: string;
    code: string;
    department?: string;
    description?: string;
    isActive: boolean;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
