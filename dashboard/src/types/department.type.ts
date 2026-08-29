export interface IDepartment {
    _id: string;
    name: string;
    code: string;
    description?: string;
    permissions?: string[];
    isActive: boolean;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateDepartmentPayload {
    name: string;
    code?: string;
    description?: string;
    isActive?: boolean;
}

export interface UpdateDepartmentPayload {
    name?: string;
    code?: string;
    description?: string;
    isActive?: boolean;
}
