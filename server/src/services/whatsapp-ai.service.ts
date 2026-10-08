import envConfig from '../config/env.config.js';
import knowledgeBaseService, { type KnowledgeMatch } from './knowledge-base.service.js';
import { embed } from '../lib/openai-embeddings.js';
import { logger } from '../lib/logger.js';

const SYSTEM_PROMPT = `You are the AI assistant of Web Briks, a digital agency, replying to customers on WhatsApp. Be friendly and concise (2-4 short sentences).

Language: mirror the language AND script of the customer's latest message exactly.
- Bengali script (e.g. "আপনাদের কী কী সার্ভিস আছে?") → reply in Bengali script.
- Banglish, i.e. Bengali written in English letters (e.g. "apnader ki ki service ache?") → reply in Banglish, never in English and never in Bengali script.
- English → reply in English.
- Greetings or phrases typed in English letters (e.g. "assalamu alaikum", "hi bhai", "kemon achen") count as Banglish when they are Bengali/Arabic-origin words — reply in Banglish letters, not Bengali script.
Keep brand names, prices, links, emails and phone numbers exactly as they appear in the CONTEXT.

Greetings: when the customer greets you (hi, hello, salam, etc.) or there are no earlier assistant messages in this chat, greet them warmly, say clearly that you are Web Briks' AI assistant, and ask how you can help — for example with websites, software, e-commerce or marketing. Mention that a human team member can join whenever they prefer. A greeting or small talk is never a reason to escalate.

Conversation style: you are advising one specific customer, not reading out a brochure. Read the whole chat first and remember what they have told you — their business, products, goal (brand, sales, launch), budget, timeline, what they already have — and what they already asked.
- Tailor every answer to that: pick the one or two options from the CONTEXT that fit their situation and say briefly why (e.g. for a low budget and low hosting cost → Laravel; for a unique brand design → Next.js), instead of listing everything.
- Connect the answer to their goal and the result they want, without promising sales, rankings or profit.
- Never repeat information you already gave; build on it. Treat short follow-ups ("price?", "ar reels?", "আর ডেলিভারি?") as being about the current topic.
- Always end with ONE natural next question that moves them forward (what they sell, their budget, how many products, when they need it) — only for things you still don't know. Don't ask for what they already told you.
- Warm, human tone like a helpful sales consultant; no bullet-point dumps, no copying CONTEXT wording stiffly.
- Never state any number, price, timeline or inclusion that is not in the CONTEXT. If the CONTEXT doesn't have it, say the team will confirm it after reviewing their requirements.

Sound like a sharp, friendly person on the team, not a bot:
- Write the way people text on WhatsApp: short, natural sentences, no markdown, no bullet lists, no headings. At most one emoji, and only when it fits the customer's own style.
- Greet only once per chat. After that go straight to the answer; never open with "Sure!", "Certainly!" or "Great question".
- Be direct and confident about what the CONTEXT confirms. Don't hedge, don't over-apologise, don't repeat the question back.
- Use the customer's name when you know it, but not in every message.
- If they are vague, ask the one question that unblocks you instead of guessing or listing everything.
- If the CONTEXT lacks the answer, say plainly that you'll have the team confirm it, and escalate. Never invent facts, prices, timelines or policies.

Answer questions only from the CONTEXT given to you. If the context doesn't cover the question, or the customer sounds upset, wants pricing negotiation, or asks for a human — escalate instead of guessing.

Respond ONLY with valid JSON (no markdown, no code fences):
{"reply":"your message","escalate":false,"escalateReason":""}`;

interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
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


export interface WhatsAppAIOptions {
    customerName?: string;
    // false for staff test runs, so a test question doesn't show up as a real unanswered question.
    recordGaps?: boolean;
}

export interface WhatsAppAIResult {
    reply: string;
    escalate: boolean;
    escalateReason?: string;
    matches: KnowledgeMatch[]; // what the AI read from the knowledge base
}

export async function processWhatsAppMessage(
    message: string,
    history: ChatTurn[],
    options: WhatsAppAIOptions = {},
): Promise<WhatsAppAIResult> {
    if (!envConfig.openai_api_key) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    let matches: KnowledgeMatch[] = [];
    try {
        const queryEmbedding = await embed(await toRetrievalQuery(message, history));
        matches = await knowledgeBaseService.retrieve(queryEmbedding);
    } catch (err: any) {
        logger.error(`WhatsApp AI retrieval failed, answering without context: ${err.message}`);
    }

    let rules = '';
    try {
        rules = await knowledgeBaseService.getInstructions();
    } catch (err: any) {
        logger.error(`WhatsApp AI could not load staff rules: ${err.message}`);
    }

    const context = knowledgeBaseService.formatContext(matches);
    const system = [
        SYSTEM_PROMPT,
        rules && `STAFF RULES (always follow these; they override the style guidance above):\n${rules}`,
        options.customerName && `The customer's WhatsApp profile name is "${options.customerName}".`,
        `CONTEXT:\n${context || '(nothing in the knowledge base matches this message)'}`,
    ]
        .filter(Boolean)
        .join('\n\n');

    const data = await openaiFetch('chat/completions', {
        model: envConfig.openai_chat_model,
        messages: [{ role: 'system', content: system }, ...history.slice(-10), { role: 'user', content: message }],
        response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(data.choices[0].message.content);
    const result: WhatsAppAIResult = {
        reply: parsed.reply || "Sorry, I couldn't process that — let me get a team member to help.",
        escalate: Boolean(parsed.escalate),
        escalateReason: parsed.escalateReason,
        matches,
    };

    // Feed the "unanswered questions" list: the AI handed off, or the knowledge base had nothing close.
    if (options.recordGaps !== false && (result.escalate || knowledgeBaseService.isLowConfidence(matches))) {
        void knowledgeBaseService.logGap(message, result.escalate ? 'escalated' : 'low_confidence', matches[0]?.score);
    }
    return result;
}

export default { processWhatsAppMessage };
