// The WhatsApp AI sells in a fixed order, and the server — not just the prompt — enforces the one rule that
// matters most: no price before the customer has seen the platform options, the features and the extras.
//
//   discover → platform → features → extras → recap → price → next_step      (+ 'other' for anything off-flow)
export const SALES_STAGES = ['discover', 'platform', 'features', 'extras', 'recap', 'price', 'next_step', 'other'] as const;
export type SalesStage = (typeof SALES_STAGES)[number];

export const STAGE_LABEL: Record<SalesStage, string> = {
    discover: 'Understanding the need',
    platform: 'Choosing a platform',
    features: 'Showing features',
    extras: 'Asking for extra features',
    recap: 'Recap & package match',
    price: 'Price shared',
    next_step: 'Next step (call / quotation)',
    other: 'General / support',
};

export const isSalesStage = (v: unknown): v is SalesStage => (SALES_STAGES as readonly string[]).includes(v as string);

// Stages after which the customer has heard the recommended platform and its packages, so a price may be given when they ask.
const PRICE_READY: SalesStage[] = ['platform', 'features', 'extras', 'recap', 'price', 'next_step'];

// "price", "koto taka", "দাম কত", "khoroch"… Deliberately broad: a false positive only lifts the gate for one message.
const ASKS_PRICE =
    /\b(price|prices|pricing|cost|costs|rate|rates|charge|charges|fee|fees|quote|quotation|how much|budget)\b|\bdam\b|\bdar\b|দাম|মূল্য|খরচ|টাকা|কত\s*(পড|লাগ|হবে)|koto\s*(taka|dam|poro|pore|lagbe|hobe|khoroch)|khoroch|khorc|takar/i;

export const asksPrice = (text: string) => ASKS_PRICE.test(text);

export interface PriceGate {
    allowed: boolean;
    why: string;
}

/**
 * May this reply contain a price?
 *  - yes once the previous reply was at platform/features/extras/recap/price/next_step (the recommendation and packages are already on the table);
 *  - yes if the customer has now asked for the price twice (an earlier ask went unanswered with a price) — never stonewall;
 *  - otherwise no: the reply must move the flow forward (platform → features → extras) instead.
 */
export function priceGate(prevStage: SalesStage | undefined, message: string, history: { role: string; content: string; human?: boolean }[]): PriceGate {
    if (prevStage && PRICE_READY.includes(prevStage)) return { allowed: true, why: `previous stage was "${prevStage}"` };
    // A human teammate already took this customer through platform/package; the stage (set only by AI replies) is stale.
    if (asksPrice(message) && history.some((t) => t.human)) return { allowed: true, why: 'a human teammate already discussed the package with this customer' };
    const askedBefore = history.some((t) => t.role === 'user' && asksPrice(t.content));
    if (asksPrice(message) && askedBefore) return { allowed: true, why: 'customer asked for the price again' };
    return { allowed: false, why: 'features and extras not covered yet' };
}

// An amount of money: a currency marker next to digits (Latin or Bengali), e.g. "BDT 25,000", "৳৩০০০", "25000 টাকা", "$500".
const MONEY =
    /(?:\bBDT|\bUSD|\bTk\.?|৳|\$|টাকা)\s*[\d০-৯][\d০-৯,.]*|[\d০-৯][\d০-৯,.]*\s*(?:\bBDT\b|\bUSD\b|\bTk\b|\btaka\b|৳|\$|টাকা)/i;

export const leaksPrice = (reply: string) => MONEY.test(reply);

/** One-line instruction describing where the chat is, injected into the prompt every turn. */
export function stageBrief(prev: SalesStage | undefined, gate: PriceGate): string {
    return (
        `SALES STATE — previous reply stage: ${prev ?? 'none (new chat)'}. ` +
        `PRICE ALLOWED: ${gate.allowed ? 'yes' : 'NO'} (${gate.why}). ` +
        (gate.allowed
            ? 'You may state the matched package price now (only from the CATALOG), then move to the next step.'
            : 'Do NOT state, hint at or compare any price, package price or "starting from" amount in this reply — not even if asked. ' +
              'If they asked, say in one friendly line that the price depends on the platform and features they pick, and continue the flow with the next question.')
    );
}

// "thanks", "welcome", "joined", a lone thumbs-up: nothing to answer, and a bot reply only adds noise.
// Deliberately NOT "ok"/"yes" — those often answer the AI's last question.
const ACK_ONLY = /^(?:thanks?(?: you)?(?: so much)?|thx|welcome|joined(?: the (?:google )?meet)?|dhonnobad|ধন্যবাদ|(?:[\p{Extended_Pictographic}\s\u200d\ufe0f])+)[\s.!]*$/iu;

export const isAckOnly = (text: string) => text.trim().length <= 40 && ACK_ONLY.test(text.trim());
