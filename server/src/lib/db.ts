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
