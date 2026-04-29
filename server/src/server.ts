import { connect } from "mongoose";
import envConfig from "./config/env.config.js";
import { createServer } from "http";
import app from "./app.js";
import schedulerService from "./services/scheduler.service.js";
import { initSocket } from "./socket.js";
import { registerOutboxWorker } from "./services/outbox.worker.js";
import { logger } from "./lib/logger.js";
import { initSentry } from "./lib/sentry.js";

const { port, mongo_uri } = envConfig;

async function Server() {
    try {
        initSentry();
        await connect(mongo_uri);

        logger.info("db.connected");

        const server = createServer(app);

        // Initialize Socket.io
        initSocket(server);

        server.listen(envConfig.port, () => {
            logger.info({ port }, "server.listening");
        });

        // Register BullMQ workers
        // OutboxWorker handles: order creation, asset unlock, order completion
        registerOutboxWorker();

        // Start all schedulers (attendance, overtime, leave)
        schedulerService.startAllSchedulers();
    } catch (error) {
        logger.error({ err: error }, "db.connection_error");
        process.exit(1);
    }
}

Server(); // Trigger restart for .env update
