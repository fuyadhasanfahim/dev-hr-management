import mongoose from 'mongoose';

const MONGO_URI = "mongodb+srv://hradmin:yVFPYzb1mvd0LSEN@cluster0.wfr2u.mongodb.net/dev-hr-management?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected.");
        
        const db = mongoose.connection.db;
        const tasks = await db.collection('ordertasks').find({}).toArray();
        console.log(`Total Tasks: ${tasks.length}`);
        tasks.forEach(t => {
            console.log(`Task: [${t._id}] "${t.title}" -> assignedTo: ${t.assignedTo}, status: ${t.status}`);
        });
        
        const staffs = await db.collection('staffs').find({}).toArray();
        console.log(`\nTotal Staffs: ${staffs.length}`);
        staffs.forEach(s => {
            console.log(`Staff: [${s._id}] | user: ${s.user} | name: ${s.name || 'N/A'}`);
        });

        const users = await db.collection('users').find({}).toArray();
        console.log(`\nTotal Users: ${users.length}`);
        users.forEach(u => {
            console.log(`User: [${u._id}] | name: ${u.name} | role: ${u.role}`);
        });
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
