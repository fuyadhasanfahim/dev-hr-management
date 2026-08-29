import type { Request, Response } from 'express';
import GrantServices from '../services/grant.service.js';
import type { RoleActor } from '../services/role.service.js';
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

const setDepartmentPermissions = async (req: Request, res: Response) => {
    try {
        const doc = await GrantServices.setDepartmentPermissions(
            req.params.id ?? '',
            req.body.permissions ?? [],
            actorFrom(req),
        );
        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return fail(res, error);
    }
};

const setDesignationPermissions = async (req: Request, res: Response) => {
    try {
        const doc = await GrantServices.setDesignationPermissions(
            req.params.id ?? '',
            req.body.permissions ?? [],
            actorFrom(req),
        );
        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return fail(res, error);
    }
};

export default { setDepartmentPermissions, setDesignationPermissions };
