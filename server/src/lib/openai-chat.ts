import envConfig from '../config/env.config.js';

export async function openaiFetch(path: string, body: unknown) {
    const res = await fetch(`https://api.openai.com/v1/${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${envConfig.openai_api_key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data: any = await res.json();
    if (!res.ok) {
        throw new Error(`OpenAI ${path} failed: ${res.status} ${JSON.stringify(data)}`);
    }
    return data;
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
