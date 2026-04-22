import { z } from 'zod';
import { MilestoneStatus, ProjectStatus } from '../models/project.model.js';

export const ProjectValidation = z.object({
    body: z.object({
        status: z.nativeEnum(ProjectStatus).optional(),
        progress: z.number().min(0).max(100).optional(),
        deadline: z.string().datetime().optional(),
    }),
});

export const MilestoneValidation = z.object({
    body: z.object({
        title: z.string().min(3),
        description: z.string().optional(),
        amount: z.number().min(0),
        status: z.nativeEnum(MilestoneStatus).optional(),
        dueDate: z.string().datetime().optional(),
    }),
});
