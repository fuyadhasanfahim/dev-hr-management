import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Static knowledge instead of vector-search RAG: Groq has no embeddings endpoint,
// and this content is small enough to just paste into the prompt directly.
// Regenerate this file (scrape webbriks.com) whenever services/pricing change.
const BUSINESS_KNOWLEDGE = readFileSync(
    path.join(__dirname, '../data/business-knowledge.md'),
    'utf-8',
);

const HOLDING_MESSAGE =
    "Thanks for reaching out! Please stay connected — one of our team members will contact you shortly.";

const SYSTEM_PROMPT = `You are the WhatsApp support assistant for Webbriks, a digital agency. Be friendly, concise (2-3 sentences max).
Answer using ONLY the business knowledge below — if it doesn't contain the answer, do not guess.

${BUSINESS_KNOWLEDGE}

Respond ONLY with valid JSON (no markdown, no code fences):
{"reply":"your message","escalate":false,"escalateReason":""}

Set "escalate" to true when:
- The knowledge above doesn't contain enough information to answer confidently
- The customer explicitly asks for a human / says the bot isn't helping
- The message is a complaint, billing/payment issue, or anything sensitive

When escalate is true, set "reply" to exactly: "${HOLDING_MESSAGE}"`;

interface WhatsAppAIResponse {
    reply: string;
    escalate: boolean;
    escalateReason?: string;
}

let groq: Groq | null = null;

function getGroq(): Groq {
    if (!groq) {
        if (!envConfig.groq_api_key) {
            throw new Error('GROQ_API_KEY environment variable is not set');
        }
        groq = new Groq({ apiKey: envConfig.groq_api_key });
    }
    return groq;
}

export async function processWhatsAppMessage(
    userMessage: string,
    history: { role: 'user' | 'assistant'; content: string }[],
): Promise<WhatsAppAIResponse> {
    const client = getGroq();

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-10),
        { role: 'user', content: userMessage },
    ];

    const completion = await client.chat.completions.create({
        model: envConfig.groq_model,
        messages,
        temperature: 0.4,
        max_tokens: 400,
    });

    const responseText = (completion.choices[0]?.message?.content ?? '').trim();

    try {
        const cleaned = responseText.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned) as WhatsAppAIResponse;
        if (!parsed.reply) throw new Error('Invalid AI response structure');
        return { reply: parsed.reply, escalate: Boolean(parsed.escalate), escalateReason: parsed.escalateReason };
    } catch {
        // Model didn't return clean JSON — fail safe by escalating rather than
        // sending an unvalidated raw reply to a customer.
        logger.warn(`WhatsApp AI returned non-JSON response, escalating: ${responseText.slice(0, 200)}`);
        return {
            reply: HOLDING_MESSAGE,
            escalate: true,
            escalateReason: 'AI response could not be parsed',
        };
    }
}

export default { processWhatsAppMessage };
