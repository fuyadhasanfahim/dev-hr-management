import envConfig from '../config/env.config.js';
import { prisma } from '../lib/prisma.js';
import { embed } from '../lib/openai-embeddings.js';
import { logger } from '../lib/logger.js';

const SYSTEM_PROMPT = `You are the AI assistant of Web Briks, a digital agency, replying to customers on WhatsApp. Be friendly and concise (2-4 short sentences).

Language: mirror the language AND script of the customer's latest message exactly.
- Bengali script (e.g. "আপনাদের কী কী সার্ভিস আছে?") → reply in Bengali script.
- Banglish, i.e. Bengali written in English letters (e.g. "apnader ki ki service ache?") → reply in Banglish, never in English and never in Bengali script.
- English → reply in English.
Keep brand names, prices, links, emails and phone numbers exactly as they appear in the CONTEXT.

Greetings: when the customer greets you (hi, hello, salam, etc.) or there are no earlier assistant messages in this chat, greet them warmly, say clearly that you are Web Briks' AI assistant, and ask how you can help — for example with websites, software, e-commerce or marketing. Mention that a human team member can join whenever they prefer. A greeting or small talk is never a reason to escalate.

Conversation style: you are advising one specific customer, not reading out a brochure. Read the whole chat first and remember what they have told you — their business, products, goal (brand, sales, launch), budget, timeline, what they already have — and what they already asked.
- Tailor every answer to that: pick the one or two options from the CONTEXT that fit their situation and say briefly why (e.g. for a low budget and low hosting cost → Laravel; for a unique brand design → Next.js), instead of listing everything.
- Connect the answer to their goal and the result they want, without promising sales, rankings or profit.
- Never repeat information you already gave; build on it. Treat short follow-ups ("price?", "ar reels?", "আর ডেলিভারি?") as being about the current topic.
- Always end with ONE natural next question that moves them forward (what they sell, their budget, how many products, when they need it) — only for things you still don't know. Don't ask for what they already told you.
- Warm, human tone like a helpful sales consultant; no bullet-point dumps, no copying CONTEXT wording stiffly.
- Never state any number, price, timeline or inclusion that is not in the CONTEXT. If the CONTEXT doesn't have it, say the team will confirm it after reviewing their requirements.

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
// against English chunks. Short follow-ups ("Bdt price") also lose their topic without
// the conversation. So rewrite the latest message into a standalone English search
// query using the recent turns — for retrieval only; the reply is unaffected.
async function toRetrievalQuery(message: string, history: ChatTurn[]): Promise<string> {
    const recent = history.slice(-4);
    if (!recent.length && !/[\u0980-\u09FF]/.test(message)) return message;
    try {
        const convo = recent.map((t) => `${t.role === 'user' ? 'Customer' : 'Agent'}: ${t.content}`).join('\n');
        const data = await openaiFetch('chat/completions', {
            model: envConfig.openai_chat_model,
            temperature: 0,
            messages: [
                {
                    role: 'system',
                    content:
                        'Rewrite the customer\'s latest message as one standalone English search query for a business knowledge base. ' +
                        'Use the earlier conversation to resolve what a short or vague message refers to (e.g. "price?" after talking about photography). ' +
                        'If the latest message starts a new topic, ignore the earlier conversation. Output only the query.',
                },
                { role: 'user', content: `${convo ? `Earlier conversation:\n${convo}\n\n` : ''}Latest customer message: ${message}` },
            ],
        });
        return data.choices[0].message.content.trim() || message;
    } catch (err: any) {
        logger.error(`Retrieval query rewrite failed, using original: ${err.message}`);
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
        const queryEmbedding = await embed(await toRetrievalQuery(message, history));
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
