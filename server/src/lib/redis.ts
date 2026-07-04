import { Redis } from 'ioredis';
import envConfig from '../config/env.config.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis(envConfig.redis_url, {
            maxRetriesPerRequest: null,
            retryStrategy(times) {
                const delay = Math.min(times * 200, 3000);
                return delay;
            },
        });

        redisClient.on('connect', () => {
            logger.info('[Redis] Connected successfully');
        });

        redisClient.on('error', (err) => {
            const msg = err.message || (err as any).code || String(err);
            logger.error(`[Redis] Error: ${msg}`);
        });
    }

    return redisClient;
}

export default getRedisClient;
