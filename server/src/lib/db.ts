import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import envConfig from '../config/env.config.js';

let isConnecting = false;
let connectPromise: Promise<MongoClient> | null = null;

export async function client(): Promise<MongoClient> {
    if (mongoose.connection.readyState === 1 && mongoose.connection.getClient()) {
        return mongoose.connection.getClient() as unknown as MongoClient;
    }

    if (!connectPromise) {
        connectPromise = (async () => {
            if (mongoose.connection.readyState === 0 && !isConnecting) {
                isConnecting = true;
                await mongoose.connect(envConfig.mongo_uri, {
                    maxPoolSize: 10,
                    serverSelectionTimeoutMS: 5000,
                    socketTimeoutMS: 45000,
                });
                console.log('🟢 MongoDB & Mongoose Client Connected');

                // Programmatically drop the legacy unique index on earnings to prevent payment sync issues
                try {
                    const db = mongoose.connection.db;
                    if (db) {
                        await db.collection('earnings').dropIndex('clientId_1_month_1_year_1');
                        console.log('🗑️ Legacy unique index on earnings dropped successfully');
                    }
                } catch (err: any) {
                    // Ignore error if index doesn't exist
                    if (err.code !== 27 && err.codeName !== 'IndexNotFound') {
                        console.warn('⚠️ Non-critical failure dropping legacy earnings index:', err.message);
                    }
                }
            } else if (mongoose.connection.readyState === 2) {
                await new Promise<void>((resolve, reject) => {
                    mongoose.connection.once('open', resolve);
                    mongoose.connection.once('error', reject);
                });
            }
            return mongoose.connection.getClient() as unknown as MongoClient;
        })();
    }

    return await connectPromise;
}
