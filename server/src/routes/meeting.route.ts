import express from 'express';
import MeetingController from '../controllers/meeting.controller.js';
import { authorize } from '../middlewares/authorize.js';
import { Role } from '../constants/role.js';

const router = express.Router();

const MEETING_ROLES = [Role.SUPER_ADMIN, Role.ADMIN, Role.TEAM_LEADER];

// POST /  — schedule a new meeting
router.post('/', authorize(...MEETING_ROLES), MeetingController.createMeeting);

// GET /   — list meetings with filters
router.get('/', authorize(...MEETING_ROLES), MeetingController.getMeetings);

// GET /:id — get meeting detail
router.get('/:id', authorize(...MEETING_ROLES), MeetingController.getMeetingById);

// PATCH /:id/cancel — cancel a meeting
router.patch('/:id/cancel', authorize(...MEETING_ROLES), MeetingController.cancelMeeting);

// PUT /:id — update a meeting
router.put('/:id', authorize(...MEETING_ROLES), MeetingController.updateMeeting);

// DELETE /:id — delete a meeting
router.delete('/:id', authorize(...MEETING_ROLES), MeetingController.deleteMeeting);

export const meetingRoute = router;
