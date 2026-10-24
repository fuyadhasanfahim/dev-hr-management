import { Schema, model, Document, Types } from 'mongoose';
import { SALES_STAGES, type SalesStage } from '../lib/sales-flow.js';

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

// One entry per change of sales stage: what the AI moved to, when, and why — so staff can follow the sale later.
export interface ISalesStageEntry {
    stage: SalesStage;
    reason: string;
    at: Date;
}

export interface IWhatsAppConversation extends Document {
    customerPhone: string;
    customerName?: string;
    status: WhatsAppConversationStatus;
    aiEnabled: boolean;
    aiResumeAt?: Date | null; // When set, AI switches itself back on at this time (agent went quiet).
    linkedTicketId?: Types.ObjectId; // Ref: Ticket — set once escalated
    assignedTo?: IWhatsAppAssignee | null;
    assignedAt?: Date | null;
    salesStage?: SalesStage | null; // where the AI's sales flow stands (see lib/sales-flow.ts)
    salesStageReason?: string;
    salesStageHistory?: ISalesStageEntry[];
    aiMemory?: string; // Short running profile of the customer (business, platform, budget...) kept across the whole chat.
    aiAnsweredUpTo?: Date | null; // createdAt of the newest customer message the AI has already answered.
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
        aiResumeAt: {
            type: Date,
            default: null,
            index: true,
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
        salesStage: { type: String, enum: [...SALES_STAGES], default: null },
        salesStageReason: { type: String, default: '' },
        salesStageHistory: {
            type: [new Schema<ISalesStageEntry>({ stage: { type: String, enum: [...SALES_STAGES] }, reason: String, at: Date }, { _id: false })],
            default: [],
        },
        aiMemory: { type: String, default: '' },
        aiAnsweredUpTo: { type: Date, default: null },
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
