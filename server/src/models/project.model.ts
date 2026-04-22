import { Schema, model, Document, Types } from 'mongoose';

export enum ProjectStatus {
    NOT_STARTED = 'not_started',
    ACTIVE = 'active',
    COMPLETED = 'completed',
    ON_HOLD = 'on_hold'
}

export enum MilestoneStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    PAID = 'paid'
}

export interface IMilestone {
    _id: Types.ObjectId;
    title: string;
    description?: string;
    amount: number;
    status: MilestoneStatus;
    dueDate?: Date;
    invoiceId?: Types.ObjectId;
}

export interface IProject extends Document {
    orderId: Types.ObjectId;
    clientId: Types.ObjectId;
    status: ProjectStatus;
    progress: number;
    startDate: Date;
    deadline?: Date;
    milestones: IMilestone[];
}

const projectSchema = new Schema<IProject>(
    {
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            unique: true,
            index: true,
        },
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: Object.values(ProjectStatus),
            default: ProjectStatus.NOT_STARTED,
            index: true,
        },
        progress: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        startDate: {
            type: Date,
            default: Date.now,
        },
        deadline: {
            type: Date,
        },
        milestones: [
            {
                title: { type: String, required: true },
                description: { type: String },
                amount: { type: Number, required: true },
                status: {
                    type: String,
                    enum: Object.values(MilestoneStatus),
                    default: MilestoneStatus.PENDING,
                },
                dueDate: { type: Date },
                invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
            },
        ],
    },
    { timestamps: true },
);

const ProjectModel = model<IProject>('Project', projectSchema);
export default ProjectModel;
