import { KB_LOW_CONFIDENCE, KB_MAX_CATEGORY_CHARS, KB_MAX_CHARS } from '../constants/knowledge-base.js';

// Pure helpers for the knowledge base (no DB), so they can be unit-tested.

export interface ScoredEntry {
    text: string;
    source: string | null;
    score: number;
}

/** Message for the form when an entry breaks a limit, or null when it's fine. */
export function entryProblem(text: string, source?: string): string | null {
    if (text.length > KB_MAX_CHARS) {
        return `This entry is ${text.length} characters; the limit is ${KB_MAX_CHARS}. Shorten it or split it into separate entries.`;
    }
    if (source && source.length > KB_MAX_CATEGORY_CHARS) return `Category is limited to ${KB_MAX_CATEGORY_CHARS} characters.`;
    return null;
}

/** Prompt context: each entry tagged with its category, entries separated by a rule. */
export const formatContext = (matches: Pick<ScoredEntry, 'text' | 'source'>[]) =>
    matches.map((m) => (m.source ? `[${m.source}] ${m.text}` : m.text)).join('\n---\n');

/** True when the knowledge base probably can't answer: no match, or only weak ones. */
export const isLowConfidence = (matches: Pick<ScoredEntry, 'score'>[]) => (matches[0]?.score ?? 0) < KB_LOW_CONFIDENCE;
