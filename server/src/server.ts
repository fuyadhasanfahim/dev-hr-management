import './lib/dns-init.js';
import { client } from "./lib/db.js";
import envConfig from "./config/env.config.js";
import { createServer } from "http";
import mongoose from "mongoose";
import app from "./app.js";
import schedulerService from "./services/scheduler.service.js";
import { initSocket } from "./socket.js";
import { logger } from "./lib/logger.js";
import { initSentry } from "./lib/sentry.js";
import { createGracefulShutdown } from "./lib/gracefulShutdown.js";

import { cleanupDuplicateOverviewInDB } from './utils/cleanupDuplicateOverview.js';

const { port } = envConfig;

async function Server() {
    try {
        initSentry();
        await client();

        logger.info("db.connected");

        // Run database overview deduplication
        await cleanupDuplicateOverviewInDB();

        const server = createServer(app);

        // Initialize Socket.io
        initSocket(server);

        server.listen(envConfig.port, () => {
            logger.info({ port }, "server.listening");
        });

        // Start all schedulers (attendance, overtime, leave)
        schedulerService.startAllSchedulers();

        // Graceful shutdown: stop accepting new connections, let in-flight
        // requests finish, close the DB connection, then exit — bounded by
        // a timeout so a hung request/connection can never block shutdown
        // indefinitely (deploys/restarts send SIGTERM and expect the
        // process to actually exit).
        const shutdown = createGracefulShutdown(server, {
            closeResources: async () => {
                // Stop schedulers first (including the Outbox worker, E5-F1-T2
                // Phase 1) so no new background work starts against a DB
                // connection that's about to close, then close the connection.
                await schedulerService.stopAllSchedulers();
                await mongoose.connection.close();
            },
            onLog: (level, event, meta) => logger[level](meta, event),
        });
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        logger.error({ err: error }, "db.connection_error");
        process.exit(1);
    }
}

Server(); // Trigger restart for .env update
