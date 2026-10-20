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
