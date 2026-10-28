import envConfig from '../config/env.config.js';

const RETRY_DELAYS_MS = [800, 2500];
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The model's JSON reply as an object. A null/refused/garbled message becomes {} so callers treat it like an empty reply and retry, instead of crashing on `null.reply`. */
export function parseJsonReply(data: any): Record<string, any> {
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) return {};
    try {
        const parsed = JSON.parse(content);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export async function openaiFetch(path: string, body: any) {
    // Reasoning models think before answering; a WhatsApp reply should not wait on a long think. Only they accept this field.
    if (envConfig.openai_reasoning_effort && !/^gpt-4/.test(body?.model ?? '') && path === 'chat/completions' && !body.reasoning_effort) {
        body = { ...body, reasoning_effort: envConfig.openai_reasoning_effort };
    }
    // A busy API (429/5xx) or a dropped connection is retried a couple of times before the caller ever sees it.
    for (let attempt = 0; ; attempt++) {
        let res: Response;
        try {
            res = await fetch(`https://api.openai.com/v1/${path}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${envConfig.openai_api_key}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
        } catch (err) {
            if (attempt < RETRY_DELAYS_MS.length) {
                await sleep(RETRY_DELAYS_MS[attempt]!);
                continue;
            }
            throw err;
        }
        const data: any = await res.json().catch(() => ({}));
        if (res.ok) return data;
        // An exhausted quota will not fix itself in a second; everything else transient is worth another try.
        const outOfQuota = data?.error?.code === 'insufficient_quota';
        if (RETRYABLE_STATUS.includes(res.status) && !outOfQuota && attempt < RETRY_DELAYS_MS.length) {
            await sleep(RETRY_DELAYS_MS[attempt]!);
            continue;
        }
        // `status` lets callers tell a busy/rate-limited API (retryable) from a real failure.
        throw Object.assign(new Error(`OpenAI ${path} failed: ${res.status} ${JSON.stringify(data)}`), { status: res.status });
    }
}

/** Voice message -> text (Bengali stays in Bengali script). */
export async function openaiTranscribe(audio: Buffer, mimeType: string, filename: string): Promise<string> {
    const form = new FormData();
    form.append('model', envConfig.openai_transcribe_model);
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${envConfig.openai_api_key}` },
        body: form,
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(`OpenAI transcription failed: ${res.status} ${JSON.stringify(data)}`);
    return String(data.text ?? '').trim();
}
