/**
 * Mirrors formatMoneyPdf in server/src/services/invoice-puppeteer-pdf.service.ts
 * so the payment page reads the same amounts the same way the invoice PDF
 * does. Needed because `currency` on an invoice is free-form display text
 * ('৳', 'Tk', 'BDT', 'USD', ...) rather than a strict ISO-4217 code —
 * Intl.NumberFormat throws a RangeError on anything else.
 */

const BDT_TOKENS = new Set(["BDT", "BDT.", "৳", "Tk", "TK", "tk"]);

export function formatMoney(amount: number, currency?: string | null): string {
    const cur = (currency ?? "").trim();

    if (cur && BDT_TOKENS.has(cur)) {
        return `Tk ${amount.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }

    const symbol = cur || "USD";
    if (/^[A-Za-z]{3}$/.test(symbol)) {
        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: symbol.toUpperCase(),
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(amount);
        } catch {
            // Not a currency code Intl recognizes — fall through to the plain prefix below.
        }
    }

    return `${symbol}${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * Mirrors the gateway-unsupported-currency decision in
 * server/src/services/payment.service.ts's resolveGatewayCharge — used only
 * to pick which currency to boot the PayPal JS SDK with (it needs this
 * upfront, before we can call the server to get the authoritative charge
 * amount/currency). The actual amount charged always comes from the server.
 */
export function resolveDisplayGatewayCurrency(nativeCurrency?: string | null): string {
    const key = (nativeCurrency ?? "").trim().toLowerCase();
    const isBdt = key === "৳" || key === "tk" || key === "bdt";
    if (isBdt) return "USD";
    return /^[a-z]{3}$/.test(key) ? key.toUpperCase() : "USD";
}
