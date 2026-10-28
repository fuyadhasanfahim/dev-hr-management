import WhatsAppConversationModel, { WhatsAppConversationStatus } from '../models/whatsapp-conversation.model.js';
import { answerPending, hasPendingAnswer } from '../controllers/whatsapp.controller.js';
import { notifyAgents } from '../socket/support.namespace.js';
import { isAutoResumeEnabled, isAiActive } from './ai-settings.service.js';
import { logger } from '../lib/logger.js';

// Turns AI back on for chats whose agent went quiet (aiResumeAt passed), and
// answers the customer's last message if nobody replied to it meanwhile.
async function sweep() {
    // Auto-resume switched off on the AI control page: chats stay as the agent left them.
    if (!(await isAutoResumeEnabled())) return;
    const due = await WhatsAppConversationModel.find({
        aiEnabled: false,
        aiResumeAt: { $ne: null, $lte: new Date() },
        status: WhatsAppConversationStatus.BOT,
    }).limit(20);

    for (const conversation of due) {
        try {
            conversation.aiEnabled = true;
            conversation.aiResumeAt = null;
            await conversation.save();
            notifyAgents('whatsapp:conversation_updated', { conversationId: conversation._id.toString() });

            // Decides for itself whether anything is still unanswered (a human may have handled it meanwhile).
            await answerPending(conversation._id.toString());
        } catch (err: any) {
            logger.error(`WhatsApp AI auto-resume failed for ${conversation._id}: ${err.message}`);
        }
    }
}

// Customers whose message was never answered: the server restarted during the short wait before answering, or the AI
// call failed. answerPending() works out for itself whether anything is still unanswered, so this only has to point it
// at recently active chats. Skips chats that are still inside their normal wait, and gives up on a chat after a few
// failures so an OpenAI outage cannot turn into a loop.
const RECOVERY_WINDOW_MS = 15 * 60_000;
const RECOVERY_MIN_AGE_MS = 45_000;
const RECOVERY_MAX_FAILURES = 3;
const recoveryFailures = new Map<string, number>();

async function recoverUnanswered() {
    if (!(await isAiActive('whatsapp'))) return;
    const now = Date.now();
    const chats = await WhatsAppConversationModel.find({
        aiEnabled: true,
        status: WhatsAppConversationStatus.BOT,
        lastMessageAt: { $gte: new Date(now - RECOVERY_WINDOW_MS), $lte: new Date(now - RECOVERY_MIN_AGE_MS) },
    })
        .select('_id lastMessageAt')
        .limit(30)
        .lean();

    for (const chat of chats) {
        const id = chat._id.toString();
        const key = `${id}:${chat.lastMessageAt?.getTime()}`; // a newer message gives the chat a fresh set of attempts
        if (hasPendingAnswer(id) || (recoveryFailures.get(key) ?? 0) >= RECOVERY_MAX_FAILURES) continue;
        try {
            await answerPending(id);
        } catch (err: any) {
            recoveryFailures.set(key, (recoveryFailures.get(key) ?? 0) + 1);
            logger.error(`WhatsApp AI recovery failed for ${id}: ${err.message}`);
        }
    }
    if (recoveryFailures.size > 500) recoveryFailures.clear();
}

export function startWhatsAppAiResume() {
    const timer = setInterval(() => void sweep().catch((e) => logger.error(`AI resume sweep: ${e.message}`)), 15_000);
    const recoveryTimer = setInterval(() => void recoverUnanswered().catch((e) => logger.error(`AI recovery sweep: ${e.message}`)), 20_000);
    // Right after a restart: answer whoever was left waiting (their 8 s timer died with the old process).
    const startupTimer = setTimeout(() => void recoverUnanswered().catch((e) => logger.error(`AI recovery sweep: ${e.message}`)), 5_000);
    return {
        stop: () => {
            clearInterval(timer);
            clearInterval(recoveryTimer);
            clearTimeout(startupTimer);
        },
    };
}
