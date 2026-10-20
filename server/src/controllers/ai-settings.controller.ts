import type { Request, Response } from 'express';
import aiSettingsService, { AiSettingsError } from '../services/ai-settings.service.js';
import { logger } from '../lib/logger.js';

async function snapshot() {
    return { settings: await aiSettingsService.getSettings(), status: await aiSettingsService.getStatus() };
}

async function get(_req: Request, res: Response) {
    try {
        return res.status(200).json({ success: true, data: await snapshot() });
    } catch (err: any) {
        logger.error(`AI settings read failed: ${err.message}`);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// Light read for any signed-in user: is each AI on right now?
async function status(_req: Request, res: Response) {
    try {
        return res.status(200).json({ success: true, data: await aiSettingsService.getStatus() });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function update(req: Request, res: Response) {
    try {
        await aiSettingsService.updateSettings(req.body ?? {}, { id: req.user?.id ?? '', name: req.user?.name ?? 'Admin' });
        logger.info(`AI settings changed by ${req.user?.name ?? req.user?.id}`);
        return res.status(200).json({ success: true, data: await snapshot() });
    } catch (err: any) {
        const bad = err instanceof AiSettingsError;
        if (!bad) logger.error(`AI settings update failed: ${err.message}`);
        return res.status(bad ? 400 : 500).json({ success: false, message: err.message });
    }
}

export default { get, status, update };
