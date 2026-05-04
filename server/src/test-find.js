import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';

dotenv.config({ path: 'C:/Users/fuyad/Codes/office/dev-hr-management/server/.env' });

async function run() {
    try {
        console.log("Connecting to MongoDB...", process.env.OFFICE_MONGO_URI);
        await mongoose.connect(process.env.OFFICE_MONGO_URI || '');
        console.log("Connected!");

        const collection = mongoose.connection.collection('quotationtemplates');
        const count = await collection.countDocuments();
        console.log(`There are ${count} templates in total.`);

        const templates = await collection.find().toArray();
        console.log("Templates fetched successfully:", templates.length);
    } catch (err) {
        console.error("ERROR DETECTED:", err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
