/**
 * WebBriks brand constants shared across PDFs, emails, and the payment
 * confirmation page — single source of truth so a logo/URL change doesn't
 * need updating in three places.
 */

export const COMPANY_LOGO_URL =
    'https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png';

export const COMPANY_SOCIAL_LINKS = {
    facebook: 'https://facebook.com/webbriks',
    linkedin: 'https://linkedin.com/company/webbriks',
    instagram: 'https://www.instagram.com/webbriks/',
} as const;
