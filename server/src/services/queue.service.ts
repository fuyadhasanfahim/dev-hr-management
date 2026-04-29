import { EventEmitter } from 'events';

/**
 * In-Memory Event Bus (Option B: No Redis)
 * 
 * This replaces BullMQ for local development. 
 * Events are processed asynchronously in the same Node.js process.
 */
class QuotationEventBus extends EventEmitter {
    /**
     * Add a job to the bus. 
     * In the Redis version, this enqueued to BullMQ.
     * Here, it simply emits an event immediately.
     */
    async add(eventName: string, data: any) {
        // We use setImmediate to ensure it's processed in the next tick (non-blocking)
        setImmediate(() => {
            this.emit(eventName, data);
        });
        return { id: 'local-' + Date.now() };
    }
}

export const quotationPaymentEventQueue = new QuotationEventBus();

// Dummy queues for compatibility with existing code
export const emailQueue = { add: async () => {} };
export const subscriptionQueue = { add: async () => {} };
