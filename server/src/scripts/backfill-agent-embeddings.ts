// One-off: embeds human-reply examples captured before they were embedded on capture, so the AI can learn their tone.
// Run on the server:  npx tsx src/scripts/backfill-agent-embeddings.ts
import { prisma } from '../lib/prisma.js';
import { embed } from '../lib/openai-embeddings.js';

const rows = await prisma.$queryRaw<{ id: string; question: string }[]>`SELECT id, question FROM ai_examples WHERE kind = 'agent' AND embedding IS NULL`;
console.log(`${rows.length} human replies to embed`);
for (const r of rows) {
    const v = `[${(await embed(r.question)).join(',')}]`;
    await prisma.$executeRawUnsafe(`UPDATE ai_examples SET embedding = $2::vector WHERE id = $1`, r.id, v);
}
console.log('done');
await prisma.$disconnect();
process.exit(0);
