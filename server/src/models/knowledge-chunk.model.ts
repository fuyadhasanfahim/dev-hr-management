import { Schema, model, Document } from 'mongoose';

// Business-knowledge chunks for the WhatsApp AI's retrieval-augmented replies.
// Local mongod has no Atlas Vector Search, so retrieval is a brute-force
// cosine-similarity scan over `embedding` done in whatsapp-ai.service —
// fine at this KB's size. Re-embed everything if OPENAI_EMBEDDING_MODEL changes.
export interface IKnowledgeChunk extends Document {
    text: string;
    embedding: number[];
    source?: string; // e.g. filename/section this chunk came from
    createdAt: Date;
    updatedAt: Date;
}

const knowledgeChunkSchema = new Schema<IKnowledgeChunk>(
    {
        text: {
            type: String,
            required: true,
        },
        embedding: {
            type: [Number],
            required: true,
        },
        source: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

const KnowledgeChunkModel = model<IKnowledgeChunk>('KnowledgeChunk', knowledgeChunkSchema);
export default KnowledgeChunkModel;
