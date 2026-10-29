import { Queue, Worker, type Job } from 'bullmq';
import { Types } from 'mongoose';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import ChatMessageModel from '../models/chat-message.model.js';
import ChatSessionModel, { ChatSessionStatus } from '../models/chat-session.model.js';
import { addToChatQueue } from './redis-queue.service.js';
import { getSupportNamespace } from '../socket/support.namespace.js';

// Website chat messages are shown to everyone the moment they are sent; saving them and telling the agents'
// sidebars is the slow part, so it runs here, behind Redis, with retries. If every try fails the sender is told
// ("failed, resend") instead of the message silently going missing.

const QUEUE_NAME = 'chat-messages';
const ATTEMPTS = 5;

export interface ChatMessageJob {
    /** The message exactly as it was echoed to the room (plain values, ids as strings). */
    message: {
        _id: string;
        sessionId: string;
        sender: string;
        senderModel: string;
        senderName: string;
        content: string;
        attachments: string[];
        clientId?: string;
        createdAt: string;
    };
    /** The room (the session's uuid). */
    room: string;
    fromClient: boolean;
}

let queue: Queue<ChatMessageJob> | null = null;
const getQueue = () => (queue ??= new Queue<ChatMessageJob>(QUEUE_NAME, { connection: getRedisClient() }));

/** Saves the message (idempotent: a retry or a re-send can never make a second row) and updates the agents. */
export async function persistChatMessage(job: ChatMessageJob): Promise<void> {
    const m = job.message;
    await ChatMessageModel.updateOne(
        { _id: new Types.ObjectId(m._id) },
        {
            $setOnInsert: {
                sessionId: new Types.ObjectId(m.sessionId),
                sender: new Types.ObjectId(m.sender),
                senderModel: m.senderModel,
                senderName: m.senderName,
                content: m.content,
                attachments: m.attachments,
                readBy: [],
                ...(m.clientId ? { clientId: m.clientId } : {}),
                createdAt: new Date(m.createdAt),
            },
        },
        { upsert: true },
    );

    // Keep list ordering and "last active" fresh, then update every agent's sidebar live.
    const session = await ChatSessionModel.findByIdAndUpdate(m.sessionId, { $set: { updatedAt: new Date() } }, { new: true });
    const ns = getSupportNamespace();
    if (!session || !ns) return;
    ns.to('agents_presence').emit('session:new_message', {
        sessionId: job.room,
        status: session.status,
        fromClient: job.fromClient,
        senderName: m.senderName,
        assignedAgentId: session.assignedAgent?.toString() ?? null,
        lastMessage: { content: m.content, attachments: m.attachments, createdAt: m.createdAt },
    });
    if (job.fromClient && session.status === ChatSessionStatus.QUEUED) {
        await addToChatQueue(job.room);
        ns.to('agents_presence').emit('queue:new_message', { sessionId: job.room });
    }
}

/** Hands a message to the queue; if Redis is unreachable it is saved right here so nothing is lost. */
export async function enqueueChatMessage(job: ChatMessageJob): Promise<void> {
    try {
        await getQueue().add('persist', job, {
            jobId: job.message._id,
            attempts: ATTEMPTS,
            backoff: { type: 'exponential', delay: 500 },
            removeOnComplete: true,
            removeOnFail: 200,
        });
    } catch (err: any) {
        logger.warn(`[chat queue] Redis unavailable, saving message ${job.message._id} directly: ${err.message}`);
        await persistChatMessage(job);
    }
}

async function process(job: Job<ChatMessageJob>): Promise<void> {
    await persistChatMessage(job.data);
}

export function startChatMessageWorker(): Worker<ChatMessageJob> {
    const worker = new Worker<ChatMessageJob>(QUEUE_NAME, process, { connection: getRedisClient(), concurrency: 8 });

    worker.on('failed', async (job, err) => {
        if (!job || job.attemptsMade < ATTEMPTS) return;
        logger.error(`[chat queue] message ${job.data.message._id} could not be saved: ${err.message}`);
        // Let the sender know, and free the re-send key so "Resend" works.
        getSupportNamespace()?.to(job.data.room).emit('chat:message:failed', { _id: job.data.message._id, clientId: job.data.message.clientId });
        if (job.data.message.clientId) await getRedisClient().del(`chatmsg:${job.data.message.clientId}`).catch(() => {});
    });

    return worker;
}
