import { Schema, model, Document, Types } from 'mongoose';

export enum WhatsAppMessageDirection {
    INBOUND  = 'inbound',
    OUTBOUND = 'outbound',
}

export enum WhatsAppMessageSender {
    CUSTOMER = 'customer',
    AI       = 'ai',
    AGENT    = 'agent',
}

// Outbound delivery lifecycle, driven by the send queue then Meta's status webhooks.
export enum WhatsAppMessageStatus {
    PENDING   = 'pending',
    SENT      = 'sent',
    DELIVERED = 'delivered',
    READ      = 'read',
    FAILED    = 'failed',
}

export interface IWhatsAppMessage extends Document {
    conversationId: Types.ObjectId; // Ref: WhatsAppConversation
    direction: WhatsAppMessageDirection;
    sender: WhatsAppMessageSender;
    body: string;
    // Meta's message id — dedupe key for inbound, delivery id for outbound.
    // Queued outbound messages hold a `pending:<_id>` placeholder until Meta accepts them.
    whatsappMsgId: string;
    status?: WhatsAppMessageStatus; // Outbound only.
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

const whatsAppMessageSchema = new Schema<IWhatsAppMessage>(
    {
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: 'WhatsAppConversation',
            required: true,
            index: true,
        },
        direction: {
            type: String,
            enum: Object.values(WhatsAppMessageDirection),
            required: true,
        },
        sender: {
            type: String,
            enum: Object.values(WhatsAppMessageSender),
            required: true,
        },
        body: {
            type: String,
            required: true,
        },
        whatsappMsgId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        status: {
            type: String,
            enum: Object.values(WhatsAppMessageStatus),
        },
        error: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

whatsAppMessageSchema.index({ conversationId: 1, createdAt: 1 });

const WhatsAppMessageModel = model<IWhatsAppMessage>('WhatsAppMessage', whatsAppMessageSchema);
export default WhatsAppMessageModel;
