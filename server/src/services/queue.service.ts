import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import BillingServices from './billing.service.js';
import OrderModel, { OrderType } from '../models/order.model.js';
import envConfig from '../config/env.config.js';

const connection = new Redis(envConfig.redis_url);

export const emailQueue = new Queue('email-queue', { connection });
export const subscriptionQueue = new Queue('subscription-queue', { connection });

// Email Worker
const emailWorker = new Worker('email-queue', async (job: Job) => {
    const { to, subject } = job.data;
    // Mock generic send for this example, or use a specific template
    console.log(`[BullMQ] Sending Email to ${to}: ${subject}`);
}, { connection });

// Subscription Worker
const subscriptionWorker = new Worker('subscription-queue', async (_job: Job) => {
    console.log('Processing subscription billing cycle...');
    const subscriptions = await OrderModel.find({ orderType: OrderType.SUBSCRIPTION, status: 'active' });
    
    for (const sub of subscriptions) {
        try {
            // Generate monthly invoice
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days
            
            const invoice = await BillingServices.createInvoiceFromOrder(sub._id.toString(), dueDate);
            console.log(`Generated subscription invoice ${invoice.invoiceNumber}`);
            
            // Queue email to client
            await emailQueue.add('invoice-email', {
                to: 'client@example.com', // In reality, fetch client email
                subject: `New Invoice ${invoice.invoiceNumber}`,
                body: `Your new invoice for ${sub.title} is ready. Total: ${invoice.total} ${invoice.currency}`,
            });
        } catch (error) {
            console.error(`Failed to process subscription ${sub._id}:`, error);
        }
    }
}, { connection });

emailWorker.on('failed', (job, err) => {
    console.error(`Email Job ${job?.id} failed:`, err.message);
});

subscriptionWorker.on('failed', (job, err) => {
    console.error(`Subscription Job ${job?.id} failed:`, err.message);
});

// Setup CRON job for subscriptions (Run 1st of every month at midnight)
subscriptionQueue.add('monthly-billing', {}, {
    repeat: {
        pattern: '0 0 1 * *', // CRON format
    }
});
