import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Rate limiters for abuse-prone PUBLIC endpoints (guest OTP → SMTP/email spam,
 * AI chat → Gemini cost). Authenticated staff/agent routes are NOT limited here.
 *
 * Store: default in-memory — fine for a single instance. For a multi-instance
 * deployment, swap in a shared store (e.g. `rate-limit-redis`) backed by the same
 * Redis already used by `redis-queue.service`, so counters are shared across nodes.
 */

// 429 responder: always JSON, never an HTML error page.
function jsonHandler(message: string) {
    return (_req: Request, res: Response): void => {
        res.status(429).json({ success: false, message });
    };
}

/**
 * Guest OTP — each call sends a real email. Keyed by IP **and** email so a single
 * address can't be spammed even from rotating IPs (`ipKeyGenerator` normalizes
 * IPv6). Falls back to IP-only when no email is present on the request body.
 */
export const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
        const ip = ipKeyGenerator(req.ip ?? '');
        const email = String(req.body?.email ?? '').toLowerCase().trim();
        return email ? `${ip}:${email}` : ip;
    },
    handler: jsonHandler(
        'Too many OTP requests. Please wait a few minutes and try again.',
    ),
});

/**
 * AI chat — each call costs a Gemini request. Per-IP throttle.
 */
export const aiChatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler(
        "You're sending messages too quickly. Please slow down.",
    ),
});

/**
 * Looser catch-all for the remaining public support endpoints
 * (guest verify, create-session, AI info).
 */
export const generalPublicLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler(
        'Too many requests. Please slow down and try again shortly.',
    ),
});

export default {
    otpLimiter,
    aiChatLimiter,
    generalPublicLimiter,
};
