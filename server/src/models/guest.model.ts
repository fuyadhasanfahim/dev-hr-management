import { Schema, model, Document } from 'mongoose';

export interface IGuest extends Document {
    name: string;
    email: string;
    emailVerified: boolean;
    otp?: string;
    otpExpiresAt?: Date;
    lastSeenAt: Date;
    ipAddress?: string;
    createdAt: Date;
    updatedAt: Date;
}

const guestSchema = new Schema<IGuest>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        emailVerified: {
            type: Boolean,
            default: false,
        },
        otp: {
            type: String,
        },
        otpExpiresAt: {
            type: Date,
        },
        lastSeenAt: {
            type: Date,
            default: Date.now,
        },
        ipAddress: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

const GuestModel = model<IGuest>('Guest', guestSchema);
export default GuestModel;
