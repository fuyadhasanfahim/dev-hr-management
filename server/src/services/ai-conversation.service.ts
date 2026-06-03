import AiConversationModel, {
    AiChatAction,
    AiMessageRole,
    type IAiMessage,
} from '../models/ai-conversation.model.js';
import { AppError } from '../utils/AppError.js';
import crypto from 'crypto';
import { Types } from 'mongoose';

/**
 * Appends a single AI chat turn (the user message + the model reply) to a
 * conversation, creating the conversation if it does not yet exist.
 */
export async function appendTurn(args: {
    conversationId?: string;
    clientId?: string;
    guestId?: string;
    visitorEmail?: string;
    userMessage: string;
    aiReply: string;
    action: string;
}): Promise<any> {
    const {
        conversationId,
        clientId,
        guestId,
        visitorEmail,
        userMessage,
        aiReply,
        action,
    } = args;

    const userTurn: IAiMessage = {
        role: AiMessageRole.USER,
        content: userMessage,
    };
    const modelTurn: IAiMessage = {
        role: AiMessageRole.MODEL,
        content: aiReply,
        action: action as AiChatAction,
    };

    if (conversationId) {
        const existing = await AiConversationModel.findOne({ conversationId });
        if (existing) {
            existing.messages.push(userTurn, modelTurn);
            existing.lastAction = action as AiChatAction;
            existing.messageCount += 2;
            if (visitorEmail && !existing.visitorEmail) {
                existing.visitorEmail = visitorEmail;
            }
            await existing.save();
            return existing;
        }
    }

    const conversationFields: any = {
        conversationId: crypto.randomUUID(),
        messages: [userTurn, modelTurn],
        lastAction: action as AiChatAction,
        messageCount: 2,
    };

    if (clientId) {
        conversationFields.clientId = new Types.ObjectId(clientId);
    }
    if (guestId) {
        conversationFields.guestId = new Types.ObjectId(guestId);
    }
    if (visitorEmail) {
        conversationFields.visitorEmail = visitorEmail;
    }

    const conversation = await AiConversationModel.create(conversationFields);
    return conversation;
}

/**
 * Retrieves a single AI conversation by its conversationId.
 */
export async function getConversation(conversationId: string): Promise<any> {
    const conversation = await AiConversationModel.findOne({ conversationId });
    if (!conversation) {
        throw new AppError('AI conversation not found', 404);
    }
    return conversation;
}

export default {
    appendTurn,
    getConversation,
};
