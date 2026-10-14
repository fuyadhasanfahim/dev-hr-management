/** Brand assets and the authorising signature — the same values the previous quotation PDF used. */
export const LOGO_SRC = "/assets/brand/logo.png";
export const MARK_SRC = "/assets/brand/wb-mark.png";

export const SIGNATURE_SRC =
    process.env.NEXT_PUBLIC_COMPANY_SIGNATURE_URL ||
    "https://res.cloudinary.com/dny7zfbg9/image/upload/v1776961131/ouvycul8e7xskhrioca4.png";
export const SIGNATORY_NAME = process.env.NEXT_PUBLIC_COMPANY_SIGNATORY_NAME || "Md. Ashaduzzaman";
export const SIGNATORY_ROLE = process.env.NEXT_PUBLIC_COMPANY_SIGNATORY_ROLE || "Founder & CEO";

/** Legal lines shown in the closing block when a quotation does not carry its own. */
export const DEFAULT_LEGAL = {
    country: "United States",
    ein: "Federal Tax ID (EIN): 30-1421814",
    vat: "VAT ID: Not Applicable — U.S. Entity",
};
