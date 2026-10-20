// Mirrors server/src/constants/knowledge-base.ts — keep in step.
export const KB_MAX_CHARS = 1000;
export const KB_MAX_CATEGORY_CHARS = 60;
export const KB_INSTRUCTIONS_CATEGORY = 'AI Instructions';
export const KB_MAX_INSTRUCTIONS = 8;
export const KB_RETRIEVE_K = 6;

// Starting categories offered in the form; staff can still type their own.
export const KB_SUGGESTED_CATEGORIES = [
    KB_INSTRUCTIONS_CATEGORY,
    'Services',
    'Pricing',
    'Policies',
    'Business Hours',
    'Contact',
    'Company',
    'Support',
    'Getting Started',
];

export const isInstructions = (category?: string | null) =>
    category?.trim().toLowerCase() === KB_INSTRUCTIONS_CATEGORY.toLowerCase();

export function ago(iso: string): string {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    if (min < 1440) return `${Math.floor(min / 60)}h ago`;
    return `${Math.floor(min / 1440)}d ago`;
}

// Mirrors EXAMPLE_MAX_CHARS on the server.
export const EXAMPLE_MAX_CHARS = 1500;
