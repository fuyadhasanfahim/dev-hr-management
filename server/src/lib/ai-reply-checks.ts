// What a good WhatsApp / website AI reply looks like, as checks that can run on any reply: in the regression tests,
// and in scripts/ai-regression.ts against the live model. Each violation is a short code.
import { leaksPrice } from './sales-flow.js';

export type Violation = 'empty' | 'wrong_script' | 'price_too_early' | 'greets_again' | 'repeats_last_reply' | 'filler_ending' | 'markdown' | 'too_long' | 'reveals_instructions';

export interface ReplyCheckInput {
    customerText: string;
    reply: string;
    priceAllowed: boolean;
    previousAssistant?: string; // the AI's last message in this chat, if any
    firstReply?: boolean;
}

const BENGALI = /[ঀ-৿]/;
const bengaliShare = (text: string) => {
    const letters = text.match(/\p{L}/gu)?.length ?? 0;
    return letters ? (text.match(/[ঀ-৿]/g)?.length ?? 0) / letters : 1;
};
const GREETING = /^\s*(?:আসসালামু\s*আলাইকুম|আসসালামু|assalamu|hello|hi\b|hey\b|নমস্কার)/i;
const INTRO = /(?:i['’]?m mira|আমি\s*mira|virtual assistant|ভার্চুয়াল অ্যাসিস্ট্যান্ট)/i;
const FILLER = /(?:feel free to (?:contact|reach)|let us know if you need anything|a team member can help you|যেকোনো প্রয়োজনে (?:আমাদের )?(?:জানাবেন|যোগাযোগ)|আর কিছু জানতে চাইলে জানাবেন)/i;
const MARKDOWN = /(?:^\s*(?:[-*•]|\d+\.)\s+\S)|\*\*|^#{1,6}\s/m;
const REVEAL = /(?:system prompt|my instructions|আমার ইনস্ট্রাকশন|SALES FLOW|STAFF RULES|CONTEXT:)/i;

const words = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean));
function similarity(a: string, b: string) {
    const x = words(a);
    const y = words(b);
    if (!x.size || !y.size) return 0;
    let both = 0;
    for (const w of x) if (y.has(w)) both++;
    return both / (x.size + y.size - both);
}

export function checkReply(input: ReplyCheckInput): Violation[] {
    const { customerText, reply, priceAllowed, previousAssistant, firstReply } = input;
    const out: Violation[] = [];
    if (!reply.trim()) return ['empty'];
    // A customer writing Bengali script must get Bengali script back (brand words in English are fine).
    if (BENGALI.test(customerText) && bengaliShare(reply) < 0.3) out.push('wrong_script');
    if (!priceAllowed && leaksPrice(reply)) out.push('price_too_early');
    if (!firstReply && (GREETING.test(reply) || INTRO.test(reply))) out.push('greets_again');
    if (previousAssistant && similarity(reply, previousAssistant) >= 0.85) out.push('repeats_last_reply');
    if (FILLER.test(reply.trim().slice(-140))) out.push('filler_ending'); // only the ending counts
    if (MARKDOWN.test(reply)) out.push('markdown');
    if ((reply.match(/[.!?।]+(?:\s|$)/g)?.length ?? 0) > 7 || reply.length > 900) out.push('too_long');
    if (REVEAL.test(reply)) out.push('reveals_instructions');
    return out;
}
