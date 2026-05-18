import { getRedisClient } from '../lib/redis.js';

const redis = getRedisClient();
const CHAT_QUEUE_KEY = 'chat_support_queue';
const AGENT_PRESENCE_PREFIX = 'support_agent_presence:';

/**
 * Pushes a client or guest session ID into the support chat queue.
 */
export async function addToChatQueue(sessionId: string): Promise<number> {
    const list = await redis.lrange(CHAT_QUEUE_KEY, 0, -1);
    if (list.includes(sessionId)) {
        const pos = await getQueuePosition(sessionId);
        return pos !== null ? pos : 0;
    }
    return await redis.rpush(CHAT_QUEUE_KEY, sessionId);
}

/**
 * Removes a session ID from the chat queue.
 */
export async function removeFromChatQueue(sessionId: string): Promise<number> {
    return await redis.lrem(CHAT_QUEUE_KEY, 0, sessionId);
}

/**
 * Returns the position (1-based index) of a session in the queue.
 */
export async function getQueuePosition(sessionId: string): Promise<number | null> {
    const list = await redis.lrange(CHAT_QUEUE_KEY, 0, -1);
    const index = list.indexOf(sessionId);
    return index !== -1 ? index + 1 : null;
}

/**
 * Returns the complete list of sessions currently in the queue.
 */
export async function getChatQueue(): Promise<string[]> {
    return await redis.lrange(CHAT_QUEUE_KEY, 0, -1);
}

/**
 * Pops the next session from the front of the queue to be assigned.
 */
export async function popNextSession(): Promise<string | null> {
    return await redis.lpop(CHAT_QUEUE_KEY);
}

/**
 * Updates agent online status in Redis with an optional TTL (e.g. 5 minutes).
 */
export async function setAgentPresence(agentId: string, status: 'active' | 'inactive'): Promise<void> {
    const key = `${AGENT_PRESENCE_PREFIX}${agentId}`;
    if (status === 'active') {
        await redis.set(key, 'active', 'EX', 300);
    } else {
        await redis.del(key);
    }
}

/**
 * Gets agent presence status.
 */
export async function getAgentPresence(agentId: string): Promise<'active' | 'inactive'> {
    const key = `${AGENT_PRESENCE_PREFIX}${agentId}`;
    const value = await redis.get(key);
    return value === 'active' ? 'active' : 'inactive';
}

/**
 * Fetches all currently online agent IDs.
 */
export async function getOnlineAgents(): Promise<string[]> {
    const keys = await redis.keys(`${AGENT_PRESENCE_PREFIX}*`);
    return keys.map((key) => key.replace(AGENT_PRESENCE_PREFIX, ''));
}

export default {
    addToChatQueue,
    removeFromChatQueue,
    getQueuePosition,
    getChatQueue,
    popNextSession,
    setAgentPresence,
    getAgentPresence,
    getOnlineAgents,
};
