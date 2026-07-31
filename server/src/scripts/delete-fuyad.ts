import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';

async function deleteUserAndActivity() {
    try {
        await mongoose.connect(envConfig.mongo_uri as string);
        console.log('Connected to DB');

        const db = mongoose.connection.db;
        if (!db) throw new Error('DB connection failed');

        const email = 'codewithfuyad@gmail.com';
        
        // Find user
        const user = await db.collection('user').findOne({ email });
        if (!user) {
            console.log('User not found:', email);
            process.exit(0);
        }

        const userId = user._id;
        const userIdStr = userId.toString();

        console.log('Found user with ID:', userIdStr);

        // Delete from better-auth collections
        const delUser = await db.collection('user').deleteOne({ _id: userId });
        const delAccount = await db.collection('account').deleteMany({ userId: userIdStr });
        const delSession = await db.collection('session').deleteMany({ userId: userIdStr });

        console.log(`Deleted user: ${delUser.deletedCount}, accounts: ${delAccount.deletedCount}, sessions: ${delSession.deletedCount}`);

        // Find staff
        const staff = await db.collection('staffs').findOne({ userId });
        if (staff) {
            const staffId = staff._id;
            const delStaff = await db.collection('staffs').deleteOne({ _id: staffId });
            console.log(`Deleted staff record: ${delStaff.deletedCount}`);
        } else {
            console.log('No staff record found for user');
        }

        // Delete audit logs (optional but user requested "activity")
        const delAudit = await db.collection('auditlogs').deleteMany({ userId });
        console.log(`Deleted audit logs: ${delAudit.deletedCount}`);

        console.log('Cleanup complete');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

deleteUserAndActivity();
