import { logger } from '../lib/logger.js';
import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, {
    WhatsAppMessageDirection,
    WhatsAppMessageSender,
    WhatsAppMessageType,
} from '../models/whatsapp-message.model.js';
import whatsappService from './whatsapp.service.js';
import { findOrCreateConversation } from './whatsapp-support.service.js';
import { notifyAgents } from '../socket/support.namespace.js';

export class CallError extends Error {
    constructor(message: string, public status: number, public code?: string, public extra?: Record<string, unknown>) {
        super(message);
    }
}

interface LiveCall {
    conversationId: string;
    direction: 'inbound' | 'outbound';
    agentId?: string; // Agent who answered (inbound) or placed (outbound) the call.
    startedAt: Date;
    answeredAt?: Date;
}

// ponytail: live calls live in this process's memory — fine for the single
// devhr-server instance; a restart mid-call only loses the "who answered"
// claim (the call-log line falls back to Meta's duration). Move to Redis if
// the server is ever scaled out to several processes.
const liveCalls = new Map<string, LiveCall>();

// Payload shapes from the `calls` webhook field.
export interface CallEvent {
    id: string;
    from: string;
    to: string;
    event: 'connect' | 'terminate';
    direction: 'USER_INITIATED' | 'BUSINESS_INITIATED';
    session?: { sdp_type: 'offer' | 'answer'; sdp: string };
    status?: string;
    duration?: number;
}

export interface CallStatus {
    id: string;
    type: 'call';
    status: 'RINGING' | 'ACCEPTED' | 'REJECTED' | string;
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// One call-log line per call (whatsappMsgId `call:<id>` keeps it idempotent).
async function logCall(callId: string, call: LiveCall, durationSec: number) {
    const answered = !!call.answeredAt || durationSec > 0;
    const inbound = call.direction === 'inbound';
    const body = answered
        ? `${inbound ? 'Incoming' : 'Outgoing'} voice call · ${formatDuration(durationSec)}`
        : inbound
          ? 'Missed voice call'
          : 'No answer';
    try {
        await WhatsAppMessageModel.create({
            conversationId: call.conversationId,
            direction: inbound ? WhatsAppMessageDirection.INBOUND : WhatsAppMessageDirection.OUTBOUND,
            sender: inbound ? WhatsAppMessageSender.CUSTOMER : WhatsAppMessageSender.AGENT,
            type: WhatsAppMessageType.CALL,
            body,
            whatsappMsgId: `call:${callId}`,
            createdAt: call.startedAt,
        });
        await WhatsAppConversationModel.findByIdAndUpdate(call.conversationId, { lastMessageAt: new Date() });
        notifyAgents('whatsapp:new_message', { conversationId: call.conversationId });
    } catch (err: any) {
        if (err?.code !== 11000) throw err; // 11000 = already logged (webhook redelivery)
    }
}

async function endLocally(callId: string, durationSec: number, reason: string) {
    const call = liveCalls.get(callId);
    if (!call) return;
    liveCalls.delete(callId);
    notifyAgents('whatsapp:call_ended', { callId, conversationId: call.conversationId, reason });
    await logCall(callId, call, durationSec);
}

// ── Webhook side ────────────────────────────────────────────────────────────

export async function handleCallEvent(event: CallEvent, contactName?: string): Promise<void> {
    if (event.event === 'terminate') {
        await endLocally(event.id, event.duration ?? 0, event.status ?? 'ended');
        return;
    }

    if (event.direction === 'USER_INITIATED') {
        // Customer is calling us: ring every online agent with Meta's SDP offer.
        const conversation = await findOrCreateConversation(event.from, contactName);
        const conversationId = conversation._id.toString();
        liveCalls.set(event.id, { conversationId, direction: 'inbound', startedAt: new Date() });
        notifyAgents('whatsapp:call_incoming', {
            callId: event.id,
            conversationId,
            name: conversation.customerName || conversation.customerPhone,
            phone: conversation.customerPhone,
            sdp: event.session?.sdp,
        });
        return;
    }

    // Our outbound call connected: hand Meta's SDP answer to the calling agent's browser.
    const call = liveCalls.get(event.id);
    if (call && event.session?.sdp) {
        notifyAgents('whatsapp:call_answer', { callId: event.id, sdp: event.session.sdp });
    }
}

export async function handleCallStatus(status: CallStatus): Promise<void> {
    const call = liveCalls.get(status.id);
    if (!call) return;
    if (status.status === 'ACCEPTED') call.answeredAt = new Date();
    notifyAgents('whatsapp:call_status', { callId: status.id, status: status.status.toLowerCase() });
    if (status.status === 'REJECTED') await endLocally(status.id, 0, 'rejected');
}

// ── Agent side ──────────────────────────────────────────────────────────────

export async function startCall(conversationId: string, sdpOffer: string, agentId: string): Promise<string> {
    const conversation = await WhatsAppConversationModel.findById(conversationId);
    if (!conversation) throw new CallError('Conversation not found', 404);

    const permission = await whatsappService.getCallPermission(conversation.customerPhone);
    if (!permission.canCall) {
        throw new CallError('Customer has not allowed calls yet', 409, 'NO_PERMISSION', {
            canRequest: permission.canRequest,
        });
    }

    const callId = await whatsappService.startCall(conversation.customerPhone, sdpOffer);
    liveCalls.set(callId, { conversationId, direction: 'outbound', agentId, startedAt: new Date() });
    return callId;
}

// First agent to accept wins; everyone else's ringing stops via `call_claimed`.
export async function acceptCall(callId: string, sdpAnswer: string, agentId: string): Promise<void> {
    const call = liveCalls.get(callId);
    if (!call) throw new CallError('This call has already ended', 410);
    if (call.agentId && call.agentId !== agentId) throw new CallError('Another agent already answered', 409);
    call.agentId = agentId;
    notifyAgents('whatsapp:call_claimed', { callId, agentId });

    try {
        await whatsappService.acceptCall(callId, sdpAnswer);
        call.answeredAt = new Date();
    } catch (err) {
        call.agentId = undefined;
        throw err;
    }
}

export async function rejectCall(callId: string): Promise<void> {
    await whatsappService.rejectCall(callId);
    await endLocally(callId, 0, 'rejected');
}

export async function endCall(callId: string): Promise<void> {
    const call = liveCalls.get(callId);
    try {
        await whatsappService.terminateCall(callId);
    } catch (err: any) {
        // Already over on Meta's side — still clear it here so the UI isn't stuck.
        logger.warn(`WhatsApp terminate for ${callId} failed: ${err.message}`);
    }
    const seconds = call?.answeredAt ? Math.round((Date.now() - call.answeredAt.getTime()) / 1000) : 0;
    await endLocally(callId, seconds, 'ended');
}

export async function requestCallPermission(conversationId: string): Promise<void> {
    const conversation = await WhatsAppConversationModel.findById(conversationId);
    if (!conversation) throw new CallError('Conversation not found', 404);
    await whatsappService.sendCallPermissionRequest(
        conversation.customerPhone,
        'We would like to call you about your support request. Tap below to allow calls from us.',
    );
    await WhatsAppMessageModel.create({
        conversationId: conversation._id,
        direction: WhatsAppMessageDirection.OUTBOUND,
        sender: WhatsAppMessageSender.AGENT,
        type: WhatsAppMessageType.CALL,
        body: 'Call permission requested',
        whatsappMsgId: `callperm:${conversation._id}:${Date.now()}`,
    });
    notifyAgents('whatsapp:new_message', { conversationId });
}

export default { handleCallEvent, handleCallStatus, startCall, acceptCall, rejectCall, endCall, requestCallPermission };
