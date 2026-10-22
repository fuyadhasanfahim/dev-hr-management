// Currencies a quotation / client can be billed in. The server accepts any ISO-4217 code and
// charges Stripe / PayPal in it (BDT is converted to USD at the gateway only), so this list is
// purely what the UI offers.
export const BILLING_CURRENCIES = [
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
] as const;

/** ISO code from a stored value: an ISO code, a legacy symbol ("$", "৳", "Tk") or a label like "Euro (EUR)". Unknown → BDT. */
export function normalizeCurrency(raw?: string | null): string {
  const v = (raw ?? "").trim();
  if (!v) return "BDT";
  const key = v.toLowerCase();
  if (key === "$") return "USD";
  if (key === "৳" || key === "tk" || key === "tk.") return "BDT";
  const inBrackets = /\(([A-Za-z]{3})\)/.exec(v)?.[1];
  const code = (inBrackets ?? (/^[A-Za-z]{3}$/.test(v) ? v : "")).toUpperCase();
  return code || "BDT";
}

/** How money is written everywhere in the app: the ISO code, never a symbol — "USD 1,200", "EUR 950", "BDT 15,000". */
export const currencyCode = normalizeCurrency;

/** Money text with the code in front. BDT groups digits the Indian way (1,00,000), others the usual way. */
export function formatMoneyCode(amount: number | null | undefined, currency?: string | null, decimals = 0): string {
  const code = normalizeCurrency(currency);
  const text = Number(amount || 0).toLocaleString(code === "BDT" ? "en-IN" : "en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${code} ${text}`;
}
