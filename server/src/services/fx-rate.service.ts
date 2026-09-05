import { logger } from '../lib/logger.js';
import { AppError } from '../utils/AppError.js';

/**
 * Live USD/BDT exchange rate — needed because neither Stripe nor PayPal
 * accepts BDT as a charge currency, but most of our invoices are billed in
 * BDT. We convert BDT -> USD only for the gateway charge; the invoice, the
 * payment page, and the Receipt ledger all stay in BDT throughout (see
 * payment.service.ts's resolveGatewayCharge/convertGatewayAmountToNative).
 *
 * There is no free official (central bank) JSON API for this, so we use
 * ExchangeRate-API's open, keyless endpoint — a neutral third party
 * aggregating central bank/market rates, updated once daily. This is the
 * same category of source most payment integrations in this situation use.
 */

const RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — the upstream API itself only updates once/day.

let cached: { rate: number; fetchedAt: number } | null = null;

async function fetchLiveUsdToBdtRate(): Promise<number> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
        const res = await fetch(RATE_URL, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`FX rate API returned ${res.status}`);
        const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
        const rate = data?.rates?.BDT;
        if (data?.result !== 'success' || !rate || rate <= 0) {
            throw new Error('FX rate API response missing a usable BDT rate');
        }
        return rate;
    } finally {
        clearTimeout(timer);
    }
}

/** 1 USD = N BDT, per the live rate (cached up to CACHE_TTL_MS; falls back to a stale cached value if the live fetch fails, since a several-hour-old rate is far safer than blocking payments entirely). */
export async function getUsdToBdtRate(): Promise<number> {
    const now = Date.now();
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.rate;
    }

    try {
        const rate = await fetchLiveUsdToBdtRate();
        cached = { rate, fetchedAt: now };
        return rate;
    } catch (err) {
        logger.error({ err }, 'fx_rate.fetch_failed');
        if (cached) {
            logger.warn({ staleForMs: now - cached.fetchedAt }, 'fx_rate.using_stale_cache');
            return cached.rate;
        }
        throw new AppError(
            'Currency conversion is temporarily unavailable. Please try again shortly.',
            503,
        );
    }
}
