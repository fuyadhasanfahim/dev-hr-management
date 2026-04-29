import type { Request, Response } from 'express';
import OutboxEventModel from '../models/outbox-event.model.js';
import { OutboxService } from '../services/outbox.service.js';

const listOutbox = async (req: Request, res: Response) => {
    const { status, eventName, page, limit } = req.query as any;

    const params: any = {};
    if (status) params.status = status;
    if (eventName) params.eventName = eventName;
    if (page) params.page = Number(page);
    if (limit) params.limit = Number(limit);

    const data = await OutboxService.list(params);

    return res.status(200).json({ success: true, data });
};

const getOutboxById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const item = await OutboxEventModel.findById(id).lean();
    if (!item) {
        return res.status(404).json({ success: false, message: 'Outbox event not found' });
    }
    return res.status(200).json({ success: true, data: item });
};

const replayOutboxById = async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ success: false, message: 'id is required' });
    }
    await OutboxService.replayById(id);
    return res.status(200).json({ success: true });
};

const replayOutboxMany = async (req: Request, res: Response) => {
    const ids = (req.body?.ids ?? []) as string[];
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'ids[] is required' });
    }
    await OutboxService.replayMany(ids);
    return res.status(200).json({ success: true });
};

const OutboxController = {
    listOutbox,
    getOutboxById,
    replayOutboxById,
    replayOutboxMany,
};

export default OutboxController;

