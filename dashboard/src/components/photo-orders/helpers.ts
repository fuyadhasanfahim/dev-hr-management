import { normalizeCurrency } from "@/lib/currency";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Amount with up to two decimals (per-image prices are often fractional). */
export const money = (n: number, currency = "USD") => {
    const v = Number.isFinite(n) ? n : 0;
    const code = normalizeCurrency(currency);
    return `${code} ${v.toLocaleString("en-US", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
};
