// Currency formatting helpers shared by UI and PDF.
// For Bangladeshi Taka we use the "Tk" prefix (font-safe, prints reliably) and
// en-IN grouping (e.g. 1,00,000.00) which is the standard for BDT amounts.

const BDT_TOKENS = new Set(["BDT", "BDT.", "৳", "Tk", "TK", "tk"]);

export function isBDT(currency?: string | null): boolean {
  if (!currency) return false;
  return BDT_TOKENS.has(String(currency).trim());
}

export function formatMoney(
  amount: number | null | undefined,
  currency?: string | null,
  opts?: { withDecimals?: boolean; compact?: boolean },
): string {
  const n = Number(amount || 0);
  const withDecimals = opts?.withDecimals ?? true;
  const fractionDigits = withDecimals ? 2 : 0;

  if (isBDT(currency)) {
    const formatted = n.toLocaleString("en-IN", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    return `Tk ${formatted}`;
  }

  const fallbackSymbol = (currency || "$").trim();

  // Try locale-aware international currency formatting if a 3-letter ISO code
  if (/^[A-Za-z]{3}$/.test(fallbackSymbol)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: fallbackSymbol.toUpperCase(),
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(n);
    } catch {
      // fall through
    }
  }

  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${fallbackSymbol}${formatted}`;
}

export function currencyLabel(currency?: string | null): string {
  return isBDT(currency) ? "Tk" : (currency || "$").trim();
}
