import { prisma } from '../lib/prisma.js';
import { embed } from '../lib/openai-embeddings.js';
import { entryProblem, formatContext, isLowConfidence } from '../lib/knowledge-base-utils.js';
import { KB_INSTRUCTIONS_CATEGORY, KB_MAX_INSTRUCTIONS, KB_MIN_SCORE, KB_RETRIEVE_K } from '../constants/knowledge-base.js';

export interface KnowledgeChunkSummary {
    id: string;
    text: string;
    source: string | null;
    createdByName: string | null;
    createdAt: Date;
}

export interface KnowledgeMatch {
    id: string;
    text: string;
    source: string | null;
    score: number; // cosine similarity, 0-1
}

export interface KnowledgeGapSummary {
    id: string;
    question: string;
    reason: string;
    topScore: number | null;
    count: number;
    lastAskedAt: Date;
}

/** A validation problem the staff can fix (maps to HTTP 400). */
export class KnowledgeBaseError extends Error {}

const isInstructions = (source?: string | null) => source?.trim().toLowerCase() === KB_INSTRUCTIONS_CATEGORY.toLowerCase();

// Throws a message fit to show in the form. Existing over-long entries stay as
// they are; they only have to fit when someone edits them.
function validate(text: string, source?: string) {
    const problem = entryProblem(text, source);
    if (problem) throw new KnowledgeBaseError(problem);
}

async function listChunks(): Promise<KnowledgeChunkSummary[]> {
    return prisma.$queryRaw<KnowledgeChunkSummary[]>`
        SELECT id, text, source, "createdByName", "createdAt"
        FROM knowledge_chunks
        ORDER BY "createdAt" DESC
    `;
}

async function createChunk(text: string, source?: string, createdByName?: string): Promise<KnowledgeChunkSummary> {
    validate(text, source);
    if (isInstructions(source)) await assertRoomForInstruction();
    const embedding = await embed(text);
    const embeddingLiteral = `[${embedding.join(',')}]`;
    const rows = await prisma.$queryRaw<KnowledgeChunkSummary[]>`
        INSERT INTO knowledge_chunks (id, text, embedding, source, "createdByName", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${text}, ${embeddingLiteral}::vector, ${source ?? null}, ${createdByName ?? null}, now(), now())
        RETURNING id, text, source, "createdByName", "createdAt"
    `;
    instructionsCache = null;
    return rows[0]!;
}

// Text changed → re-embed so retrieval still matches on the new wording.
async function updateChunk(id: string, text: string, source?: string): Promise<KnowledgeChunkSummary> {
    validate(text, source);
    const embedding = await embed(text);
    const embeddingLiteral = `[${embedding.join(',')}]`;
    const rows = await prisma.$queryRaw<KnowledgeChunkSummary[]>`
        UPDATE knowledge_chunks
        SET text = ${text}, embedding = ${embeddingLiteral}::vector, source = ${source ?? null}, "updatedAt" = now()
        WHERE id = ${id}
        RETURNING id, text, source, "createdByName", "createdAt"
    `;
    if (!rows[0]) throw new Error('Knowledge chunk not found');
    instructionsCache = null;
    return rows[0];
}

async function deleteChunk(id: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM knowledge_chunks WHERE id = ${id}`;
    instructionsCache = null;
}

// ─── Retrieval (what the AI reads for one customer message) ─────────────────

/**
 * Best-matching entries by cosine similarity (pgvector `<=>`), most similar
 * first. Staff-rule entries are excluded (the AI always gets those) and entries
 * below KB_MIN_SCORE are dropped as noise.
 */
async function retrieve(queryEmbedding: number[], topK = KB_RETRIEVE_K): Promise<KnowledgeMatch[]> {
    const literal = `[${queryEmbedding.join(',')}]`;
    const rows = await prisma.$queryRaw<KnowledgeMatch[]>`
        SELECT id, text, source, 1 - (embedding <=> ${literal}::vector) AS score
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL AND lower(coalesce(source, '')) <> ${KB_INSTRUCTIONS_CATEGORY.toLowerCase()}
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${topK}
    `;
    return rows.map((r) => ({ ...r, score: Number(r.score) })).filter((r) => r.score >= KB_MIN_SCORE);
}

// ─── Staff rules (always in the prompt) ─────────────────────────────────────

let instructionsCache: { at: number; text: string } | null = null;

async function assertRoomForInstruction() {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM knowledge_chunks WHERE lower(coalesce(source, '')) = ${KB_INSTRUCTIONS_CATEGORY.toLowerCase()}
    `;
    if (Number(rows[0]?.n ?? 0) >= KB_MAX_INSTRUCTIONS) {
        throw new KnowledgeBaseError(
            `You can have at most ${KB_MAX_INSTRUCTIONS} "${KB_INSTRUCTIONS_CATEGORY}" entries (the AI reads all of them on every message). Merge or remove one first.`,
        );
    }
}

// ponytail: 60s cache, per process; writes clear it for this process only —
// fine for the single devhr-server process, add a pub/sub bust if that changes.
async function getInstructions(): Promise<string> {
    if (instructionsCache && Date.now() - instructionsCache.at < 60_000) return instructionsCache.text;
    const rows = await prisma.$queryRaw<{ text: string }[]>`
        SELECT text FROM knowledge_chunks
        WHERE lower(coalesce(source, '')) = ${KB_INSTRUCTIONS_CATEGORY.toLowerCase()}
        ORDER BY "createdAt" ASC
        LIMIT ${KB_MAX_INSTRUCTIONS}
    `;
    const text = rows.map((r, i) => `${i + 1}. ${r.text}`).join('\n');
    instructionsCache = { at: Date.now(), text };
    return text;
}

// ─── Unanswered questions ───────────────────────────────────────────────────

/** Remembers a question the AI couldn't answer (counts repeats). Never throws: it must not break a reply. */
async function logGap(question: string, reason: 'escalated' | 'low_confidence', topScore?: number): Promise<void> {
    const q = question.trim().slice(0, 500);
    if (!q) return;
    try {
        await prisma.$executeRaw`
            INSERT INTO knowledge_gaps (id, question, "questionKey", reason, "topScore", count, "createdAt", "lastAskedAt")
            VALUES (gen_random_uuid()::text, ${q}, ${q.toLowerCase()}, ${reason}, ${topScore ?? null}, 1, now(), now())
            ON CONFLICT ("questionKey")
            DO UPDATE SET count = knowledge_gaps.count + 1, "lastAskedAt" = now(), reason = EXCLUDED.reason, "topScore" = EXCLUDED."topScore"
        `;
    } catch {
        // best effort
    }
}

async function listGaps(): Promise<KnowledgeGapSummary[]> {
    return prisma.$queryRaw<KnowledgeGapSummary[]>`
        SELECT id, question, reason, "topScore", count, "lastAskedAt"
        FROM knowledge_gaps
        ORDER BY count DESC, "lastAskedAt" DESC
        LIMIT 100
    `;
}

async function deleteGap(id: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM knowledge_gaps WHERE id = ${id}`;
}

export default {
    listChunks,
    createChunk,
    updateChunk,
    deleteChunk,
    retrieve,
    formatContext,
    isLowConfidence,
    getInstructions,
    logGap,
    listGaps,
    deleteGap,
};
