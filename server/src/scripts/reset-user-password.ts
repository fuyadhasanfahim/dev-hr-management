import { MongoClient } from 'mongodb';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const TARGET_EMAIL = 'asad4boss@gmail.com';
const NEW_PASSWORD = 'J@nin@272385$$';

function hexEncode(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

// Matches exactly how better-auth hashes passwords internally
async function hashPassword(password: string): Promise<string> {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = hexEncode(saltBytes);
    const key = await scryptAsync(password.normalize('NFKC'), salt, {
        N: 16384,
        r: 16,
        p: 1,
        dkLen: 64,
        maxmem: 128 * 16384 * 16 * 2,
    });
    return `${salt}:${hexEncode(key)}`;
}

async function resetPassword() {
    const mongoUri = process.env.MONGO_URI;
    const dbName = process.env.DB_NAME;

    if (!mongoUri || !dbName) {
        console.error('Missing MONGO_URI or DB_NAME in .env');
        process.exit(1);
    }

    const mongoClient = new MongoClient(mongoUri);

    try {
        await mongoClient.connect();
        console.log('Connected to MongoDB');

        const db = mongoClient.db(dbName);
        const userCollection = db.collection('user');
        const accountCollection = db.collection('account');

        const user = await userCollection.findOne({ email: TARGET_EMAIL });
        if (!user) {
            console.error(`User not found: ${TARGET_EMAIL}`);
            process.exit(1);
        }

        const userId = (user._id ?? user.id).toString();
        console.log(`Found user: ${user.name} (id: ${userId})`);

        const hashedPassword = await hashPassword(NEW_PASSWORD);

        const result = await accountCollection.updateOne(
            { accountId: userId, providerId: 'credential' },
            { $set: { password: hashedPassword, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            console.error(`No credential account found for user: ${TARGET_EMAIL}`);
            process.exit(1);
        }

        console.log(`Password successfully reset for ${TARGET_EMAIL}`);
    } catch (error) {
        console.error('Script failed:', error);
        process.exit(1);
    } finally {
        await mongoClient.close();
        console.log('Disconnected from MongoDB');
    }
}

resetPassword();
