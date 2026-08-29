import express from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import TaskController from '../controllers/task.controller.js';

const router = express.Router();


// Administrative creation and review
router.post('/', requirePermission('task.create'), TaskController.createTask);
router.patch('/:taskId', requirePermission('task.update'), TaskController.updateTask);
router.patch('/:taskId/review', requirePermission('task.review'), TaskController.reviewTask);
router.delete('/:taskId', requirePermission('task.delete'), TaskController.deleteTask);
router.patch('/:taskId/subtasks/:subtaskId/request-revision', requirePermission('task.review'), TaskController.requestSubtaskRevision);

// Public retrieval for order visibility
router.get('/order/:orderId', requirePermission('task.read'), TaskController.getOrderTasks);

// Staff-level routes
router.get('/mine', requirePermission('task.read'), TaskController.getMyTasks);
router.patch('/:taskId/submit', requirePermission('task.update'), TaskController.submitTask);
router.patch('/:taskId/status', requirePermission('task.update'), TaskController.updateTaskStatus);
router.patch('/:taskId/subtasks/:subtaskId/toggle', requirePermission('task.update'), TaskController.toggleSubtask);

export const TaskRoutes = router;
