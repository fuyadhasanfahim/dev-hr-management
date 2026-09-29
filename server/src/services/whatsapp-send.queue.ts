import { Queue, Worker, type Job } from 'bullmq';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import WhatsAppMessageModel, { WhatsAppMessageStatus, type IWhatsAppMessage } from '../models/whatsapp-message.model.js';
import WhatsAppConversationModel from '../models/whatsapp-conversation.model.js';
import whatsappService from './whatsapp.service.js';
import { notifyAgents } from '../socket/support.namespace.js';

const QUEUE_NAME = 'whatsapp-send';
const ATTEMPTS = 3;

interface SendJob {
    messageId: string;
}

let queue: Queue<SendJob> | null = null;

function getQueue(): Queue<SendJob> {
    if (!queue) queue = new Queue<SendJob>(QUEUE_NAME, { connection: getRedisClient() });
    return queue;
}

export function notifyMessageStatus(message: IWhatsAppMessage): void {
    notifyAgents('whatsapp:message_status', {
        conversationId: message.conversationId.toString(),
        messageId: message._id!.toString(),
        status: message.status,
        error: message.error,
    });
}

export async function enqueueWhatsAppSend(messageId: string): Promise<void> {
    await getQueue().add(
        'send',
        { messageId },
        { attempts: ATTEMPTS, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 100 },
    );
}

async function processSend(job: Job<SendJob>): Promise<void> {
    const message = await WhatsAppMessageModel.findById(job.data.messageId);
    // Already handled (e.g. a retried job after a crash) — never send twice.
    if (!message || message.status !== WhatsAppMessageStatus.PENDING) return;

    const conversation = await WhatsAppConversationModel.findById(message.conversationId);
    if (!conversation) throw new Error('Conversation not found');

    message.whatsappMsgId = await whatsappService.sendTextMessage(conversation.customerPhone, message.body);
    message.status = WhatsAppMessageStatus.SENT;
    await message.save();
    notifyMessageStatus(message);
}

// ponytail: concurrency 1 keeps a burst of messages in the order they were typed,
// at the cost of one send at a time globally — switch to per-conversation job
// groups if agents ever send faster than Meta's API round trip.
export function startWhatsAppSendWorker(): Worker<SendJob> {
    const worker = new Worker<SendJob>(QUEUE_NAME, processSend, { connection: getRedisClient(), concurrency: 1 });

    worker.on('failed', async (job, err) => {
        if (!job || job.attemptsMade < ATTEMPTS) return;
        logger.error(`WhatsApp send failed for message ${job.data.messageId}: ${err.message}`);
        const message = await WhatsAppMessageModel.findByIdAndUpdate(
            job.data.messageId,
            { status: WhatsAppMessageStatus.FAILED, error: err.message },
            { new: true },
        );
        if (message) notifyMessageStatus(message);
    });

    return worker;
}
