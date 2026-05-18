import { Redis } from 'ioredis';
import envConfig from '../config/env.config.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis(envConfig.redis_url, {
            maxRetriesPerRequest: null,
        });

        redisClient.on('connect', () => {
            logger.info('[Redis] Connected successfully');
        });

        redisClient.on('error', (err) => {
            logger.error(`[Redis] Error: ${err.message}`);
        });
    }

    return redisClient;
}

export default getRedisClient;
