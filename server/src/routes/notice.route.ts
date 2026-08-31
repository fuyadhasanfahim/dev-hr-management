import { Router } from 'express';
import NoticeController from '../controllers/notice.controller.js';
import { requirePermission } from '../middlewares/require-permission.js';

const router = Router();

// Public routes (requires auth but not admin)
router.get('/published', NoticeController.getPublishedNotices);
router.get('/unread', NoticeController.getUnreadNotices);
router.get('/:id', NoticeController.getNoticeById);
router.post('/:id/view', NoticeController.markAsViewed);
router.post('/mark-viewed', NoticeController.markMultipleAsViewed);

// Admin routes
router.get('/', requirePermission('notice.read'), NoticeController.getAllNotices);
router.post('/', requirePermission('notice.create'), NoticeController.createNotice);
router.put('/:id', requirePermission('notice.update'), NoticeController.updateNotice);
router.post('/:id/publish', requirePermission('notice.update'), NoticeController.publishNotice);
router.post('/:id/unpublish', requirePermission('notice.update'), NoticeController.unpublishNotice);
router.delete('/:id', requirePermission('notice.delete'), NoticeController.deleteNotice);
router.get('/:id/stats', requirePermission('notice.read'), NoticeController.getNoticeStats);

export const noticeRoute = router;
