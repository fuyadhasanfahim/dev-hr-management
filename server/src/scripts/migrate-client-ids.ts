import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import ClientServices from '../services/client.service.js';

const runMigration = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(envConfig.mongo_uri as string);
        console.log('Connected successfully.');

        console.log('Starting client ID migration...');
        const result = await ClientServices.migrateClientIdsInDB();
        
        console.log(`Migration complete! Updated ${result.updatedCount} clients.`);
        console.log('Mappings:', result.mappings.map(m => `${m.name}: ${m.oldClientId} -> ${m.newClientId}`).join('\n'));
        
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
