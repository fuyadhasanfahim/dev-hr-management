import { Schema, model, Document, Types } from 'mongoose';

export enum AiChatAction {
    CONTINUE             = 'continue',
    CREATE_TICKET        = 'create_ticket',
    CONNECT_LIVE_SUPPORT = 'connect_live_support',
    BOOK_CONSULTATION    = 'book_consultation',
}

export enum AiMessageRole {
    USER  = 'user',
    MODEL = 'model',
}

export interface IAiMessage {
    role: AiMessageRole;
    content: string;
    action?: AiChatAction; // only set on model messages
    createdAt?: Date;
}

export interface IAiConversation extends Document {
    conversationId: string; // unique UUID
    clientId?: Types.ObjectId; // Ref: Client
    guestId?: Types.ObjectId; // Ref: Guest
    visitorEmail?: string; // captured if known (e.g. from consultationData)
    visitorName?: string;
    visitorPhone?: string;
    contactId?: Types.ObjectId; // Ref: Contact — set once we know who the visitor is
    linkedTicketId?: Types.ObjectId; // Ref: Ticket — the ticket the assistant raised from this chat
    aiMemory?: string; // Running profile of the visitor, like the WhatsApp assistant's memory
    messages: IAiMessage[];
    lastAction?: AiChatAction; // the most recent action taken
    messageCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const aiMessageSchema = new Schema<IAiMessage>(
    {
        role: {
            type: String,
            enum: Object.values(AiMessageRole),
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        action: {
            type: String,
            enum: Object.values(AiChatAction),
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const aiConversationSchema = new Schema<IAiConversation>(
    {
        conversationId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            index: true,
        },
        guestId: {
            type: Schema.Types.ObjectId,
            ref: 'Guest',
            index: true,
        },
        visitorEmail: {
            type: String,
            trim: true,
        },
        visitorName: { type: String, trim: true },
        visitorPhone: { type: String, trim: true },
        contactId: { type: Schema.Types.ObjectId, ref: 'Contact', index: true },
        linkedTicketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
        aiMemory: { type: String, default: '' },
        messages: {
            type: [aiMessageSchema],
            default: [],
        },
        lastAction: {
            type: String,
            enum: Object.values(AiChatAction),
        },
        messageCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

aiConversationSchema.index({ clientId: 1, updatedAt: -1 });
aiConversationSchema.index({ guestId: 1, updatedAt: -1 });
aiConversationSchema.index({ updatedAt: -1 });

const AiConversationModel = model<IAiConversation>('AiConversation', aiConversationSchema);
export default AiConversationModel;
