import { Schema, model, Document, Types } from 'mongoose';

export enum ChatSessionStatus {
    QUEUED             = 'queued',
    ACTIVE             = 'active',
    ENDED              = 'ended',
    CONVERTED_TO_TICKET = 'converted_to_ticket',
}

export interface IChatSession extends Document {
    sessionId: string; // unique UUID or generated ID
    clientId?: Types.ObjectId; // Ref: Client
    guestId?: Types.ObjectId; // Ref: Guest
    status: ChatSessionStatus;
    assignedAgent?: Types.ObjectId; // Ref: Staff
    linkedTicketId?: Types.ObjectId; // Ref: Ticket
    createdAt: Date;
    updatedAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
    {
        sessionId: {
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
        status: {
            type: String,
            enum: Object.values(ChatSessionStatus),
            default: ChatSessionStatus.QUEUED,
            index: true,
        },
        assignedAgent: {
            type: Schema.Types.ObjectId,
            ref: 'Staff',
            index: true,
        },
        linkedTicketId: {
            type: Schema.Types.ObjectId,
            ref: 'Ticket',
        },
    },
    {
        timestamps: true,
    }
);

chatSessionSchema.index({ status: 1, createdAt: 1 });
chatSessionSchema.index({ guestId: 1 });

const ChatSessionModel = model<IChatSession>('ChatSession', chatSessionSchema);
export default ChatSessionModel;
