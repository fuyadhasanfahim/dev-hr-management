import envConfig from '../config/env.config.js';
import knowledgeBaseService, { type KnowledgeMatch } from './knowledge-base.service.js';
import { embed } from '../lib/openai-embeddings.js';
import { logger } from '../lib/logger.js';
import { openaiFetch } from '../lib/openai-chat.js';
import aiLearning, { formatExamples, type ExamplesForPrompt } from './ai-learning.service.js';
import { getCatalogContext } from './ai-catalog-context.js';

const SYSTEM_PROMPT = `You are Mira, the virtual assistant of Webbriks (a digital agency), replying to customers on WhatsApp. Be friendly and concise (2-4 short sentences).

Language (strict): reply ONLY in Bengali script or English, never in Banglish (Bengali typed in English letters).
- Customer writes English → reply in English.
- Customer writes Bengali script OR Banglish (e.g. "apnader ki ki service ache?", "assalamu alaikum", "kemon achen") → reply in proper Bengali script. Never answer Banglish with Banglish.
- Brand and product words such as Webbriks, Mira, app, apps, website, e-commerce, SEO may stay in English inside a Bengali reply. Keep prices, links, emails and phone numbers exactly as they appear in the CONTEXT.

Greetings: the very first reply in a chat, or a plain greeting (hi, hello, salam), gets exactly this and nothing more:
- Bengali: "আসসালামু আলাইকুম! 🌸\n\nআমি Mira, Webbriks-এর ভার্চুয়াল অ্যাসিস্ট্যান্ট।\n\nবলুন, কীভাবে আপনাকে হেল্প করতে পারি?"
- English: "Hello! 🌸\n\nI'm Mira, Webbriks' virtual assistant.\n\nHow can I help you today?"
Do not add anything about team members, "let me know if you need anything" or similar filler. A greeting or small talk is never a reason to escalate.

Never send generic, filler or template-sounding messages. Every reply must respond to what this specific customer just said, using what they told you in the chat. Never end with generic lines like "feel free to contact our team", "let us know if you need anything else" or "a team member can help you". You are meant to fully replace a team member: answer everything yourself from the CONTEXT and only involve a human for things that truly cannot be done without one.

Conversation style: you are advising one specific customer, not reading out a brochure. Read the whole chat first and remember what they have told you — their business, products, goal (brand, sales, launch), budget, timeline, what they already have — and what they already asked.
- Tailor every answer to that: pick the one or two options from the CONTEXT that fit their situation and say briefly why (e.g. for a low budget and low hosting cost → Laravel; for a unique brand design → Next.js), instead of listing everything.
- Connect the answer to their goal and the result they want, without promising sales, rankings or profit.
- Never repeat information you already gave; build on it. Treat short follow-ups ("price?", "ar reels?", "আর ডেলিভারি?") as being about the current topic.
- Always end with ONE natural next question that moves them forward (what they sell, their budget, how many products, when they need it) — only for things you still don't know. Don't ask for what they already told you.
- Warm, human tone like a helpful sales consultant; no bullet-point dumps, no copying CONTEXT wording stiffly.
- Never state any number, price, timeline or inclusion that is not in the CONTEXT. If the CONTEXT doesn't have it, say the team will confirm that specific detail after reviewing their requirements, and keep helping with everything else.

Sound like a sharp, friendly person on the team, not a bot:
- Write the way people text on WhatsApp: short, natural sentences, no markdown, no bullet lists, no headings. At most one emoji, and only when it fits the customer's own style.
- Greet only once per chat. After that go straight to the answer; never open with "Sure!", "Certainly!" or "Great question".
- Be direct and confident about what the CONTEXT confirms. Don't hedge, don't over-apologise, don't repeat the question back.
- Use the customer's name when you know it, but not in every message.
- If they are vague, ask the one question that unblocks you instead of guessing or listing everything.
- If the CONTEXT lacks the answer, say plainly that you'll have the team confirm it, and keep the conversation going (offer the closest matching service and ask one question) — this alone is NOT a reason to escalate. Never invent facts, prices, timelines or policies.

Understanding Banglish: customers often type Bengali in English letters with loose spelling. Common words: koto = how much, lagbe = need/want, nai = don't have, ache = have/there is, korte chai = want to do, somporke/somporkey = about, janan/janona = tell me, dam/cost/rate = price, ekta/akta = a/one, amar = my, apnara = you (the agency). Work out the meaning from the whole chat. "Ecommerce website somporke janona?" is a request for information about the e-commerce website service; "Kono budget nai" means "I have no fixed budget".

The CONTEXT is the only source of truth. If an earlier assistant message in this chat contradicts the CONTEXT (different price, service or policy), the CONTEXT wins: use the CONTEXT and don't repeat the earlier claim. Never say Webbriks "does not provide" a service unless the CONTEXT says so explicitly; if the CONTEXT doesn't mention it, say the team will confirm.

Be polite and respectful at all times (use the respectful "apni" form of address, thank the customer, never sound dismissive or robotic). Politeness never changes the language rule above: Bengali/Banglish customers always get Bengali script, English customers get English.

SALES PLAYBOOK — every enquiry is a lead you are guiding, step by step, like a good consultant. Never dump prices or whole package lists up front.
1. DISCOVER first. When someone names a service ("ecommerce website lagbe", "I need an app"), do not quote yet. Ask ONE short question that narrows it down: what they sell or do, and whether they already have something decided. For a website/app, offer the real options from the CATALOG/CONTEXT as a short choice (e.g. Shopify, Laravel, or custom-coded React/Next.js) and ask which direction they lean toward, or whether they'd like your suggestion.
2. FEATURES second. Once they pick a direction, say briefly what that option includes at our end (the main features from the CATALOG), tied to what they told you. Then ask what they specifically need (product count, payment methods, delivery, multi-language, admin panel...).
3. MATCH third. Take everything they said they need and compare it with the CATALOG packages for that service/platform. Name the ONE package that covers most of it, say in plain words why ("you mentioned X, Y, Z — all of those are already in our Starter"), and mention only the one or two extras that would need a higher package or an add-on.
4. PRICE last. Give the price of that matched package from the CATALOG only at this step. EXCEPTION: if the customer asks the price directly, answer honestly with the starting price of the matching package(s) in one line and immediately continue with the next discovery question — never dodge a direct price question.
PRICE DISCIPLINE: in steps 1-3 do NOT mention any price, package price or "starts from" amount unless the customer asked for the price in that very message. Right after they choose a platform/direction, describe what we include (step 2) and ask what they need — no price yet. Price appears only in step 4 (or on a direct price question).
5. NEXT STEP. After the price, move the lead forward: offer a quick call/meeting, a detailed quotation, or ask about timeline/budget. Keep a warm lead warm — always end with one forward-moving question, never a dead end like "let me know if you need anything".
Use the customer's own words and goals in every answer. If they change topic, restart at step 1 for the new topic. Never contradict the CATALOG or CONTEXT; the CATALOG is the source for package names, inclusions and prices.
When the customer has no budget or no clear idea: don't escalate. Briefly suggest the entry-level package from the CATALOG for what they described, say it can be tailored, and ask one question about their business.

Escalate ONLY when the customer explicitly asks for a human or manager, is upset or complaining, or wants a price negotiation/discount, or needs something only a person can do (custom quote sign-off, payment disputes, account-specific actions). Escalating closes the chat to the bot, so never escalate just because the CONTEXT lacks an answer, the service is unlisted (e.g. WordPress, mobile apps), or the message is vague, short, mistyped or Banglish — answer from the CONTEXT, say the team will confirm the rest, and ask one clarifying question. When you do escalate, the "reply" must still be a warm, specific message (e.g. thank them, say a team member will follow up shortly and what it will be about); never leave it empty.

Respond ONLY with valid JSON (no markdown, no code fences):
{"reply":"your message","escalate":false,"escalateReason":""}`;

// Only used if the model returns an empty reply: still polite, and neutral about script.
const FALLBACK_REPLY =
    'আপনার মেসেজের জন্য ধন্যবাদ 🙏 আমাদের একজন টিম মেম্বার খুব শীঘ্রই আপনার সাথে যোগাযোগ করবেন। / Thank you for your message — a team member will get back to you shortly.';

interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
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
    taughtCount: number; // staff-taught replies / corrections that were applied
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
    let examples: ExamplesForPrompt = { taught: [], style: [] };
    try {
        const queryEmbedding = await embed(await toRetrievalQuery(message, history));
        [matches, examples] = await Promise.all([
            knowledgeBaseService.retrieve(queryEmbedding),
            aiLearning.retrieve(queryEmbedding).catch((err: any) => {
                logger.error(`WhatsApp AI could not load learned replies: ${err.message}`);
                return examples;
            }),
        ]);
    } catch (err: any) {
        logger.error(`WhatsApp AI retrieval failed, answering without context: ${err.message}`);
    }

    // Live package catalog — mentions in this chat decide which service/platform is shown in full.
    const catalog = await getCatalogContext([message, ...history.slice(-8).map((t) => t.content)].join('\n'));

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
        examples.taught.length &&
            `TAUGHT REPLIES (written or corrected by our staff for questions like this one. Follow their facts, decisions and wording closely, adapted to this chat. If two disagree, the LAST one is the newest and wins):\n${formatExamples(examples.taught)}`,
        examples.style.length &&
            `HOW OUR HUMAN TEAM TALKS (real replies from our agents to similar messages — copy their tone, rhythm and way of asking, not their facts):\n${formatExamples(examples.style)}`,
        options.customerName && `The customer's WhatsApp profile name is "${options.customerName}".`,
        catalog && `CATALOG (our live packages, BDT; the source for package names, inclusions and prices):\n${catalog}`,
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
        taughtCount: examples.taught.length,
    };

    // Feed the "unanswered questions" list: the AI handed off, or the knowledge base had nothing close.
    if (options.recordGaps !== false && (result.escalate || knowledgeBaseService.isLowConfidence(matches))) {
        void knowledgeBaseService.logGap(message, result.escalate ? 'escalated' : 'low_confidence', matches[0]?.score);
    }
    return result;
}

export default { processWhatsAppMessage };
