import { Request, Response } from 'express';
import ProjectServices from '../services/project.service.js';

async function getAllProjects(req: Request, res: Response) {
    try {
        const result = await ProjectServices.getAllProjectsFromDB(req.query);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function getProjectById(req: Request, res: Response) {
    try {
        const result = await ProjectServices.getProjectByIdFromDB(req.params.id);
        if (!result) return res.status(404).json({ success: false, message: 'Project not found' });
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
    }
}

async function updateProgress(req: Request, res: Response) {
    try {
        const { progress, status } = req.body;
        const result = await ProjectServices.updateProjectProgress(req.params.id, progress, status);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
    }
}

async function addMilestone(req: Request, res: Response) {
    try {
        const result = await ProjectServices.addMilestoneToProject(req.params.id, req.body);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export default {
    getAllProjects,
    getProjectById,
    updateProgress,
    addMilestone,
};
