import { createHmac, timingSafeEqual } from 'node:crypto';

// Meta signs every webhook POST: `X-Hub-Signature-256: sha256=<hmac of the raw
// body keyed with the app secret>`. Anything else did not come from Meta.
export function isValidMetaSignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
    if (!appSecret || !header?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest();
    const given = Buffer.from(header.slice(7), 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
}
