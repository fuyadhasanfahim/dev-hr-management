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

export interface ITicket extends Document {
    ticketId: string;
    clientId?: Types.ObjectId; // Ref: Client
    guestId?: Types.ObjectId; // Ref: Guest
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
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
