import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import envConfig from '../config/env.config.js';
import TicketModel from '../models/ticket.model.js';
import TicketMessageModel from '../models/ticket-message.model.js';
import ChatMessageModel from '../models/chat-message.model.js';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';

const s3Client = new S3Client({
    region: envConfig.aws_region || 'us-east-1',
    credentials: {
        accessKeyId: envConfig.aws_access_key_id || 'dummy',
        secretAccessKey: envConfig.aws_secret_access_key || 'dummy',
    },
});

/**
 * Downloads a file from Cloudinary URL and uploads it to AWS S3.
 * Returns the new S3 public URL.
 */
export async function migrateUrlToS3(cloudinaryUrl: string, folder: string): Promise<string> {
    if (!cloudinaryUrl.includes('res.cloudinary.com')) {
        return cloudinaryUrl;
    }

    try {
        const response = await axios.get(cloudinaryUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
        
        const urlParts = cloudinaryUrl.split('/');
        const originalFileName = urlParts[urlParts.length - 1];
        const uniqueKey = `${folder}/${crypto.randomUUID()}_${originalFileName}`;

        const uploadCommand = new PutObjectCommand({
            Bucket: envConfig.aws_bucket_name || 'dummy-bucket',
            Key: uniqueKey,
            Body: buffer,
            ContentType: contentType,
        });

        await s3Client.send(uploadCommand);
        const s3Url = `https://${envConfig.aws_bucket_name || 'dummy-bucket'}.s3.${envConfig.aws_region || 'us-east-1'}.amazonaws.com/${uniqueKey}`;
        
        logger.info(`[Migration] Migrated ${cloudinaryUrl} -> ${s3Url}`);
        return s3Url;
    } catch (err: any) {
        logger.error(`[Migration] Failed to migrate ${cloudinaryUrl}: ${err.message}`);
        throw err;
    }
}

/**
 * Migration runner for support records.
 */
export async function runCloudinaryMigration(): Promise<{ tickets: number; ticketMessages: number; chatMessages: number }> {
    let migratedTickets = 0;
    let migratedTicketMsgs = 0;
    let migratedChatMsgs = 0;

    // 1. Migrate Tickets
    const tickets = await TicketModel.find({ attachments: { $regex: 'res.cloudinary.com' } });
    for (const ticket of tickets) {
        const newAttachments: string[] = [];
        for (const url of ticket.attachments) {
            if (url.includes('res.cloudinary.com')) {
                const s3Url = await migrateUrlToS3(url, `migrated-tickets/${ticket._id}`);
                newAttachments.push(s3Url);
            } else {
                newAttachments.push(url);
            }
        }
        ticket.attachments = newAttachments;
        await ticket.save();
        migratedTickets++;
    }

    // 2. Migrate Ticket Messages
    const ticketMsgs = await TicketMessageModel.find({ attachments: { $regex: 'res.cloudinary.com' } });
    for (const msg of ticketMsgs) {
        const newAttachments: string[] = [];
        for (const url of msg.attachments) {
            if (url.includes('res.cloudinary.com')) {
                const s3Url = await migrateUrlToS3(url, `migrated-ticket-messages/${msg._id}`);
                newAttachments.push(s3Url);
            } else {
                newAttachments.push(url);
            }
        }
        msg.attachments = newAttachments;
        await msg.save();
        migratedTicketMsgs++;
    }

    // 3. Migrate Chat Messages
    const chatMsgs = await ChatMessageModel.find({ attachments: { $regex: 'res.cloudinary.com' } });
    for (const msg of chatMsgs) {
        const newAttachments: string[] = [];
        for (const url of msg.attachments) {
            if (url.includes('res.cloudinary.com')) {
                const s3Url = await migrateUrlToS3(url, `migrated-chat-messages/${msg._id}`);
                newAttachments.push(s3Url);
            } else {
                newAttachments.push(url);
            }
        }
        msg.attachments = newAttachments;
        await msg.save();
        migratedChatMsgs++;
    }

    return {
        tickets: migratedTickets,
        ticketMessages: migratedTicketMsgs,
        chatMessages: migratedChatMsgs,
    };
}

export default {
    migrateUrlToS3,
    runCloudinaryMigration,
};
