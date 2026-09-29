import { prisma } from '../lib/prisma.js';
import { embed } from '../lib/openai-embeddings.js';

export interface KnowledgeChunkSummary {
    id: string;
    text: string;
    source: string | null;
    createdAt: Date;
}

async function listChunks(): Promise<KnowledgeChunkSummary[]> {
    return prisma.$queryRaw<KnowledgeChunkSummary[]>`
        SELECT id, text, source, "createdAt"
        FROM knowledge_chunks
        ORDER BY "createdAt" DESC
    `;
}

async function createChunk(text: string, source?: string): Promise<KnowledgeChunkSummary> {
    const embedding = await embed(text);
    const embeddingLiteral = `[${embedding.join(',')}]`;
    const rows = await prisma.$queryRaw<KnowledgeChunkSummary[]>`
        INSERT INTO knowledge_chunks (id, text, embedding, source, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${text}, ${embeddingLiteral}::vector, ${source ?? null}, now(), now())
        RETURNING id, text, source, "createdAt"
    `;
    return rows[0]!;
}

// Text changed → re-embed so retrieval still matches on the new wording.
async function updateChunk(id: string, text: string, source?: string): Promise<KnowledgeChunkSummary> {
    const embedding = await embed(text);
    const embeddingLiteral = `[${embedding.join(',')}]`;
    const rows = await prisma.$queryRaw<KnowledgeChunkSummary[]>`
        UPDATE knowledge_chunks
        SET text = ${text}, embedding = ${embeddingLiteral}::vector, source = ${source ?? null}, "updatedAt" = now()
        WHERE id = ${id}
        RETURNING id, text, source, "createdAt"
    `;
    if (!rows[0]) throw new Error('Knowledge chunk not found');
    return rows[0];
}

async function deleteChunk(id: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM knowledge_chunks WHERE id = ${id}`;
}

export default { listChunks, createChunk, updateChunk, deleteChunk };
