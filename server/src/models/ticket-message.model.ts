import { Schema, model, Document, Types } from 'mongoose';

export enum MessageSenderModel {
    CLIENT = 'Client',
    STAFF  = 'Staff',
    GUEST  = 'Guest',
}

export interface ITicketMessage extends Document {
    ticketId: Types.ObjectId; // Ref: Ticket
    senderId?: Types.ObjectId; // Ref: User/Client/Staff
    senderModel: MessageSenderModel;
    senderName?: string; // For guests
    content: string;
    attachments: string[];
    isInternalNote: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ticketMessageSchema = new Schema<ITicketMessage>(
    {
        ticketId: {
            type: Schema.Types.ObjectId,
            ref: 'Ticket',
            required: true,
            index: true,
        },
        senderId: {
            type: Schema.Types.ObjectId,
            refPath: 'senderModel',
        },
        senderModel: {
            type: String,
            required: true,
            enum: Object.values(MessageSenderModel),
        },
        senderName: {
            type: String,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        attachments: [{
            type: String,
        }],
        isInternalNote: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

ticketMessageSchema.index({ ticketId: 1, createdAt: 1 });

const TicketMessageModel = model<ITicketMessage>('TicketMessage', ticketMessageSchema);
export default TicketMessageModel;
