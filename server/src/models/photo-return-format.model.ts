import { model, Schema, type Document, type Types } from 'mongoose';

export interface IPhotoReturnFormat extends Document {
    name: string;
    extension: string;
    description?: string;
    isActive: boolean;
    createdBy: Types.ObjectId;
}

const photoReturnFormatSchema = new Schema<IPhotoReturnFormat>(
    {
        name: { type: String, required: true, unique: true, trim: true, uppercase: true },
        extension: { type: String, required: true, trim: true, lowercase: true },
        description: { type: String, trim: true },
        isActive: { type: Boolean, default: true, index: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

export default model<IPhotoReturnFormat>('PhotoReturnFormat', photoReturnFormatSchema);
