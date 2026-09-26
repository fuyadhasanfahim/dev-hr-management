import type { Request, Response } from 'express';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';

// GET — Meta's one-time webhook verification handshake.
export function verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === envConfig.meta_webhook_verify_token) {
        res.status(200).send(challenge);
        return;
    }
    res.sendStatus(403);
}

// POST — Meta pushes incoming messages + delivery/read statuses here.
// Acknowledge immediately (Meta retries on timeout/non-2xx); the inbox,
// AI auto-reply and agent-assignment flow land in a later phase — for now
// this just proves the webhook is live and logs what Meta sends.
export function receiveWebhook(req: Request, res: Response) {
    res.sendStatus(200);
    logger.info({ body: req.body }, 'WhatsApp webhook event received');
}

export default { verifyWebhook, receiveWebhook };
