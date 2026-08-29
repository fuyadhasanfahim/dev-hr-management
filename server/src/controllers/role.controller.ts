import type { Request, Response } from 'express';
import RoleServices from '../services/role.service.js';
import { AppError } from '../utils/AppError.js';

const listRoles = async (_req: Request, res: Response) => {
    try {
        const roles = await RoleServices.listRoles();
        return res.status(200).json({ success: true, data: roles });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

const getPermissionCatalog = async (_req: Request, res: Response) => {
    return res.status(200).json({
        success: true,
        data: RoleServices.getPermissionCatalog(),
    });
};

const getRole = async (req: Request, res: Response) => {
    try {
        const role = await RoleServices.getRoleBySlug(req.params.slug ?? '');
        return res.status(200).json({ success: true, data: role });
    } catch (error) {
        const status = error instanceof AppError ? error.statusCode : 500;
        return res.status(status).json({
            success: false,
            message: (error as Error).message,
        });
    }
};

export default {
    listRoles,
    getPermissionCatalog,
    getRole,
};
