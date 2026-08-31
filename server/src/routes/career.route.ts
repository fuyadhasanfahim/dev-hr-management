import { Router } from 'express';
import jobPositionController from '../controllers/job-position.controller.js';
import jobApplicationController from '../controllers/job-application.controller.js';
import { upload } from '../middlewares/upload.middleware.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router = Router();

// ============================================
// JOB POSITIONS
// ============================================

// Public routes (no auth required)
router.get('/positions/public', jobPositionController.getOpenPositions);
router.get('/positions/public/:slug', jobPositionController.getPositionBySlug);

// Admin routes (auth required)
router.get('/positions', jobPositionController.getAllPositions);
router.get('/positions/:id', jobPositionController.getPositionById);
router.post('/positions', requirePermission('career.manage'), jobPositionController.createPosition);
router.put('/positions/:id', requirePermission('career.manage'), jobPositionController.updatePosition);
router.patch('/positions/:id/toggle', requirePermission('career.manage'), jobPositionController.togglePosition);
router.delete('/positions/:id', requirePermission('career.manage'), jobPositionController.deletePosition);

// ============================================
// JOB APPLICATIONS
// ============================================

// Public routes (no auth required)
router.post(
    '/applications/public',
    upload.single('cvFile'),
    jobApplicationController.submitApplication
);

// Admin routes (auth required)
router.get('/applications', requirePermission('career.read'), jobApplicationController.getAllApplications);
router.get('/applications/stats', requirePermission('career.read'), jobApplicationController.getApplicationsStats);
router.get('/applications/:id', requirePermission('career.read'), jobApplicationController.getApplicationById);
router.patch('/applications/:id/status', requirePermission('career.manage'), jobApplicationController.updateApplicationStatus);
router.delete('/applications/:id', requirePermission('career.manage'), jobApplicationController.deleteApplication);

export const careerRoute = router;
