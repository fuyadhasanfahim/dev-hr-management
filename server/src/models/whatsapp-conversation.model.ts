import { Schema, model, Document, Types } from 'mongoose';

export enum WhatsAppConversationStatus {
    BOT       = 'bot',
    ESCALATED = 'escalated',
    RESOLVED  = 'resolved',
}

// The agent handling a chat. Only they may reply until they release it or
// someone with support.manage takes it over — two agents never answer at once.
export interface IWhatsAppAssignee {
    id: string;
    name: string;
}

export interface IWhatsAppConversation extends Document {
    customerPhone: string;
    customerName?: string;
    status: WhatsAppConversationStatus;
    aiEnabled: boolean;
    linkedTicketId?: Types.ObjectId; // Ref: Ticket — set once escalated
    assignedTo?: IWhatsAppAssignee | null;
    assignedAt?: Date | null;
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
        assignedTo: {
            type: new Schema<IWhatsAppAssignee>({ id: { type: String, required: true }, name: String }, { _id: false }),
            default: null,
        },
        assignedAt: {
            type: Date,
            default: null,
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
