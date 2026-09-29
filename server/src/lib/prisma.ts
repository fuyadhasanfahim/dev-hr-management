import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import envConfig from '../config/env.config.js';

// Knowledge-base store (pgvector) for the WhatsApp AI's RAG retrieval.
// Kept separate from Mongo/Mongoose — every other model stays there.
export const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: envConfig.database_url }),
});

export default prisma;
