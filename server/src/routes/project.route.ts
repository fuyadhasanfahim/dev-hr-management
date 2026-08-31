import express from 'express';
import ProjectController from '../controllers/project.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router = express.Router();

router.get('/', ProjectController.getAllProjects);
router.get('/:id', ProjectController.getProjectById);
router.patch('/:id/progress', requirePermission('project.update'), ProjectController.updateProgress);
router.post('/:id/milestones', requirePermission('project.update'), ProjectController.addMilestone);

export const ProjectRoutes = router;
