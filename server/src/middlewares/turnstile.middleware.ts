import type { NextFunction, Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';

// Cloudflare Turnstile check for the public website-chat endpoints that send email or create records
// (guest code request, ticket from the AI widget). The widget sends `turnstileToken` in the body.
//
// TURNSTILE_MODE: off = skip; soft = verify a token when one is sent but let requests without one through
// (older widgets that don't know Turnstile yet); enforce = a token is required.
// The widget sends "unavailable" when Cloudflare's script cannot run (blocked, offline). Those requests are
// accepted, but through a much tighter per-IP limit, so skipping the check is no free pass for bots.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const UNAVAILABLE = 'unavailable';

const unavailableLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 4,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    handler: (_req, res) => {
        res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    },
});

// Hostnames our own sites run on: Turnstile reports where the widget was solved.
function allowedHostnames(): Set<string> {
    const hosts = new Set<string>(['localhost']);
    for (const origin of `${envConfig.trusted_origins},${envConfig.client_url}`.split(',')) {
        try {
            hosts.add(new URL(origin.trim()).hostname);
        } catch {
            // ignore malformed entries
        }
    }
    return hosts;
}

async function verifyToken(token: string, ip: string | undefined): Promise<{ ok: boolean; reason?: string }> {
    try {
        const res = await fetch(VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ secret: envConfig.turnstile_secret_key, response: token, ...(ip ? { remoteip: ip } : {}) }),
            signal: AbortSignal.timeout(5000),
        });
        const data: any = await res.json();
        if (!data.success) return { ok: false, reason: (data['error-codes'] ?? []).join(',') || 'rejected' };
        if (data.hostname && !allowedHostnames().has(data.hostname)) return { ok: false, reason: `hostname ${data.hostname}` };
        return { ok: true };
    } catch (err: any) {
        // Cloudflare unreachable: do not lock real visitors out.
        logger.error(`[turnstile] siteverify failed, letting the request through: ${err.message}`);
        return { ok: true };
    }
}

const REJECT = { success: false, message: 'Security check failed. Please refresh the page and try again.' };

export async function verifyTurnstile(req: Request, res: Response, next: NextFunction) {
    const { turnstile_mode: mode, turnstile_secret_key: secret } = envConfig;
    if (mode === 'off' || !secret) return next();

    const token = typeof req.body?.turnstileToken === 'string' ? req.body.turnstileToken : '';
    if (!token) {
        if (mode === 'enforce') return res.status(400).json(REJECT);
        return next();
    }
    if (token === UNAVAILABLE) return unavailableLimiter(req, res, next);

    const result = await verifyToken(token, req.ip);
    if (!result.ok) {
        logger.warn(`[turnstile] rejected (${result.reason}) from ${req.ip}`);
        return res.status(400).json(REJECT);
    }
    return next();
}
