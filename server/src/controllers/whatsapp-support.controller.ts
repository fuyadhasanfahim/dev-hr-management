import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { logger } from '../lib/logger.js';
import whatsappSupportService, { InboxError, type Agent } from '../services/whatsapp-support.service.js';
import whatsappCallService from '../services/whatsapp-call.service.js';
import { userCan } from '../middlewares/require-permission.js';

// The signed-in agent, as the inbox services see them.
const agentOf = (req: Request): Agent => ({
    id: req.user?.id ?? '',
    name: req.user?.name ?? 'Agent',
    canManage: userCan(req, 'support.manage'),
});

// Inbox rule errors (assignment, permission, billing) keep their own status; anything else is a 500.
function sendError(res: Response, err: any, fallback = 500) {
    if (err instanceof InboxError) {
        return res.status(err.status).json({ success: false, message: err.message, code: err.code, ...err.extra });
    }
    return res.status(fallback).json({ success: false, message: err.message });
}

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
        const messages = await whatsappSupportService.getMessages(req.params.id!, agentOf(req).id);
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
        const message = await whatsappSupportService.sendAgentMessage(req.params.id!, text.trim(), agentOf(req), safeClientIdOf(clientId));
        return res.status(201).json({ success: true, data: message });
    } catch (err: any) {
        return sendError(res, err);
    }
}

async function editMessage(req: Request, res: Response) {
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, message: 'text is required' });
        }
        const message = await whatsappSupportService.editMessage(req.params.id!, req.params.messageId!, text.trim(), agentOf(req));
        return res.status(200).json({ success: true, data: message });
    } catch (err: any) {
        return sendError(res, err);
    }
}

async function deleteMessage(req: Request, res: Response) {
    try {
        const scope = req.query.scope;
        if (scope !== 'me' && scope !== 'everyone') {
            return res.status(400).json({ success: false, message: "scope must be 'me' or 'everyone'" });
        }
        await whatsappSupportService.deleteMessage(req.params.id!, req.params.messageId!, scope, agentOf(req));
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return sendError(res, err);
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
        await whatsappSupportService.setAiEnabled(req.params.id!, aiEnabled, agentOf(req));
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return sendError(res, err);
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
            agentOf(req),
        );
        return res.status(201).json({ success: true, data: message });
    } catch (err: any) {
        logger.error(`WhatsApp media send failed (${req.file?.mimetype}, ${req.file?.size} bytes): ${err.message}`);
        return sendError(res, err);
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
    return sendError(res, err, 502);
}

async function startCall(req: Request, res: Response) {
    try {
        const { sdp } = req.body ?? {};
        if (typeof sdp !== 'string' || !sdp) return res.status(400).json({ success: false, message: 'sdp is required' });
        const callId = await whatsappCallService.startCall(req.params.id!, sdp, agentOf(req));
        return res.status(201).json({ success: true, data: { callId } });
    } catch (err: any) {
        return sendCallError(res, err);
    }
}

async function acceptCall(req: Request, res: Response) {
    try {
        const { sdp } = req.body ?? {};
        if (typeof sdp !== 'string' || !sdp) return res.status(400).json({ success: false, message: 'sdp is required' });
        await whatsappCallService.acceptCall(req.params.callId!, sdp, agentOf(req));
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

// body: { action: 'claim' | 'release' }
async function setAssignment(req: Request, res: Response) {
    try {
        const { action } = req.body ?? {};
        if (action !== 'claim' && action !== 'release') {
            return res.status(400).json({ success: false, message: "action must be 'claim' or 'release'" });
        }
        await whatsappSupportService.setAssignment(req.params.id!, action, agentOf(req));
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return sendError(res, err);
    }
}

async function getDetails(req: Request, res: Response) {
    try {
        return res.status(200).json({ success: true, data: await whatsappSupportService.getCustomerDetails(req.params.id!) });
    } catch (err: any) {
        return sendError(res, err);
    }
}

async function listNotes(req: Request, res: Response) {
    try {
        return res.status(200).json({ success: true, data: await whatsappSupportService.listNotes(req.params.id!) });
    } catch (err: any) {
        return sendError(res, err);
    }
}

async function addNote(req: Request, res: Response) {
    try {
        const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
        if (!body) return res.status(400).json({ success: false, message: 'body is required' });
        if (body.length > 4000) return res.status(400).json({ success: false, message: 'Notes are limited to 4000 characters' });
        const note = await whatsappSupportService.addNote(req.params.id!, body, agentOf(req));
        return res.status(201).json({ success: true, data: note });
    } catch (err: any) {
        return sendError(res, err);
    }
}

async function deleteNote(req: Request, res: Response) {
    try {
        await whatsappSupportService.deleteNote(req.params.id!, req.params.noteId!, agentOf(req));
        return res.status(200).json({ success: true });
    } catch (err: any) {
        return sendError(res, err);
    }
}

export default {
    setAssignment,
    getDetails,
    listNotes,
    addNote,
    deleteNote,
    listConversations,
    getMessages,
    sendMessage,
    sendMedia,
    getMedia,
    retryMessage,
    editMessage,
    deleteMessage,
    setAiEnabled,
    markRead,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    requestCallPermission,
};
