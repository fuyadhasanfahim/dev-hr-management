import type { Request, Response, NextFunction } from 'express';
import meetingService from '../services/meeting.service.js';
import type { MeetingQueryParams } from '../types/meeting.type.js';

const createMeeting = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const meeting = await meetingService.createMeeting({
            ...req.body,
            createdBy: userId,
        });

        return res.status(201).json({
            success: true,
            message: 'Meeting scheduled successfully',
            data: meeting,
        });
    } catch (err) {
        return next(err);
    }
};

const getMeetings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const queryParams: MeetingQueryParams = {
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        };

        if (req.query.clientId) queryParams.clientId = req.query.clientId as string;
        if (req.query.status) queryParams.status = req.query.status as any;
        if (req.query.startDate) queryParams.startDate = req.query.startDate as string;
        if (req.query.endDate) queryParams.endDate = req.query.endDate as string;

        const result = await meetingService.getMeetings(queryParams);

        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        return next(err);
    }
};

const getMeetingById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('Meeting ID is required'));

        const meeting = await meetingService.getMeetingById(id);
        if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });

        return res.status(200).json({ success: true, data: meeting });
    } catch (err) {
        return next(err);
    }
};

const cancelMeeting = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('Meeting ID is required'));

        const meeting = await meetingService.cancelMeeting(id);
        return res.status(200).json({
            success: true,
            message: 'Meeting cancelled successfully',
            data: meeting,
        });
    } catch (err) {
        return next(err);
    }
};

const updateMeeting = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('Meeting ID is required'));

        const meeting = await meetingService.updateMeeting(id, req.body);
        return res.status(200).json({
            success: true,
            message: 'Meeting updated successfully',
            data: meeting,
        });
    } catch (err) {
        return next(err);
    }
};

const deleteMeeting = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id) return next(new Error('Meeting ID is required'));

        const meeting = await meetingService.deleteMeeting(id);
        return res.status(200).json({
            success: true,
            message: 'Meeting deleted successfully',
            data: meeting,
        });
    } catch (err) {
        return next(err);
    }
};

export default {
    createMeeting,
    getMeetings,
    getMeetingById,
    cancelMeeting,
    updateMeeting,
    deleteMeeting,
};
