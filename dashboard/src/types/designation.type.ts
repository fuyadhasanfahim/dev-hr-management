export interface IDesignation {
    _id: string;
    name: string;
    code: string;
    department?: string;
    description?: string;
    permissions?: string[];
    isActive: boolean;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateDesignationPayload {
    name: string;
    code?: string;
    department?: string;
    description?: string;
    isActive?: boolean;
}

export interface UpdateDesignationPayload {
    name?: string;
    code?: string;
    department?: string;
    description?: string;
    isActive?: boolean;
}
