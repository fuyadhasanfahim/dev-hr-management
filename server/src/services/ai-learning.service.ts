import { prisma } from '../lib/prisma.js';
import { embed } from '../lib/openai-embeddings.js';
import { openaiFetch } from '../lib/openai-chat.js';
import { Types } from 'mongoose';
import { logger } from '../lib/logger.js';
import envConfig from '../config/env.config.js';
import {
    EXAMPLE_MAX_CHARS,
    EXAMPLE_STYLE_K,
    EXAMPLE_STYLE_MIN_SCORE,
    EXAMPLE_TAUGHT_K,
    EXAMPLE_TAUGHT_MIN_SCORE,
    type KbChannel,
} from '../constants/knowledge-base.js';
import WhatsAppMessageModel, { WhatsAppMessageDirection, WhatsAppMessageType } from '../models/whatsapp-message.model.js';
import { KnowledgeBaseError } from './knowledge-base.service.js';
import { newestEditLast } from '../lib/knowledge-base-utils.js';

// What the AI learns from beyond the knowledge base:
//   qa         — a reply staff wrote for a question the AI couldn't answer
//   correction — staff rewrote a reply the AI had sent
//   agent      — a real agent's reply (kept for review; staff approve the good ones)
export type ExampleKind = 'qa' | 'correction' | 'agent';

export interface AiExample {
    id: string;
    kind: ExampleKind;
    question: string;
    context: string | null;
    answer: string;
    badAnswer: string | null;
    approved: boolean;
    agentName: string | null;
    createdByName: string | null;
    createdAt: Date;
    updatedAt?: Date;
}

export interface AiReplyLog {
    id: string;
    channel: string;
    conversationId: string | null;
    customerName: string | null;
    customerMessage: string;
    context: string | null;
    aiReply: string;
    escalated: boolean;
    topScore: number | null;
    sources: string[];
    status: 'ok' | 'corrected';
    createdAt: Date;
}

const COLUMNS = `id, kind, question, context, answer, "badAnswer", approved, "agentName", "createdByName", "createdAt"`;
const literal = (v: number[]) => `[${v.join(',')}]`;

function checkText(label: string, text: string) {
    if (!text.trim()) throw new KnowledgeBaseError(`${label} can't be empty.`);
    if (text.length > EXAMPLE_MAX_CHARS) throw new KnowledgeBaseError(`${label} is ${text.length} characters; the limit is ${EXAMPLE_MAX_CHARS}.`);
}

// ─── reply log ─────────────────────────────────────────────────────────────

/** Records an AI reply for review. Never throws: it must not break a reply. */
async function logReply(entry: {
    channel?: KbChannel;
    conversationId?: string;
    customerName?: string;
    customerMessage: string;
    context?: string;
    aiReply: string;
    escalated: boolean;
    topScore?: number;
    sources: string[];
}): Promise<void> {
    try {
        await prisma.$executeRaw`
            INSERT INTO ai_reply_logs (id, channel, "conversationId", "customerName", "customerMessage", context, "aiReply", escalated, "topScore", sources, "createdAt")
            VALUES (gen_random_uuid()::text, ${entry.channel ?? 'whatsapp'}, ${entry.conversationId ?? null}, ${entry.customerName ?? null}, ${entry.customerMessage.slice(0, 2000)},
                    ${entry.context?.slice(0, 3000) ?? null}, ${entry.aiReply.slice(0, 4000)}, ${entry.escalated}, ${entry.topScore ?? null},
                    ${JSON.stringify(entry.sources.map((s) => s.slice(0, 200)))}, now())
        `;
    } catch (err: any) {
        logger.error(`AI reply log failed: ${err.message}`);
    }
}

async function listReplies(opts: { status?: string; like: string | null; limit: number; offset: number; channel?: KbChannel | null }): Promise<{ items: AiReplyLog[]; total: number }> {
    const { like, limit, offset } = opts;
    const channel = opts.channel ?? null;
    const status = opts.status === 'corrected' || opts.status === 'ok' ? opts.status : null;
    const [rows, count] = await Promise.all([
        prisma.$queryRaw<(Omit<AiReplyLog, 'sources'> & { sources: string | null })[]>`
            SELECT id, channel, "conversationId", "customerName", "customerMessage", context, "aiReply", escalated, "topScore", sources, status, "createdAt"
            FROM ai_reply_logs
            WHERE (${channel}::text IS NULL OR channel = ${channel})
              AND (${status}::text IS NULL OR status = ${status})
              AND (${like}::text IS NULL OR "customerMessage" ILIKE ${like} OR "aiReply" ILIKE ${like} OR coalesce("customerName", '') ILIKE ${like})
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
        `,
        prisma.$queryRaw<{ n: bigint }[]>`
            SELECT count(*) AS n FROM ai_reply_logs
            WHERE (${channel}::text IS NULL OR channel = ${channel})
              AND (${status}::text IS NULL OR status = ${status})
              AND (${like}::text IS NULL OR "customerMessage" ILIKE ${like} OR "aiReply" ILIKE ${like} OR coalesce("customerName", '') ILIKE ${like})
        `,
    ]);
    return { items: rows.map((r) => ({ ...r, sources: r.sources ? JSON.parse(r.sources) : [] })), total: Number(count[0]?.n ?? 0) };
}

/** Counts behind the AI-learning tabs: reply log by review state, staff-taught replies, human replies by approval. */
async function learningStats(channel: KbChannel | null = null) {
    const [replies, examples] = await Promise.all([
        prisma.$queryRaw<{ total: bigint; corrected: bigint }[]>`
            SELECT count(*) AS total, count(*) FILTER (WHERE status = 'corrected') AS corrected FROM ai_reply_logs
            WHERE (${channel}::text IS NULL OR channel = ${channel})
        `,
        prisma.$queryRaw<{ taught: bigint; humanNew: bigint; humanTaught: bigint }[]>`
            SELECT count(*) FILTER (WHERE kind <> 'agent') AS "taught",
                   count(*) FILTER (WHERE kind = 'agent' AND NOT approved) AS "humanNew",
                   count(*) FILTER (WHERE kind = 'agent' AND approved) AS "humanTaught"
            FROM ai_examples
        `,
    ]);
    const r = replies[0];
    const e = examples[0];
    return {
        replies: Number(r?.total ?? 0),
        repliesCorrected: Number(r?.corrected ?? 0),
        taught: Number(e?.taught ?? 0),
        humanNew: Number(e?.humanNew ?? 0),
        humanTaught: Number(e?.humanTaught ?? 0),
    };
}

/** Staff rewrote an AI reply: remember "when a customer says this, reply like that". Latest correction wins. */
async function correctReply(logId: string, goodReply: string, byName: string): Promise<AiExample> {
    checkText('The corrected reply', goodReply);
    const logs = await prisma.$queryRaw<{ customerMessage: string; context: string | null; aiReply: string }[]>`
        SELECT "customerMessage", context, "aiReply" FROM ai_reply_logs WHERE id = ${logId}
    `;
    const log = logs[0];
    if (!log) throw new KnowledgeBaseError('That reply no longer exists.');

    const example = await createExample({
        kind: 'correction',
        question: log.customerMessage,
        context: log.context ?? undefined,
        answer: goodReply,
        badAnswer: log.aiReply,
        approved: true,
        createdByName: byName,
    });
    await prisma.$executeRaw`UPDATE ai_reply_logs SET status = 'corrected', "correctionId" = ${example.id} WHERE id = ${logId}`;
    return example;
}

// ─── examples ──────────────────────────────────────────────────────────────

async function createExample(input: {
    kind: ExampleKind;
    question: string;
    context?: string;
    answer: string;
    badAnswer?: string;
    approved: boolean;
    sourceKey?: string;
    agentName?: string;
    createdByName?: string;
}): Promise<AiExample> {
    const question = input.question.trim().slice(0, 1000);
    // Only approved rows are ever retrieved, so only they need an embedding.
    const embedding = input.approved ? literal(await embed(question)) : null;
    const rows = await prisma.$queryRawUnsafe<AiExample[]>(
        `INSERT INTO ai_examples (id, kind, question, context, answer, "badAnswer", embedding, approved, "sourceKey", "agentName", "createdByName", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::vector, $7, $8, $9, $10, now(), now())
         RETURNING ${COLUMNS}`,
        input.kind,
        question,
        input.context?.slice(0, 3000) ?? null,
        input.answer.trim(),
        input.badAnswer?.slice(0, 4000) ?? null,
        embedding,
        input.approved,
        input.sourceKey ?? null,
        input.agentName ?? null,
        input.createdByName ?? null,
    );
    return rows[0]!;
}

/** Staff-written reply for a question the AI couldn't answer; clears it from the "unanswered" list. */
async function answerGap(gapId: string, answer: string, byName: string): Promise<AiExample> {
    checkText('The reply', answer);
    const gaps = await prisma.$queryRaw<{ question: string }[]>`SELECT question FROM knowledge_gaps WHERE id = ${gapId}`;
    const gap = gaps[0];
    if (!gap) throw new KnowledgeBaseError('That question is no longer in the list.');
    const example = await createExample({ kind: 'qa', question: gap.question, answer, approved: true, createdByName: byName });
    await prisma.$executeRaw`DELETE FROM knowledge_gaps WHERE id = ${gapId}`;
    return example;
}

async function createQa(question: string, answer: string, byName: string): Promise<AiExample> {
    checkText('The question', question);
    checkText('The reply', answer);
    return createExample({ kind: 'qa', question, answer, approved: true, createdByName: byName });
}

// kind 'taught' = everything staff wrote or corrected (qa + correction); the others filter by exact kind.
async function listExamples(opts: {
    kind?: string;
    approved?: boolean;
    like: string | null;
    limit: number;
    offset: number;
}): Promise<{ items: AiExample[]; total: number }> {
    const k = opts.kind === 'qa' || opts.kind === 'correction' || opts.kind === 'agent' || opts.kind === 'taught' ? opts.kind : null;
    const a = typeof opts.approved === 'boolean' ? opts.approved : null;
    const where = `($1::text IS NULL OR kind = $1 OR ($1 = 'taught' AND kind <> 'agent'))
         AND ($2::boolean IS NULL OR approved = $2)
         AND ($3::text IS NULL OR question ILIKE $3 OR answer ILIKE $3)`;
    const [items, count] = await Promise.all([
        prisma.$queryRawUnsafe<AiExample[]>(
            `SELECT ${COLUMNS} FROM ai_examples WHERE ${where} ORDER BY "createdAt" DESC LIMIT $4 OFFSET $5`,
            k,
            a,
            opts.like,
            opts.limit,
            opts.offset,
        ),
        prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ai_examples WHERE ${where}`, k, a, opts.like),
    ]);
    return { items, total: Number(count[0]?.n ?? 0) };
}

async function updateExample(id: string, patch: { question?: string; answer?: string; approved?: boolean }): Promise<AiExample> {
    const current = (await prisma.$queryRawUnsafe<AiExample[]>(`SELECT ${COLUMNS} FROM ai_examples WHERE id = $1`, id))[0];
    if (!current) throw new KnowledgeBaseError('Not found.');
    const question = (patch.question ?? current.question).trim();
    const answer = (patch.answer ?? current.answer).trim();
    const approved = patch.approved ?? current.approved;
    checkText('The question', question);
    checkText('The reply', answer);
    const embedding = approved ? literal(await embed(question)) : null;
    const rows = await prisma.$queryRawUnsafe<AiExample[]>(
        `UPDATE ai_examples SET question = $2, answer = $3, approved = $4, embedding = $5::vector, "updatedAt" = now()
         WHERE id = $1 RETURNING ${COLUMNS}`,
        id,
        question,
        answer,
        approved,
        embedding,
    );
    return rows[0]!;
}

async function deleteExample(id: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM ai_examples WHERE id = ${id}`;
}

// ─── learning from real agents ─────────────────────────────────────────────

const clip = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 400);

/**
 * Keeps an agent's text reply together with the customer message it answered (and a little of the chat
 * before it) for staff to review. One pair per customer message. Never throws.
 */
async function captureAgentReply(conversationId: Types.ObjectId | string, answer: string, agentName: string): Promise<void> {
    try {
        const text = answer.trim();
        if (text.length < 3 || text.length > EXAMPLE_MAX_CHARS) return;
        const inbound = await WhatsAppMessageModel.findOne({
            conversationId,
            direction: WhatsAppMessageDirection.INBOUND,
            type: WhatsAppMessageType.TEXT,
            body: { $ne: '' },
        }).sort({ createdAt: -1 });
        if (!inbound?.body) return;
        // Ignore replies to a message from long ago (an unrelated follow-up, not an answer).
        if (Date.now() - inbound.createdAt.getTime() > 24 * 3600_000) return;

        const before = await WhatsAppMessageModel.find({
            conversationId,
            type: WhatsAppMessageType.TEXT,
            body: { $ne: '' },
            createdAt: { $lt: inbound.createdAt },
        })
            .sort({ createdAt: -1 })
            .limit(4);
        const context = before
            .reverse()
            .map((m) => `${m.direction === WhatsAppMessageDirection.INBOUND ? 'Customer' : 'Team'}: ${clip(m.body)}`)
            .join('\n');

        // Embedded straight away: the AI learns the team's tone from every human reply without waiting for review
        // (staff approval still decides whether a reply is also followed as a fact — see retrieve()).
        const embedding = literal(await embed(inbound.body.slice(0, 1000)));
        await prisma.$executeRawUnsafe(
            `INSERT INTO ai_examples (id, kind, question, context, answer, embedding, approved, "sourceKey", "agentName", "createdAt", "updatedAt")
             VALUES (gen_random_uuid()::text, 'agent', $1, $2, $3, $4::vector, false, $5, $6, now(), now())
             ON CONFLICT ("sourceKey") DO NOTHING`,
            inbound.body.slice(0, 1000),
            context || null,
            text,
            embedding,
            `msg:${inbound._id}`,
            agentName,
        );
    } catch (err: any) {
        logger.error(`Agent reply capture failed: ${err.message}`);
    }
}

// ─── used while answering ──────────────────────────────────────────────────

export interface ExamplesForPrompt {
    taught: Pick<AiExample, 'kind' | 'question' | 'context' | 'answer'>[]; // follow these
    style: Pick<AiExample, 'question' | 'context' | 'answer'>[]; // tone guide only
}

async function retrieve(queryEmbedding: number[]): Promise<ExamplesForPrompt> {
    const lit = literal(queryEmbedding);
    const find = (kinds: string[], k: number) =>
        prisma.$queryRawUnsafe<(AiExample & { score: number })[]>(
            `SELECT kind, question, context, answer, "createdAt", "updatedAt", 1 - (embedding <=> $1::vector) AS score
             FROM ai_examples WHERE (approved OR kind = 'agent') AND embedding IS NOT NULL AND kind = ANY($2::text[])
             ORDER BY embedding <=> $1::vector LIMIT ${k}`,
            lit,
            kinds,
        );
    const [taught, style] = await Promise.all([find(['qa', 'correction'], EXAMPLE_TAUGHT_K), find(['agent'], EXAMPLE_STYLE_K)]);
    return {
        // Oldest first, so when two taught replies disagree the newest (last) one is the one the model sees as final.
        // A reply staff just edited counts as newest (sorted by last edit, not by when it was first written).
        taught: newestEditLast(taught.filter((r) => Number(r.score) >= EXAMPLE_TAUGHT_MIN_SCORE)),
        style: style.filter((r) => Number(r.score) >= EXAMPLE_STYLE_MIN_SCORE),
    };
}

export function formatExamples(list: { question: string; context?: string | null; answer: string }[]): string {
    return list
        .map((e) => `${e.context ? `(chat so far)\n${e.context}\n` : ''}Customer: ${e.question}\nReply: ${e.answer}`)
        .join('\n---\n');
}

// ─── style guide ───────────────────────────────────────────────────────────

/** Reads recent human replies and drafts a "how our team talks" guide for staff to review and save as an AI rule. */
async function draftStyleGuide(): Promise<string> {
    const pairs = await prisma.$queryRaw<{ question: string; answer: string }[]>`
        SELECT question, answer FROM ai_examples WHERE kind = 'agent' ORDER BY "createdAt" DESC LIMIT 120
    `;
    if (pairs.length < 10) throw new KnowledgeBaseError('Not enough human replies yet — at least 10 are needed to see a pattern.');
    const sample = pairs.map((p) => `Customer: ${clip(p.question)}\nTeam: ${clip(p.answer)}`).join('\n---\n');
    const data = await openaiFetch('chat/completions', {
        model: envConfig.openai_chat_model,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content:
                    'You study how a digital agency\'s human sales/support agents reply to customers on WhatsApp and write a short style guide an AI assistant must follow to sound exactly like them. ' +
                    'Cover: how they greet, how they open and keep the conversation going, how long their messages are, tone and politeness, what they ask the customer and in what order, when they mention price, how they close. ' +
                    'Be concrete (quote typical phrasings). Max 900 characters, plain text, no markdown headings. Write in English.',
            },
            { role: 'user', content: sample },
        ],
    });
    return String(data.choices[0].message.content ?? '').trim().slice(0, 1000);
}

export default {
    logReply,
    listReplies,
    learningStats,
    correctReply,
    answerGap,
    createQa,
    listExamples,
    updateExample,
    deleteExample,
    captureAgentReply,
    retrieve,
    draftStyleGuide,
};
