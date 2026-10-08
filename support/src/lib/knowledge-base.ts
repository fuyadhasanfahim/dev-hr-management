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
