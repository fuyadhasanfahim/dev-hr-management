import { Schema, model, Document, Types } from 'mongoose';

export enum AssetType {
    GITHUB_REPO  = 'github_repo',
    FILE         = 'file',
    URL          = 'url',
    CREDENTIAL   = 'credential',
}

export interface IOrderAssetModel extends Document {
    orderId: Types.ObjectId;
    type: AssetType;
    label: string;
    encryptedValue: string;
    isLocked: boolean;
    accessToken?: string;
    accessTokenExpiresAt?: Date;
    unlockedAt?: Date;
}

const orderAssetSchema = new Schema<IOrderAssetModel>(
    {
        orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
        type: {
            type: String,
            enum: Object.values(AssetType),
            required: true,
        },
        label: { type: String, required: true },
        encryptedValue: { type: String, required: true },
        isLocked: { type: Boolean, default: true },
        accessToken: { type: String, select: false },
        accessTokenExpiresAt: { type: Date },
        unlockedAt: { type: Date },
    },
    { timestamps: true }
);

const OrderAssetModel = model<IOrderAssetModel>('OrderAsset', orderAssetSchema);
export default OrderAssetModel;
