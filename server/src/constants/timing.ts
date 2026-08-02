/**
 * Named time windows/tolerances extracted from quotation.service.ts and
 * order.service.ts (E6-F2-T2), replacing bare numeric literals at their
 * call sites.
 */

/** How long a client-facing quotation secure link/token stays valid. */
export const TOKEN_EXPIRY_DAYS = 30;

/**
 * Duplicate-submission idempotency window: a quotation with an identical
 * creation fingerprint created within this window is treated as a repeat
 * request, not a new quotation.
 */
export const DUPLICATE_QUOTATION_WINDOW_MS = 5 * 60 * 1000;

/** How long an unlocked order asset's access token stays valid after delivery payment. */
export const ASSET_ACCESS_WINDOW_DAYS = 7;
