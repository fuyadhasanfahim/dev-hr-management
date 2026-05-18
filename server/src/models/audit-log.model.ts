import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
    userId?: Types.ObjectId; // Ref: User or Staff or Client
    userType?: string; // 'Staff' | 'Client' | 'Guest' | 'System'
    action: string; // e.g. 'ticket_transferred', 'queue_override'
    details: Record<string, any>;
    ipAddress?: string;
    createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            index: true,
        },
        userType: {
            type: String,
            enum: ['Staff', 'Client', 'Guest', 'System'],
        },
        action: {
            type: String,
            required: true,
            index: true,
        },
        details: {
            type: Schema.Types.Map,
            of: Schema.Types.Mixed,
            default: {},
        },
        ipAddress: {
            type: String,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLogModel;
