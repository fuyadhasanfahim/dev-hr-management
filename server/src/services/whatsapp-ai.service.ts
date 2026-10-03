import envConfig from '../config/env.config.js';
import { prisma } from '../lib/prisma.js';
import { embed } from '../lib/openai-embeddings.js';
import { logger } from '../lib/logger.js';

const SYSTEM_PROMPT = `You are the AI assistant of Web Briks, a digital agency, replying to customers on WhatsApp. Be friendly and concise (2-3 sentences max).

Language: mirror the language AND script of the customer's latest message exactly.
- Bengali script (e.g. "আপনাদের কী কী সার্ভিস আছে?") → reply in Bengali script.
- Banglish, i.e. Bengali written in English letters (e.g. "apnader ki ki service ache?") → reply in Banglish, never in English and never in Bengali script.
- English → reply in English.
Keep brand names, prices, links, emails and phone numbers exactly as they appear in the CONTEXT.

Greetings: when the customer greets you (hi, hello, salam, etc.) or there are no earlier assistant messages in this chat, greet them warmly, say clearly that you are Web Briks' AI assistant, and ask how you can help — for example with websites, software, e-commerce or marketing. Mention that a human team member can join whenever they prefer. A greeting or small talk is never a reason to escalate.

Answer questions only from the CONTEXT given to you. If the context doesn't cover the question, or the customer sounds upset, wants pricing negotiation, or asks for a human — escalate instead of guessing.

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

// The knowledge base is English, and embeddings match Bengali-script queries poorly
// against English chunks — so translate those to English for retrieval only.
async function toRetrievalQuery(message: string): Promise<string> {
    if (!/[\u0980-\u09FF]/.test(message)) return message;
    try {
        const data = await openaiFetch('chat/completions', {
            model: envConfig.openai_chat_model,
            temperature: 0,
            messages: [
                { role: 'system', content: 'Translate the customer message into English for a knowledge-base search. Output only the translation.' },
                { role: 'user', content: message },
            ],
        });
        return data.choices[0].message.content.trim() || message;
    } catch (err: any) {
        logger.error(`Retrieval query translation failed, using original: ${err.message}`);
        return message;
    }
}

// Top-k nearest chunks by cosine distance, via pgvector's `<=>` operator —
// a real ANN-ready query instead of a brute-force scan in Node.
async function retrieveContext(queryEmbedding: number[], topK = 4): Promise<string> {
    const embeddingLiteral = `[${queryEmbedding.join(',')}]`;
    const rows = await prisma.$queryRaw<{ text: string }[]>`
        SELECT text FROM knowledge_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingLiteral}::vector
        LIMIT ${topK}
    `;
    return rows.map((r) => r.text).join('\n---\n');
}

export async function processWhatsAppMessage(message: string, history: ChatTurn[]): Promise<WhatsAppAIResult> {
    if (!envConfig.openai_api_key) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    let context = '';
    try {
        const queryEmbedding = await embed(await toRetrievalQuery(message));
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
