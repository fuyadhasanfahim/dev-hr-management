import { Schema, model, Document, Types } from 'mongoose';

export enum TaskStatus {
    PENDING      = 'pending',
    IN_PROGRESS  = 'in_progress',
    UNDER_REVIEW = 'under_review',
    COMPLETED    = 'completed',
    REJECTED     = 'rejected',
}

export enum TaskPriority {
    LOW    = 'low',
    MEDIUM = 'medium',
    HIGH   = 'high',
    URGENT = 'urgent',
}

export interface ISubTask {
    _id?: Types.ObjectId | string;
    title: string;
    completed: boolean;
    completedAt?: Date;
    isSubFeature?: boolean;
    parentName?: string;
}

export interface IOrderTask extends Document {
    orderId: Types.ObjectId;
    assignedTo: Types.ObjectId; // Ref: Staff
    assignedBy: Types.ObjectId; // Ref: User (Admin/Lead)
    
    title: string;
    description?: string;
    subtasks?: ISubTask[];
    status: TaskStatus;
    priority: TaskPriority;
    
    // Timeline
    startDate: Date;
    dueDate: Date;
    
    // Submission (Staff-driven)
    submissionNote?: string;
    submissionAttachment?: string; // Proof link or Cloudinary URL
    submittedAt?: Date;
    
    // Verification (Admin-driven)
    reviewNote?: string;
    reviewedBy?: Types.ObjectId; // Ref: User
    reviewedAt?: Date;
    
    createdAt: Date;
    updatedAt: Date;
}

const subtaskSchema = new Schema<ISubTask>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        completed: {
            type: Boolean,
            default: false,
        },
        completedAt: Date,
        isSubFeature: {
            type: Boolean,
            default: false,
        },
        parentName: {
            type: String,
            trim: true,
        },
    },
    { _id: true }
);

const taskSchema = new Schema<IOrderTask>(
    {
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            index: true,
        },
        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: 'Staff',
            required: true,
            index: true,
        },
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        subtasks: [subtaskSchema],
        status: {
            type: String,
            enum: Object.values(TaskStatus),
            default: TaskStatus.PENDING,
            index: true,
        },
        priority: {
            type: String,
            enum: Object.values(TaskPriority),
            default: TaskPriority.MEDIUM,
        },
        startDate: {
            type: Date,
            default: Date.now,
        },
        dueDate: {
            type: Date,
            required: true,
        },
        submissionNote: String,
        submissionAttachment: String,
        submittedAt: Date,
        reviewNote: String,
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        reviewedAt: Date,
    },
    {
        timestamps: true,
    }
);

// Indexes for frequent queries
taskSchema.index({ orderId: 1, status: 1 });
taskSchema.index({ assignedTo: 1, dueDate: 1 });

const OrderTaskModel = model<IOrderTask>('OrderTask', taskSchema);
export default OrderTaskModel;
