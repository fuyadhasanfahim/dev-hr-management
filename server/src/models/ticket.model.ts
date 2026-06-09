import { Schema, model, Document, Types } from 'mongoose';

export enum TicketStatus {
    OPEN           = 'open',
    IN_PROGRESS    = 'in_progress',
    PENDING_CLIENT = 'pending_client',
    RESOLVED       = 'resolved',
    CLOSED         = 'closed',
}

export enum TicketPriority {
    LOW    = 'low',
    MEDIUM = 'medium',
    HIGH   = 'high',
    URGENT = 'urgent',
}

export enum TicketCategory {
    SUPPORT     = 'support',
    SERVICE     = 'service',
    DEVELOPMENT = 'development',
    BILLING     = 'billing',
    BUG         = 'bug',
}

export enum TicketSource {
    DIRECT    = 'direct',
    AI_CHAT   = 'ai_chat',
    LIVE_CHAT = 'live_chat',
}

export interface ITicket extends Document {
    ticketId: string;
    clientId?: Types.ObjectId; // Ref: Client
    guestId?: Types.ObjectId; // Ref: Guest
    // Snapshot of who submitted the ticket. Denormalized so the submitter's
    // name/email always display even if the guest/client record is unpopulated
    // or later removed.
    visitorName?: string;
    visitorEmail?: string;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
    source: TicketSource;
    assignedTo?: Types.ObjectId; // Ref: Staff
    attachments: string[]; // Cloudinary/S3 URLs
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
    {
        ticketId: {
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
        subject: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(TicketStatus),
            default: TicketStatus.OPEN,
            index: true,
        },
        priority: {
            type: String,
            enum: Object.values(TicketPriority),
            default: TicketPriority.MEDIUM,
        },
        category: {
            type: String,
            enum: Object.values(TicketCategory),
            default: TicketCategory.SUPPORT,
            index: true,
        },
        source: {
            type: String,
            enum: Object.values(TicketSource),
            // No default — set explicitly by each creation flow.
            // Existing tickets without this field will read as undefined;
            // queries handle that gracefully.
            index: true,
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'Staff',
            index: true,
        },
        attachments: [{
            type: String,
        }],
        tags: [{
            type: String,
        }],
    },
    {
        timestamps: true,
    }
);

ticketSchema.index({ status: 1, assignedTo: 1 });
ticketSchema.index({ guestId: 1 });

const TicketModel = model<ITicket>('Ticket', ticketSchema);
export default TicketModel;
