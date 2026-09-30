import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { logger } from '../lib/logger.js';
import whatsappSupportService from '../services/whatsapp-support.service.js';
import whatsappCallService, { CallError } from '../services/whatsapp-call.service.js';

const safeClientIdOf = (clientId: unknown) =>
    typeof clientId === 'string' && clientId.length <= 64 ? clientId : undefined;

async function listConversations(_req: Request, res: Response) {
    try {
        const conversations = await whatsappSupportService.listConversations();
        return res.status(200).json({ success: true, data: conversations });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function getMessages(req: Request, res: Response) {
    try {
        const messages = await whatsappSupportService.getMessages(req.params.id!);
        return res.status(200).json({ success: true, data: messages });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function sendMessage(req: Request, res: Response) {
    try {
        const { text, clientId } = req.body;
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, message: 'text is required' });
        }
        const message = await whatsappSupportService.sendAgentMessage(req.params.id!, text.trim(), safeClientIdOf(clientId));
        return res.status(201).json({ success: true, data: message });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function retryMessage(req: Request, res: Response) {
    try {
        const message = await whatsappSupportService.retryMessage(req.params.id!, req.params.messageId!);
        return res.status(200).json({ success: true, data: message });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function setAiEnabled(req: Request, res: Response) {
    try {
        const { aiEnabled } = req.body;
        if (typeof aiEnabled !== 'boolean') {
            return res.status(400).json({ success: false, message: 'aiEnabled must be a boolean' });
        }
        await whatsappSupportService.setAiEnabled(req.params.id!, aiEnabled);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function markRead(req: Request, res: Response) {
    try {
        await whatsappSupportService.markConversationRead(req.params.id!);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// multipart: `file` + optional `caption`, `voice` ("true" for a recorded voice note), `clientId`.
async function sendMedia(req: Request, res: Response) {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'file is required' });
        const { caption, voice, clientId } = req.body ?? {};
        const message = await whatsappSupportService.sendAgentMedia(
            req.params.id!,
            { buffer: req.file.buffer, mimeType: req.file.mimetype, filename: req.file.originalname },
            {
                caption: typeof caption === 'string' ? caption.trim() : undefined,
                voice: voice === 'true',
                clientId: safeClientIdOf(clientId),
            },
        );
        return res.status(201).json({ success: true, data: message });
    } catch (err: any) {
        logger.error(`WhatsApp media send failed (${req.file?.mimetype}, ${req.file?.size} bytes): ${err.message}`);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// Streams a Meta-hosted file to the agent's browser (Meta's URLs need our token).
async function getMedia(req: Request, res: Response) {
    try {
        const media = await whatsappSupportService.getMedia(req.params.mediaId!);
        if (!media) return res.status(404).json({ success: false, message: 'Media not found' });
        res.setHeader('Content-Type', media.mimeType);
        if (media.size) res.setHeader('Content-Length', media.size);
        // A media id never changes content, so the browser can keep it.
        res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
        Readable.fromWeb(media.body as any).pipe(res);
        return;
    } catch (err: any) {
        if (!res.headersSent) res.status(502).json({ success: false, message: err.message });
        return;
    }
}

function sendCallError(res: Response, err: any) {
    logger.error(`WhatsApp call action failed: ${err.message}`);
    if (err instanceof CallError) {
        return res.status(err.status).json({ success: false, message: err.message, code: err.code, ...err.extra });
    }
    return res.status(502).json({ success: false, message: err.message });
}

async function startCall(req: Request, res: Response) {
    try {
        const { sdp } = req.body ?? {};
        if (typeof sdp !== 'string' || !sdp) return res.status(400).json({ success: false, message: 'sdp is required' });
        const callId = await whatsappCallService.startCall(req.params.id!, sdp, req.user?.id ?? '');
        return res.status(201).json({ success: true, data: { callId } });
    } catch (err: any) {
        return sendCallError(res, err);
    }
}

async function acceptCall(req: Request, res: Response) {
    try {
        const { sdp } = req.body ?? {};
        if (typeof sdp !== 'string' || !sdp) return res.status(400).json({ success: false, message: 'sdp is required' });
        await whatsappCallService.acceptCall(req.params.callId!, sdp, req.user?.id ?? '');
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return sendCallError(res, err);
    }
}

async function rejectCall(req: Request, res: Response) {
    try {
        await whatsappCallService.rejectCall(req.params.callId!);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return sendCallError(res, err);
    }
}

async function endCall(req: Request, res: Response) {
    try {
        await whatsappCallService.endCall(req.params.callId!);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return sendCallError(res, err);
    }
}

async function requestCallPermission(req: Request, res: Response) {
    try {
        await whatsappCallService.requestCallPermission(req.params.id!);
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return sendCallError(res, err);
    }
}

export default {
    listConversations,
    getMessages,
    sendMessage,
    sendMedia,
    getMedia,
    retryMessage,
    setAiEnabled,
    markRead,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    requestCallPermission,
};
