import express from 'express';
import { requirePermission } from '../middlewares/require-permission.js';
import MeetingController from '../controllers/meeting.controller.js';

const router = express.Router();

// POST /  — schedule a new meeting
router.post('/', requirePermission('meeting.create'), MeetingController.createMeeting);

// GET /   — list meetings with filters
router.get('/', requirePermission('meeting.read'), MeetingController.getMeetings);

// GET /:id — get meeting detail
router.get('/:id', requirePermission('meeting.read'), MeetingController.getMeetingById);

// PATCH /:id/cancel — cancel a meeting
router.patch('/:id/cancel', requirePermission('meeting.update'), MeetingController.cancelMeeting);

// PUT /:id — update a meeting
router.put('/:id', requirePermission('meeting.update'), MeetingController.updateMeeting);

// DELETE /:id — delete a meeting
router.delete('/:id', requirePermission('meeting.delete'), MeetingController.deleteMeeting);

export const meetingRoute = router;
