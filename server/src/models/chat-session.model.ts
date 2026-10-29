import { Schema, model, Document, Types } from 'mongoose';
import TicketModel, { TicketStatus } from './ticket.model.js';

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
    contactId?: Types.ObjectId; // Ref: Contact
    handedOffToWhatsApp?: boolean; // The team moved this chat to WhatsApp; the website chat is read-only now.
    whatsappConversationId?: Types.ObjectId; // Ref: WhatsAppConversation it moved to
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
        contactId: {
            type: Schema.Types.ObjectId,
            ref: 'Contact',
            index: true,
        },
        handedOffToWhatsApp: { type: Boolean, default: false },
        whatsappConversationId: { type: Schema.Types.ObjectId, ref: 'WhatsAppConversation' },
    },
    {
        timestamps: true,
    }
);

chatSessionSchema.index({ status: 1, createdAt: 1 });

// A ticket opened from a live chat (see live-chat.service) follows the agent who took the chat. Ending the chat does
// not touch it: the ticket carries on by email. Never blocks saving the session.
chatSessionSchema.pre('save', function () {
    this.$locals.assignedChanged = !this.isNew && this.isModified('assignedAgent');
});

chatSessionSchema.post('save', async function (doc) {
    try {
        if (doc.$locals.assignedChanged && doc.assignedAgent) {
            await TicketModel.updateOne({ chatSessionId: doc._id }, { $set: { assignedTo: doc.assignedAgent } });
            await TicketModel.updateOne({ chatSessionId: doc._id, status: TicketStatus.OPEN }, { $set: { status: TicketStatus.IN_PROGRESS } });
        }
    } catch {
        // the ticket sync is best effort
    }
});

chatSessionSchema.pre('save', async function () {
    if (!this.isNew || this.contactId) return;
    const { contactIdFor, identityOf } = await import('../services/contact.service.js');
    this.contactId = await contactIdFor(identityOf(this));
});

const ChatSessionModel = model<IChatSession>('ChatSession', chatSessionSchema);
export default ChatSessionModel;
