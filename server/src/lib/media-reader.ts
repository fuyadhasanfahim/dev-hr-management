import envConfig from '../config/env.config.js';
import { logger } from './logger.js';
import { openaiFetch, openaiTranscribe } from './openai-chat.js';
import { WhatsAppMessageType } from '../models/whatsapp-message.model.js';

// Beyond this the file is left for a human (also keeps the request body well under OpenAI's limits).
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_CHARS = 1500;

const IMAGE_PROMPT =
    'A customer of a web/digital agency sent this image in a WhatsApp sales chat. In at most 80 words say what it shows and copy any visible text exactly ' +
    '(it may be a website screenshot, a logo, a design reference, a product photo or a payment slip). Facts only.';
const PDF_PROMPT =
    'A customer of a web/digital agency sent this document (often an RFP, brief or requirements list). Summarise in at most 180 words: what they want built, ' +
    'features/pages/integrations, budget, timeline/deadline, existing site or references, and anything they ask us to do. Facts only; say "not stated" for missing items.';

/**
 * What the AI can learn from a media message: a transcript for voice notes, a description for photos, a summary
 * for PDFs. Returns '' for anything it can't read (video, other file types, oversized files) or when reading fails.
 */
export async function readMedia(type: WhatsAppMessageType, file: Buffer, mimeType: string, filename = 'file'): Promise<string> {
    if (!file.length || file.length > MAX_BYTES) return '';
    try {
        if (type === WhatsAppMessageType.AUDIO) return clip(await openaiTranscribe(file, mimeType.split(';')[0]!, voiceFilename(mimeType)));
        const b64 = file.toString('base64');
        let part: unknown;
        if (type === WhatsAppMessageType.IMAGE) part = { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } };
        else if (type === WhatsAppMessageType.DOCUMENT && mimeType.startsWith('application/pdf')) part = { type: 'file', file: { filename, file_data: `data:application/pdf;base64,${b64}` } };
        else return '';
        const data = await openaiFetch('chat/completions', {
            model: envConfig.openai_chat_model,
            messages: [{ role: 'user', content: [{ type: 'text', text: type === WhatsAppMessageType.IMAGE ? IMAGE_PROMPT : PDF_PROMPT }, part] }],
        });
        return clip(data.choices[0].message.content ?? '');
    } catch (err: any) {
        logger.error(`Could not read ${type} message: ${err.message}`);
        return '';
    }
}

const clip = (s: string) => s.trim().slice(0, MAX_CHARS);

// OpenAI picks the decoder from the extension; WhatsApp voice notes are ogg/opus.
function voiceFilename(mime: string) {
    const ext = /ogg|opus/.test(mime) ? 'ogg' : /mpeg|mp3/.test(mime) ? 'mp3' : /mp4|m4a|aac/.test(mime) ? 'm4a' : /wav/.test(mime) ? 'wav' : /webm/.test(mime) ? 'webm' : 'ogg';
    return `voice.${ext}`;
}
