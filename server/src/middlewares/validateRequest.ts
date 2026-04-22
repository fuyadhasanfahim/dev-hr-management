import { type Request, type Response, type NextFunction } from 'express';
import { type ZodObject, ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

export const validateRequest = (schema: ZodObject) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const message = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
                next(new AppError(message, 400));
            } else {
                next(error);
            }
        }
    };
};
