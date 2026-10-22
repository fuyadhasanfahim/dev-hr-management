import { normalizeCurrency } from "@/lib/currency";

// Money is written with the ISO code, never a symbol.
export const currencySymbol = (c?: string) => normalizeCurrency(c);

export const fmtMoney = (n: number, c?: string) => `${normalizeCurrency(c)} ${Math.round(n || 0).toLocaleString("en-US")}`;

export const fmtDate = (v?: string) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};
