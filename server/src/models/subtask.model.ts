import { Schema, model, Document, Types } from 'mongoose';

export interface ISubTaskModel extends Document {
    taskId: Types.ObjectId; // Reference back to OrderTask
    title: string;
    completed: boolean;
    completedAt?: Date;
    isSubFeature?: boolean;
    parentName?: string;
    needsRevision?: boolean;
    revisionNote?: string;
}

const subtaskSchema = new Schema<ISubTaskModel>(
    {
        taskId: { type: Schema.Types.ObjectId, ref: 'OrderTask', required: true, index: true },
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
        needsRevision: {
            type: Boolean,
            default: false,
        },
        revisionNote: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

const SubtaskModel = model<ISubTaskModel>('Subtask', subtaskSchema);
export default SubtaskModel;
