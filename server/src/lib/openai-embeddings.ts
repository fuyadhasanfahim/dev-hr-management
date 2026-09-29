import envConfig from '../config/env.config.js';

export async function embed(text: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${envConfig.openai_api_key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: envConfig.openai_embedding_model, input: text }),
    });
    const data: any = await res.json();
    if (!res.ok) {
        throw new Error(`OpenAI embeddings failed: ${res.status} ${JSON.stringify(data)}`);
    }
    return data.data[0].embedding;
}
