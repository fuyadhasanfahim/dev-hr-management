// Currencies a quotation / client can be billed in. The server accepts any ISO-4217 code and
// charges Stripe / PayPal in it (BDT is converted to USD at the gateway only), so this list is
// purely what the UI offers and how it is written.
export const BILLING_CURRENCIES = [
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
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

/** "৳", "$", "€"… — falls back to the code itself for currencies we don't list. */
export function currencySymbol(raw?: string | null): string {
  const code = normalizeCurrency(raw);
  return BILLING_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}
