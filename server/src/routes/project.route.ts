import express from 'express';
import ProjectController from '../controllers/project.controller.js';

const router = express.Router();

router.get('/', ProjectController.getAllProjects);
router.get('/:id', ProjectController.getProjectById);
router.patch('/:id/progress', ProjectController.updateProgress);
router.post('/:id/milestones', ProjectController.addMilestone);

export const ProjectRoutes = router;
