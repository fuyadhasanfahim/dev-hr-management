import WhatsAppConversationModel, { WhatsAppConversationStatus } from '../models/whatsapp-conversation.model.js';
import WhatsAppMessageModel, {
    WhatsAppMessageDirection,
    WhatsAppMessageSender,
    WhatsAppMessageType,
} from '../models/whatsapp-message.model.js';
import { answerWithAi } from '../controllers/whatsapp.controller.js';
import { notifyAgents } from '../socket/support.namespace.js';
import { logger } from '../lib/logger.js';

// Turns AI back on for chats whose agent went quiet (aiResumeAt passed), and
// answers the customer's last message if nobody replied to it meanwhile.
async function sweep() {
    const due = await WhatsAppConversationModel.find({
        aiEnabled: false,
        aiResumeAt: { $ne: null, $lte: new Date() },
        status: WhatsAppConversationStatus.BOT,
    }).limit(20);

    for (const conversation of due) {
        try {
            conversation.aiEnabled = true;
            conversation.aiResumeAt = null;
            conversation.assignedTo = null;
            conversation.assignedAt = null;
            await conversation.save();
            notifyAgents('whatsapp:conversation_updated', { conversationId: conversation._id.toString() });

            const last = await WhatsAppMessageModel.findOne({ conversationId: conversation._id }).sort({ createdAt: -1 });
            if (
                process.env.WHATSAPP_AI_DISABLED !== '1' &&
                last?.direction === WhatsAppMessageDirection.INBOUND &&
                last.sender === WhatsAppMessageSender.CUSTOMER &&
                last.type === WhatsAppMessageType.TEXT &&
                last.body
            ) {
                await answerWithAi(conversation, conversation.customerPhone, last.body, last.whatsappMsgId);
            }
        } catch (err: any) {
            logger.error(`WhatsApp AI auto-resume failed for ${conversation._id}: ${err.message}`);
        }
    }
}

export function startWhatsAppAiResume() {
    const timer = setInterval(() => void sweep().catch((e) => logger.error(`AI resume sweep: ${e.message}`)), 15_000);
    return { stop: () => clearInterval(timer) };
}
