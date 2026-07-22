import express from 'express';
import TaskController from '../controllers/task.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router = express.Router();

const ADMIN_LEAD_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.TEAM_LEADER, Role.HR_MANAGER];
const ALL_STAFF_ROLES = [...ADMIN_LEAD_ROLES, Role.STAFF];

// Administrative creation and review
router.post('/', authorize(...ADMIN_LEAD_ROLES), TaskController.createTask);
router.patch('/:taskId', authorize(...ADMIN_LEAD_ROLES), TaskController.updateTask);
router.patch('/:taskId/review', authorize(...ADMIN_LEAD_ROLES), TaskController.reviewTask);
router.delete('/:taskId', authorize(...ADMIN_LEAD_ROLES), TaskController.deleteTask);

// Public retrieval for order visibility
router.get('/order/:orderId', authorize(...ALL_STAFF_ROLES), TaskController.getOrderTasks);

// Staff-level routes
router.get('/mine', authorize(...ALL_STAFF_ROLES), TaskController.getMyTasks);
router.patch('/:taskId/submit', authorize(...ALL_STAFF_ROLES), TaskController.submitTask);
router.patch('/:taskId/status', authorize(...ALL_STAFF_ROLES), TaskController.updateTaskStatus);
router.patch('/:taskId/subtasks/:subtaskId/toggle', authorize(...ALL_STAFF_ROLES), TaskController.toggleSubtask);

export const TaskRoutes = router;
