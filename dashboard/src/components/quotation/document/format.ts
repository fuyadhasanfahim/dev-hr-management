const SYMBOLS: Record<string, string> = { BDT: "৳", USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$" };

export const currencySymbol = (c?: string) => SYMBOLS[(c ?? "").toUpperCase()] ?? (c || "");

export const fmtMoney = (n: number, c?: string) => `${currencySymbol(c)} ${Math.round(n || 0).toLocaleString("en-US")}`.trim();

export const fmtDate = (v?: string) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};
