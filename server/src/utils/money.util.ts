// One way to write money everywhere (PDFs, emails, receipts): the ISO code, never a symbol —
// "USD 1,200.00", "EUR 950.00", "GBP 80.00", "BDT 1,00,000.00".

/** ISO 4217 code from a stored currency: a code, or a legacy symbol ("$", "৳", "Tk"). Unknown/empty → BDT. */
export function normalizeCurrencyCode(currency: unknown): string {
    const raw = String(currency ?? '').trim();
    const key = raw.toLowerCase();
    if (!key) return 'BDT';
    if (key === '$' || key === 'usd') return 'USD';
    if (key === '€') return 'EUR';
    if (key === '£') return 'GBP';
    if (key === '৳' || key === 'tk' || key === 'bdt' || key === 'tk.') return 'BDT';
    return /^[a-z]{3}$/.test(key) ? key.toUpperCase() : raw.toUpperCase();
}

/**
 * "CODE amount". BDT keeps Indian digit grouping (1,00,000.00), every other currency uses 1,000,000.00.
 * `decimals`: a number to force that many fraction digits, or 'auto' for none on whole amounts (2 otherwise).
 */
export function formatMoneyCode(amount: number | null | undefined, currency: unknown, decimals: number | 'auto' = 2): string {
    const n = Number(amount || 0);
    const code = normalizeCurrencyCode(currency);
    const digits = decimals === 'auto' ? (n % 1 !== 0 ? 2 : 0) : decimals;
    const text = n.toLocaleString(code === 'BDT' ? 'en-IN' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return `${code} ${text}`;
}
