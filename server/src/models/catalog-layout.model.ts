import { model, Schema, type Document } from 'mongoose';

/** Where each node sits on the catalog canvas — one shared document so every admin sees the same board. */
export interface ICatalogLayout extends Document {
    key: string;
    positions: Record<string, { x: number; y: number }>;
}

const catalogLayoutSchema = new Schema<ICatalogLayout>(
    {
        key: { type: String, required: true, unique: true, default: 'default' },
        positions: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, minimize: false },
);

export default model<ICatalogLayout>('CatalogLayout', catalogLayoutSchema);
