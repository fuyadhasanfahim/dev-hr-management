export interface IBranch {
    _id: string;
    name: string;
    code: string;
    address?: string;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateBranchPayload {
    name: string;
    code: string;
    address?: string;
    isActive?: boolean;
}

export interface UpdateBranchPayload {
    name?: string;
    code?: string;
    address?: string;
    isActive?: boolean;
}
