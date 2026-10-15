export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SYMBOLS: Record<string, string> = { USD: "$", BDT: "৳", EUR: "€", GBP: "£" };

/** Amount with up to two decimals (per-image prices are often fractional). */
export const money = (n: number, currency = "USD") => {
    const v = Number.isFinite(n) ? n : 0;
    const sym = SYMBOLS[currency.toUpperCase()] ?? currency;
    return `${sym}${v.toLocaleString("en-US", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
};
