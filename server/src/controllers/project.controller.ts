import type { Request, Response } from 'express';
import ProjectServices from '../services/project.service.js';

async function getAllProjects(req: Request, res: Response) {
    try {
        const result = await ProjectServices.getAllProjectsFromDB(req.query);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function getProjectById(req: Request, res: Response) {
    try {
        const result = await ProjectServices.getProjectByIdFromDB(req.params.id as string);
        if (!result) return res.status(404).json({ success: false, message: 'Project not found' });
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function updateProgress(req: Request, res: Response) {
    try {
        const { progress, status } = req.body;
        const result = await ProjectServices.updateProjectProgress(req.params.id as string, progress, status);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

async function addMilestone(req: Request, res: Response) {
    try {
        const result = await ProjectServices.addMilestoneToProject(req.params.id as string, req.body);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export default {
    getAllProjects,
    getProjectById,
    updateProgress,
    addMilestone,
};
