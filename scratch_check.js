import mongoose from 'mongoose';

const MONGO_URI = "mongodb+srv://hradmin:yVFPYzb1mvd0LSEN@cluster0.wfr2u.mongodb.net/dev-hr-management?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB.");
        
        const tasks = await mongoose.connection.db.collection('ordertasks').find({}).toArray();
        console.log(`Total tasks found: ${tasks.length}`);
        
        for (const task of tasks) {
            console.log(`- Task: "${task.title}" | AssignedTo: ${task.assignedTo} | Status: ${task.status}`);
        }
        
        const staffs = await mongoose.connection.db.collection('staffs').find({}).toArray();
        console.log(`\nTotal staffs found: ${staffs.length}`);
        for(const s of staffs) {
             console.log(`- Staff ID: ${s._id} | User: ${s.user} | Name: ${s.name}`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
