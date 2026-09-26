import envConfig from '../config/env.config.js';
import KnowledgeChunkModel from '../models/knowledge-chunk.model.js';
import { logger } from '../lib/logger.js';

const SYSTEM_PROMPT = `You are the WhatsApp support assistant for Web Briks LLC, a digital agency. Be friendly and concise (2-3 sentences max).
Answer only from the CONTEXT given to you. If the context doesn't cover the question, or the customer sounds upset, wants pricing negotiation, or asks for a human — escalate instead of guessing.

Respond ONLY with valid JSON (no markdown, no code fences):
{"reply":"your message","escalate":false,"escalateReason":""}`;

interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
}

interface WhatsAppAIResult {
    reply: string;
    escalate: boolean;
    escalateReason?: string;
}

async function openaiFetch(path: string, body: unknown) {
    const res = await fetch(`https://api.openai.com/v1/${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${envConfig.openai_api_key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data: any = await res.json();
    if (!res.ok) {
        throw new Error(`OpenAI ${path} failed: ${res.status} ${JSON.stringify(data)}`);
    }
    return data;
}

async function embed(text: string): Promise<number[]> {
    const data = await openaiFetch('embeddings', {
        model: envConfig.openai_embedding_model,
        input: text,
    });
    return data.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i] ?? 0, y = b[i] ?? 0;
        dot += x * y;
        normA += x * x;
        normB += y * y;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// Brute-force top-k over the KnowledgeChunk collection — see the model's
// comment for why (no Atlas Vector Search on the local mongod).
async function retrieveContext(queryEmbedding: number[], topK = 4): Promise<string> {
    const chunks = await KnowledgeChunkModel.find().select('text embedding').lean();
    if (chunks.length === 0) return '';

    const ranked = chunks
        .map((c) => ({ text: c.text, score: cosineSimilarity(queryEmbedding, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    return ranked.map((r) => r.text).join('\n---\n');
}

export async function processWhatsAppMessage(message: string, history: ChatTurn[]): Promise<WhatsAppAIResult> {
    if (!envConfig.openai_api_key) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    let context = '';
    try {
        const queryEmbedding = await embed(message);
        context = await retrieveContext(queryEmbedding);
    } catch (err: any) {
        logger.error(`WhatsApp AI retrieval failed, answering without context: ${err.message}`);
    }

    const messages = [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${context || '(no business knowledge indexed yet)'}` },
        ...history.slice(-10),
        { role: 'user', content: message },
    ];

    const data = await openaiFetch('chat/completions', {
        model: envConfig.openai_chat_model,
        messages,
        response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(data.choices[0].message.content);
    return {
        reply: parsed.reply || "Sorry, I couldn't process that — let me get a team member to help.",
        escalate: Boolean(parsed.escalate),
        escalateReason: parsed.escalateReason,
    };
}

export default { processWhatsAppMessage };
