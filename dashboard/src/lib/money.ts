// Currency formatting shared by UI and PDF. Money is always written with the ISO code, never a symbol:
// "USD 1,200.00", "EUR 950.00", "GBP 80.00", "BDT 1,00,000.00" (BDT keeps Indian digit grouping).
import { normalizeCurrency } from "@/lib/currency";

export function isBDT(currency?: string | null): boolean {
  if (!currency) return false;
  return normalizeCurrency(currency) === "BDT";
}

export function formatMoney(
  amount: number | null | undefined,
  currency?: string | null,
  opts?: { withDecimals?: boolean; compact?: boolean },
): string {
  const digits = (opts?.withDecimals ?? true) ? 2 : 0;
  const code = normalizeCurrency(currency);
  const text = Number(amount || 0).toLocaleString(code === "BDT" ? "en-IN" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${code} ${text}`;
}

/** The currency's ISO code, for labels like "Amount (EUR)". */
export function currencyLabel(currency?: string | null): string {
  return normalizeCurrency(currency);
}
