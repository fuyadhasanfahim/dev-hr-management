import type { Request, Response } from 'express';
import RoleServices, { type RoleActor } from '../services/role.service.js';
import { AppError } from '../utils/AppError.js';

function actorFrom(req: Request): RoleActor {
    return {
        id: req.user?.id,
        permissions: req.user?.permissions ?? [],
        ipAddress: req.ip,
    };
}

function fail(res: Response, error: unknown) {
    const status = error instanceof AppError ? error.statusCode : 500;
    return res.status(status).json({
        success: false,
        message: (error as Error).message || 'Something went wrong',
    });
}

const listRoles = async (_req: Request, res: Response) => {
    try {
        const roles = await RoleServices.listRoles();
        return res.status(200).json({ success: true, data: roles });
    } catch (error) {
        return fail(res, error);
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
        return fail(res, error);
    }
};

const createRole = async (req: Request, res: Response) => {
    try {
        const role = await RoleServices.createRole(req.body, actorFrom(req));
        return res.status(201).json({ success: true, data: role });
    } catch (error) {
        return fail(res, error);
    }
};

const updateRole = async (req: Request, res: Response) => {
    try {
        const role = await RoleServices.updateRole(
            req.params.slug ?? '',
            req.body,
            actorFrom(req),
        );
        return res.status(200).json({ success: true, data: role });
    } catch (error) {
        return fail(res, error);
    }
};

const deleteRole = async (req: Request, res: Response) => {
    try {
        const result = await RoleServices.deleteRole(
            req.params.slug ?? '',
            actorFrom(req),
        );
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return fail(res, error);
    }
};

const assignUserAccess = async (req: Request, res: Response) => {
    try {
        const result = await RoleServices.assignUserAccess(
            req.params.userId ?? '',
            req.body,
            actorFrom(req),
        );
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return fail(res, error);
    }
};

const getUserAccess = async (req: Request, res: Response) => {
    try {
        const result = await RoleServices.getUserAccess(req.params.userId ?? '');
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return fail(res, error);
    }
};

export default {
    listRoles,
    getPermissionCatalog,
    getRole,
    createRole,
    updateRole,
    deleteRole,
    assignUserAccess,
    getUserAccess,
};
