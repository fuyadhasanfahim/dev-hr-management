import { model, Schema, type Document, type Types } from 'mongoose';

export interface IPhotoService extends Document {
    name: string;
    description?: string;
    /** Default per-image price; 0 when none is set. Orders can override it. */
    price: number;
    isActive: boolean;
    createdBy: Types.ObjectId;
}

const photoServiceSchema = new Schema<IPhotoService>(
    {
        name: { type: String, required: true, unique: true, trim: true },
        description: { type: String, trim: true },
        price: { type: Number, default: 0, min: 0 },
        isActive: { type: Boolean, default: true, index: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

export default model<IPhotoService>('PhotoService', photoServiceSchema);
