/** Bangladeshi numbers (01XXXXXXXXX) → 8801XXXXXXXXX; anything else is passed through as digits. */
export function toWhatsAppNumber(raw?: string | null): string | null {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length < 8) return null;
    if (digits.startsWith('880')) return digits;
    if (digits.startsWith('0') && digits.length === 11) return `88${digits}`;
    return digits;
}

/** True for a Bangladeshi mobile in 8801XXXXXXXXX form — the only numbers the SMS gateway can reach. */
export const isBdMobile = (normalized: string | null): normalized is string => !!normalized && /^8801\d{9}$/.test(normalized);
