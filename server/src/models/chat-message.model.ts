import { Schema, model, Document, Types } from 'mongoose';

export enum ChatSenderModel {
    CLIENT = 'Client',
    STAFF  = 'Staff',
    GUEST  = 'Guest',
    SYSTEM = 'System',
}

export interface IChatMessage extends Document {
    sessionId: Types.ObjectId; // Ref: ChatSession
    sender?: Types.ObjectId; // Ref: User/Client/Staff
    senderModel: ChatSenderModel;
    senderName?: string; // For guests or system
    content: string;
    attachments: string[];
    clientId?: string; // Id the sender's browser gave it, so a re-send never makes a second message
    editedAt?: Date;
    deletedAt?: Date; // Content and files are wiped when this is set; the row stays so the thread shows "deleted"
    readBy: Types.ObjectId[]; // Refs to users/clients who read it
    createdAt: Date;
    updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
    {
        sessionId: {
            type: Schema.Types.ObjectId,
            ref: 'ChatSession',
            required: true,
            index: true,
        },
        sender: {
            type: Schema.Types.ObjectId,
            refPath: 'senderModel',
        },
        senderModel: {
            type: String,
            required: true,
            enum: Object.values(ChatSenderModel),
        },
        senderName: {
            type: String,
        },
        content: {
            type: String,
            default: '',
        },
        attachments: [{
            type: String,
        }],
        readBy: [{
            type: Schema.Types.ObjectId,
        }],
        clientId: { type: String, index: true, sparse: true },
        editedAt: { type: Date },
        deletedAt: { type: Date },
    },
    {
        timestamps: true,
    }
);

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

const ChatMessageModel = model<IChatMessage>('ChatMessage', chatMessageSchema);
export default ChatMessageModel;
