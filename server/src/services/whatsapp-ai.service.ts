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
- If the CONTEXT lacks the answer, say plainly that you'll have the team confirm it, and keep the conversation going (offer the closest matching service and ask one question) — this alone is NOT a reason to escalate. Never invent facts, prices, timelines or policies.

Understanding Banglish: customers often type Bengali in English letters with loose spelling. Common words: koto = how much, lagbe = need/want, nai = don't have, ache = have/there is, korte chai = want to do, somporke/somporkey = about, janan/janona = tell me, dam/cost/rate = price, ekta/akta = a/one, amar = my, apnara = you (the agency). Work out the meaning from the whole chat. "Ecommerce website somporke janona?" is a request for information about the e-commerce website service; "Kono budget nai" means "I have no fixed budget".

The CONTEXT is the only source of truth. If an earlier assistant message in this chat contradicts the CONTEXT (different price, service or policy), the CONTEXT wins: use the CONTEXT and don't repeat the earlier claim. Never say Web Briks "does not provide" a service unless the CONTEXT says so explicitly; if the CONTEXT doesn't mention it, say the team will confirm.

Be polite and respectful at all times (use the respectful "apni" form of address, thank the customer, never sound dismissive or robotic). Politeness never changes the script: Banglish stays in English letters, Bengali script stays in Bengali script.

When the customer has no budget or no clear idea: don't escalate. Briefly present the entry-level option from the CONTEXT with its price, say it can be tailored, and ask one question about their business.
When the customer asks about a service in general ("e-commerce website somporke janan", "marketing cost koto?"): give the packages and prices from the CONTEXT, tailored to what you know, and ask one question.

Escalate ONLY when the customer explicitly asks for a human or manager, is upset or complaining, or wants a price negotiation/discount. Escalating closes the chat to the bot, so never escalate just because the CONTEXT lacks an answer, the service is unlisted (e.g. WordPress, mobile apps), or the message is vague, short, mistyped or Banglish — answer from the CONTEXT, say the team will confirm the rest, and ask one clarifying question. When you do escalate, the "reply" must still be a warm, specific message (e.g. thank them, say a team member will follow up shortly and what it will be about); never leave it empty.

Respond ONLY with valid JSON (no markdown, no code fences):
{"reply":"your message","escalate":false,"escalateReason":""}`;

// Only used if the model returns an empty reply: still polite, and neutral about script.
const FALLBACK_REPLY =
    'আপনার মেসেজের জন্য ধন্যবাদ 🙏 আমাদের একজন টিম মেম্বার খুব শীঘ্রই আপনার সাথে যোগাযোগ করবেন। / Thank you for your message — a team member will get back to you shortly.';

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

    // The model occasionally returns an empty "reply"; one retry nearly always fixes it.
    let parsed: any = {};
    for (let attempt = 0; attempt < 2 && !parsed.reply?.trim(); attempt++) {
        const data = await openaiFetch('chat/completions', {
            model: envConfig.openai_chat_model,
            // Our own fallback notices carry no information and can derail the model, so keep them out of its view.
            messages: [{ role: 'system', content: system }, ...history.filter((t) => t.content !== FALLBACK_REPLY).slice(-10), { role: 'user', content: message }],
            // Strict schema: the model can no longer return {} without a reply.
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'whatsapp_reply',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: { reply: { type: 'string' }, escalate: { type: 'boolean' }, escalateReason: { type: 'string' } },
                        required: ['reply', 'escalate', 'escalateReason'],
                        additionalProperties: false,
                    },
                },
            },
        });
        parsed = JSON.parse(data.choices[0].message.content);
        if (!parsed.reply?.trim()) logger.warn(`WhatsApp AI returned an empty reply (attempt ${attempt + 1}): ${JSON.stringify(parsed)}`);
    }
    const result: WhatsAppAIResult = {
        reply: parsed.reply?.trim() || FALLBACK_REPLY,
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
