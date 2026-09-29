import { Schema, model, Document, Types } from 'mongoose';

export enum WhatsAppConversationStatus {
    BOT       = 'bot',
    ESCALATED = 'escalated',
    RESOLVED  = 'resolved',
}

export interface IWhatsAppConversation extends Document {
    customerPhone: string;
    customerName?: string;
    status: WhatsAppConversationStatus;
    aiEnabled: boolean;
    linkedTicketId?: Types.ObjectId; // Ref: Ticket — set once escalated
    lastMessageAt: Date;
    lastReadAt: Date; // Set when an agent opens the thread — messages after this are "unread".
    createdAt: Date;
    updatedAt: Date;
}

const whatsAppConversationSchema = new Schema<IWhatsAppConversation>(
    {
        customerPhone: {
            type: String,
            required: true,
            index: true,
        },
        customerName: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(WhatsAppConversationStatus),
            default: WhatsAppConversationStatus.BOT,
            index: true,
        },
        aiEnabled: {
            type: Boolean,
            default: true,
        },
        linkedTicketId: {
            type: Schema.Types.ObjectId,
            ref: 'Ticket',
        },
        lastMessageAt: {
            type: Date,
            default: Date.now,
        },
        lastReadAt: {
            type: Date,
            default: () => new Date(0),
        },
    },
    {
        timestamps: true,
    }
);

whatsAppConversationSchema.index({ customerPhone: 1, status: 1 });

const WhatsAppConversationModel = model<IWhatsAppConversation>('WhatsAppConversation', whatsAppConversationSchema);
export default WhatsAppConversationModel;
