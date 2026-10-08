// Knowledge-base limits and retrieval tuning, shared by the API and the WhatsApp AI.
// The support UI mirrors KB_MAX_CHARS / KB_RETRIEVE_K (support/src/lib/knowledge-base.ts).

// One entry = one embedding. Short, single-topic entries match a customer's
// question far better than long ones, so the cap is hard: split long answers.
// (Every existing entry was already <= 975 chars.)
export const KB_MAX_CHARS = 1000;
export const KB_MAX_CATEGORY_CHARS = 60;

// Entries in this category are never retrieved: they are staff rules (tone,
// do/don't, escalation triggers) that the AI always follows.
export const KB_INSTRUCTIONS_CATEGORY = 'AI Instructions';
export const KB_MAX_INSTRUCTIONS = 8;

// How many best-matching entries the AI reads per message, and the similarity
// (cosine, 0-1) bands. ponytail: thresholds are uncalibrated starting points —
// tune them from the scores the "Test the AI" tab shows.
export const KB_RETRIEVE_K = 6;
export const KB_MIN_SCORE = 0.2; // below this an entry is noise and is dropped
export const KB_LOW_CONFIDENCE = 0.35; // best match below this = the KB probably can't answer it
