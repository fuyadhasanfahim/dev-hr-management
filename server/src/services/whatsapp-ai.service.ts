import envConfig from '../config/env.config.js';
import knowledgeBaseService, { type KnowledgeMatch } from './knowledge-base.service.js';
import { embed } from '../lib/openai-embeddings.js';
import { logger } from '../lib/logger.js';
import { openaiFetch } from '../lib/openai-chat.js';
import aiLearning, { formatExamples, type ExamplesForPrompt } from './ai-learning.service.js';
import { getCatalogContext } from './ai-catalog-context.js';
import { leaksPrice, priceGate, stageBrief, isSalesStage, SALES_STAGES, type SalesStage } from '../lib/sales-flow.js';

const SYSTEM_PROMPT = `You are Mira, the virtual assistant of Webbriks (a digital agency), replying to customers on WhatsApp. Be friendly and concise (2-4 short sentences).

Language (strict): reply ONLY in Bengali script or English, never in Banglish (Bengali typed in English letters).
- Customer writes English → reply in English.
- Customer writes Bengali script OR Banglish (e.g. "apnader ki ki service ache?", "assalamu alaikum", "kemon achen") → reply in proper Bengali script. Never answer Banglish with Banglish.
- Brand and product words such as Webbriks, Mira, app, apps, website, e-commerce, SEO may stay in English inside a Bengali reply. Keep prices, links, emails and phone numbers exactly as they appear in the CONTEXT.

__GREETING__

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

SALES FLOW — every enquiry is a lead you guide step by step, like a good consultant. The customer must ALWAYS see the options, the features and the extras BEFORE any price. Work out which step the chat is at from the whole conversation and the SALES STATE line below, do that step's job, and report it in "stage".
1. discover — They name something ("website lagbe", "ecommerce chai"). Ask ONE short question to understand the need: what kind of website, what they sell or do, anything already decided. No platform list yet, no price.
2. platform — Offer the real options from the CATALOG as a short choice. For a website that is Laravel, Shopify or custom-coded (Next.js / React), using only what the CATALOG lists for that service. Give each a one-line "best for" and ask which they lean toward, or offer to suggest one based on what they told you. No price.
3. features — They picked a platform (or accepted your suggestion). Say what that platform's package includes at our end: 4-8 highlights from the CATALOG "includes", tied to their business, in flowing sentences (no bullet dump). If there are several packages, name them and say what each adds. Then ask what they specifically need. No price.
4. extras — Ask whether they want anything beyond what is included. Mention the CATALOG "optional extras" that fit them (names only, no prices) and ask which they'd like, plus whether they need anything custom. Note their list. If they need nothing extra, move on.
5. recap — Sum up in 2-3 sentences: the platform, the one package that covers most of their needs, and the extras they chose (and anything that needs a higher package or custom work). Then offer the price ("Shall I share the price for this?" / "এই প্যাকেজের দাম জানাবো?") unless they already asked for it.
6. price — ONLY when PRICE ALLOWED is yes, and they asked for the price or agreed after the recap: give the matched package price from the CATALOG, the price of each chosen paid extra, and the total in one line. If a chosen extra has no price in the CATALOG, say the team will confirm that part. Never invent, round or discount.
7. next_step — After the price, move the lead forward: offer a quick call/meeting or a detailed quotation and ask about timeline or when they want to start.
other — greetings, thanks, support, off-topic.
A customer who jumps ahead ("Shopify, 50 products, payment gateway, price?") has given you several steps at once: confirm what they said in one line, cover the missing steps in the same reply (platform/features/extras), and still do not state a price until PRICE ALLOWED is yes. If they ask the price too early, say in ONE friendly line that the price depends on the platform and features they choose, then carry on with the flow — never dodge silently, never quote. If they change topic or service, restart at step 1.
Always end with ONE forward-moving question, never a dead end like "let me know if you need anything". Use the customer's own words and goals. Never contradict the CATALOG or CONTEXT; the CATALOG is the source for package names, inclusions, extras and prices.
When the customer has no budget or no clear idea: don't escalate. Suggest the entry-level package from the CATALOG for what they described, say it can be tailored, and ask one question about their business — still following the steps above.
In "stage" put the step THIS reply performs (discover, platform, features, extras, recap, price, next_step or other). In "stageReason" put ONE short English sentence saying why, naming what the customer said that led you there (for example: "Customer chose Shopify, so listing Shopify features before asking about extras").

Escalate ONLY when the customer explicitly asks for a human or manager, is upset or complaining, or wants a price negotiation/discount, or needs something only a person can do (custom quote sign-off, payment disputes, account-specific actions). Escalating closes the chat to the bot, so never escalate just because the CONTEXT lacks an answer, the service is unlisted (e.g. WordPress, mobile apps), or the message is vague, short, mistyped or Banglish — answer from the CONTEXT, say the team will confirm the rest, and ask one clarifying question. When you do escalate, the "reply" must still be a warm, specific message (e.g. thank them, say a team member will follow up shortly and what it will be about); never leave it empty.

Respond ONLY with valid JSON (no markdown, no code fences):
{"reply":"your message","escalate":false,"escalateReason":"","stage":"discover","stageReason":"why this stage"}`;

const GREETING_FIRST = `Greetings: this is the very first reply in this chat, so a plain greeting (hi, hello, salam) gets exactly this and nothing more:
- Bengali: "আসসালামু আলাইকুম! 🌸\n\nআমি Mira, Webbriks-এর ভার্চুয়াল অ্যাসিস্ট্যান্ট।\n\nবলুন, কীভাবে আপনাকে হেল্প করতে পারি?"
- English: "Hello! 🌸\n\nI'm Mira, Webbriks' virtual assistant.\n\nHow can I help you today?"
Do not add anything about team members, "let me know if you need anything" or similar filler. A greeting or small talk is never a reason to escalate.`;
const GREETING_LATER = `Greetings: you have ALREADY talked to this customer in this chat (see the chat history), so NEVER greet or introduce yourself again, not even if they say hi/hello/"?"/"hlw". If they only ping or greet, answer in one short line that picks up the last open topic or question (e.g. "জি, বলুন — আমরা Shopify প্যাকেজটা নিয়ে কথা বলছিলাম, কোনটা নিয়ে জানতে চান?"). Do not add anything about team members or filler. A greeting or small talk is never a reason to escalate.`;

// Only used if the model returns an empty reply: still polite, and neutral about script.
const FALLBACK_REPLY =
    'আপনার মেসেজের জন্য ধন্যবাদ 🙏 আমাদের একজন টিম মেম্বার খুব শীঘ্রই আপনার সাথে যোগাযোগ করবেন। / Thank you for your message — a team member will get back to you shortly.';

interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
    human?: boolean; // assistant turn written by a human teammate, not by the AI
}

const HUMAN_TAG = '[Human team member] ';
const HISTORY_TURNS = 24;

// The knowledge base is English, and embeddings match Bengali-script queries poorly
// against English chunks. Short follow-ups ("Bdt price") also lose their topic without
// the conversation. So rewrite the latest message into a standalone English search
// query using the recent turns — for retrieval only; the reply is unaffected.
async function toRetrievalQuery(message: string, history: ChatTurn[]): Promise<string> {
    const recent = history.slice(-6);
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
    // Where the previous AI reply in this chat left the sales flow (kept on the conversation).
    salesStage?: SalesStage;
    // Running profile of this customer (business, platform, budget...) kept across the whole chat.
    memory?: string;
}

export interface WhatsAppAIResult {
    reply: string;
    escalate: boolean;
    escalateReason?: string;
    matches: KnowledgeMatch[]; // what the AI read from the knowledge base
    taughtCount: number; // staff-taught replies / corrections that were applied
    stage: SalesStage; // which step of the sales flow this reply performed
    stageReason: string; // why, in one sentence — shown to staff
    priceAllowed: boolean; // whether the price gate was open for this reply
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

    // The price gate: until platform, features and extras have been covered, the model is not even shown a price.
    const gate = priceGate(options.salesStage, message, history);
    if (!gate.allowed) matches = matches.filter((m) => !leaksPrice(m.text));

    // Live package catalog — mentions in this chat decide which service/platform is shown in full.
    const catalog = await getCatalogContext([message, ...history.slice(-8).map((t) => t.content)].join('\n'), { showPrices: gate.allowed });

    let rules = '';
    try {
        rules = await knowledgeBaseService.getInstructions();
    } catch (err: any) {
        logger.error(`WhatsApp AI could not load staff rules: ${err.message}`);
    }

    const context = knowledgeBaseService.formatContext(matches);
    const firstReply = !history.some((t) => t.role === 'assistant');
    const system = [
        SYSTEM_PROMPT.replace('__GREETING__', firstReply ? GREETING_FIRST : GREETING_LATER),
        `Turns marked "${HUMAN_TAG.trim()}" in the chat were written by a human colleague, not by you. Treat what they said and promised as part of the conversation: never repeat their questions, never contradict them, and continue from where they left off.`,
        options.memory && `WHAT WE ALREADY KNOW ABOUT THIS CUSTOMER (from the whole chat so far; trust it, never ask for these again):\n${options.memory}`,
        rules && `STAFF RULES (always follow these; they override the style guidance above):\n${rules}`,
        examples.taught.length &&
            `TAUGHT REPLIES (written or corrected by our staff for questions like this one. Follow their facts, decisions and wording closely, adapted to this chat. If two disagree, the LAST one is the newest and wins):\n${formatExamples(examples.taught)}`,
        examples.style.length &&
            `HOW OUR HUMAN TEAM TALKS (real replies from our agents to similar messages — copy their tone, rhythm and way of asking, not their facts):\n${formatExamples(examples.style)}`,
        stageBrief(options.salesStage, gate),
        options.customerName && `The customer's WhatsApp profile name is "${options.customerName}".`,
        catalog && `CATALOG (our live packages${gate.allowed ? ', BDT' : '; prices are hidden until the sales flow reaches the price step'}; the source for package names, inclusions${gate.allowed ? ', extras and prices' : ' and extras'}):\n${catalog}`,
        `CONTEXT:\n${context || '(nothing in the knowledge base matches this message)'}`,
    ]
        .filter(Boolean)
        .join('\n\n');

    // The model occasionally returns an empty "reply"; one retry nearly always fixes it. While the price gate is
    // closed a reply that still states an amount is rejected and regenerated (the prompt asks, this enforces).
    const base = [{ role: 'system', content: system }, ...history.filter((t) => t.content !== FALLBACK_REPLY).slice(-HISTORY_TURNS).map((t) => ({ role: t.role, content: t.human ? HUMAN_TAG + t.content : t.content })), { role: 'user', content: message }];
    const ask = async (extra: { role: string; content: string }[] = []) => {
        const data = await openaiFetch('chat/completions', {
            model: envConfig.openai_chat_model,
            // Our own fallback notices carry no information and can derail the model, so keep them out of its view.
            messages: [...base, ...extra],
            // Strict schema: the model can no longer return {} without a reply.
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'whatsapp_reply',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            reply: { type: 'string' },
                            escalate: { type: 'boolean' },
                            escalateReason: { type: 'string' },
                            stage: { type: 'string', enum: [...SALES_STAGES] },
                            stageReason: { type: 'string' },
                        },
                        required: ['reply', 'escalate', 'escalateReason', 'stage', 'stageReason'],
                        additionalProperties: false,
                    },
                },
            },
        });
        return JSON.parse(data.choices[0].message.content);
    };

    let parsed: any = {};
    let priceLeaked = false;
    for (let attempt = 0; attempt < 3; attempt++) {
        const retryNote =
            priceLeaked &&
            [{ role: 'system', content: 'Your previous draft stated a price or amount, which is not allowed yet. Rewrite the reply with NO price, amount, currency figure or "starting from" — follow the SALES STATE line and continue the sales flow with the next question.' }];
        parsed = await ask(retryNote || []);
        if (!parsed.reply?.trim()) {
            logger.warn(`WhatsApp AI returned an empty reply (attempt ${attempt + 1}): ${JSON.stringify(parsed)}`);
            continue;
        }
        priceLeaked = !gate.allowed && leaksPrice(parsed.reply);
        if (!priceLeaked) break;
        logger.warn(`WhatsApp AI stated a price while the gate was closed (attempt ${attempt + 1}); regenerating`);
    }
    // Still leaking after retries: never send the price. A short neutral line that keeps the flow going.
    if (priceLeaked) {
        parsed = {
            ...parsed,
            reply: /[\u0980-\u09FF]/.test(message)
                ? 'আপনার প্রয়োজন অনুযায়ী সঠিক প্যাকেজ ঠিক করতে আগে একটু জেনে নিই — আপনি কী ধরনের ওয়েবসাইট চান, আর কী বিক্রি করবেন?'
                : "To suggest the right package I first need a little more detail — what kind of website do you need, and what will you sell?",
            stage: 'discover',
            stageReason: 'Draft stated a price before features and extras were covered, so it was replaced with a discovery question.',
        };
    }
    const result: WhatsAppAIResult = {
        reply: parsed.reply?.trim() || FALLBACK_REPLY,
        escalate: Boolean(parsed.escalate),
        escalateReason: parsed.escalateReason,
        matches,
        taughtCount: examples.taught.length,
        // A price/next-step label can't be true while the gate was closed (the reply was already checked for amounts).
        stage: !isSalesStage(parsed.stage) ? 'other' : !gate.allowed && (parsed.stage === 'price' || parsed.stage === 'next_step') ? 'recap' : parsed.stage,
        stageReason: String(parsed.stageReason ?? '').slice(0, 300),
        priceAllowed: gate.allowed,
    };

    // Feed the "unanswered questions" list: the AI handed off, or the knowledge base had nothing close.
    if (options.recordGaps !== false && (result.escalate || knowledgeBaseService.isLowConfidence(matches))) {
        void knowledgeBaseService.logGap(message, result.escalate ? 'escalated' : 'low_confidence', matches[0]?.score);
    }
    return result;
}

// Folds the newest turns into the customer's running profile. Short on purpose: it is read on every reply.
export async function updateMemory(previous: string, turns: ChatTurn[]): Promise<string> {
    const convo = turns.map((t) => `${t.role === 'user' ? 'Customer' : t.human ? 'Human colleague' : 'AI'}: ${t.content.replace(/\s+/g, ' ').slice(0, 500)}`).join('\n');
    const data = await openaiFetch('chat/completions', {
        model: envConfig.openai_chat_model,
        temperature: 0,
        messages: [
            {
                role: 'system',
                content:
                    'You maintain a short English profile of one sales-chat customer for a digital agency. Given the current profile and the newest chat turns, output the UPDATED profile: ' +
                    'max 8 short lines "key: value" covering only facts the customer or a colleague actually stated — business/what they sell, service wanted, platform chosen, package discussed, product count, budget, timeline, ' +
                    'existing site/reference links, decisions or promises made (e.g. call arranged, proposal pending), questions already answered, language. Keep old facts unless contradicted. Never invent. Output only the profile, under 700 characters.',
            },
            { role: 'user', content: `Current profile:\n${previous || '(empty)'}\n\nNewest turns:\n${convo}` },
        ],
    });
    return String(data.choices[0].message.content ?? '').trim().slice(0, 900) || previous;
}

export default { processWhatsAppMessage, updateMemory };
