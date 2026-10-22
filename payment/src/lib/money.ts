/**
 * Money is always written with the ISO code, never a symbol ("USD 1,200.00", "EUR 950.00").
 * Mirrors formatMoneyCode in server/src/utils/money.util.ts, so the payment page reads the same amounts
 * the invoice PDF does. `currency` on an invoice may still be an old display symbol ('$', '৳', 'Tk').
 */
function normalize(currency?: string | null): string {
    const raw = (currency ?? "").trim();
    const key = raw.toLowerCase();
    if (!key) return "BDT";
    if (key === "$" || key === "usd") return "USD";
    if (key === "€") return "EUR";
    if (key === "£") return "GBP";
    if (key === "৳" || key === "tk" || key === "bdt" || key === "tk.") return "BDT";
    return raw.toUpperCase();
}

export function formatMoney(amount: number, currency?: string | null): string {
    const code = normalize(currency);
    const text = Number(amount || 0).toLocaleString(code === "BDT" ? "en-IN" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `${code} ${text}`;
}

/** The currency the PayPal JS SDK is booted with: the invoice's own currency (BDT invoices are never payable online). */
export function resolveDisplayGatewayCurrency(nativeCurrency?: string | null): string {
    return normalize(nativeCurrency);
}
