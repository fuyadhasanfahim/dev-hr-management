/**
 * Unit tests for E3-F1-T1: createGracefulShutdown's timeout-race logic.
 *
 * Runs against a bare in-process http.Server (no Express, no app.ts, no
 * mongoose import) — this sidesteps the same DB-connectivity wall hit by
 * the E1-F1-T1/E2-F1-T1/E2-F2-T1 tests (app.ts transitively imports
 * lib/auth.ts, which connects to Mongo at module load; this sandbox has no
 * network path to the project's real cluster). `exit` and `onLog` are
 * stubbed via the factory's injectable options, so these tests never call
 * the real `process.exit` and never touch a real database.
 *
 * Run with: node --import tsx --test src/lib/__tests__/gracefulShutdown.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { connect as netConnect, type Socket } from 'node:net';
import { createGracefulShutdown } from '../gracefulShutdown.js';

function startServer(): Promise<Server> {
    return new Promise((resolve) => {
        const server = createServer((_req, res) => res.end('ok'));
        server.listen(0, () => resolve(server));
    });
}

function serverPort(server: Server): number {
    const addr = server.address();
    if (addr === null || typeof addr === 'string') throw new Error('server has no port');
    return addr.port;
}

function stopServerForReal(server: Server): Promise<void> {
    return new Promise((resolve) => {
        // Node 18.2+: forcibly drop any lingering test sockets so cleanup
        // doesn't hang, regardless of what the test above did.
        server.closeAllConnections?.();
        server.close(() => resolve());
    });
}

describe('createGracefulShutdown — happy path', () => {
    test('no open connections: closes resources and exits 0 quickly, timer is cleared', async () => {
        const server = await startServer();
        try {
            const exitCalls: number[] = [];
            const logs: Array<{ level: string; event: string }> = [];
            let closeResourcesCalled = false;

            const shutdown = createGracefulShutdown(server, {
                timeoutMs: 5_000, // long — must NOT be the reason exit happens here
                closeResources: async () => {
                    closeResourcesCalled = true;
                },
                exit: (code) => exitCalls.push(code),
                onLog: (level, event) => logs.push({ level, event }),
            });

            await new Promise<void>((resolve) => {
                const check = setInterval(() => {
                    if (exitCalls.length > 0) {
                        clearInterval(check);
                        resolve();
                    }
                }, 10);
                shutdown('SIGTERM');
            });

            assert.deepEqual(exitCalls, [0]);
            assert.ok(closeResourcesCalled, 'closeResources must be called before exit');
            assert.ok(
                logs.some((l) => l.event === 'server.shutdown.started'),
                'must log shutdown start',
            );
            assert.ok(
                logs.some((l) => l.event === 'server.shutdown.completed'),
                'must log shutdown completion',
            );
            assert.ok(
                !logs.some((l) => l.event === 'server.shutdown.timed_out_forcing_exit'),
                'must NOT hit the timeout path when shutdown completes quickly',
            );
        } finally {
            await stopServerForReal(server);
        }
    });
});

describe('createGracefulShutdown — bounded timeout on a hung connection', () => {
    test('a still-open connection blocks server.close(), forced exit(1) still fires within the configured timeout', async () => {
        const server = await startServer();
        let hangingSocket: Socket | undefined;
        try {
            // Open a raw TCP connection and deliberately never close it —
            // http.Server#close() waits for existing connections to end
            // before invoking its callback, so this reliably simulates a
            // hung/slow client blocking a clean shutdown.
            hangingSocket = netConnect(serverPort(server));
            await new Promise<void>((resolve, reject) => {
                hangingSocket!.once('connect', () => resolve());
                hangingSocket!.once('error', reject);
            });

            const exitCalls: number[] = [];
            const logs: Array<{ level: string; event: string }> = [];
            const timeoutMs = 150;

            const shutdown = createGracefulShutdown(server, {
                timeoutMs,
                closeResources: async () => {
                    // Would only run once server.close()'s callback fires,
                    // which — with the connection still open — it won't
                    // within this test.
                },
                exit: (code) => exitCalls.push(code),
                onLog: (level, event) => logs.push({ level, event }),
            });

            const start = Date.now();
            await new Promise<void>((resolve) => {
                const check = setInterval(() => {
                    if (exitCalls.length > 0) {
                        clearInterval(check);
                        resolve();
                    }
                }, 10);
                shutdown('SIGTERM');
            });
            const elapsedMs = Date.now() - start;

            assert.deepEqual(exitCalls, [1], 'must force-exit with code 1 on timeout');
            assert.ok(
                elapsedMs >= timeoutMs - 20,
                `forced exit fired too early (${elapsedMs}ms, expected >= ~${timeoutMs}ms)`,
            );
            assert.ok(
                elapsedMs < timeoutMs + 2_000,
                `forced exit took far longer than the configured timeout (${elapsedMs}ms) — timeout mechanism may be broken`,
            );
            assert.ok(logs.some((l) => l.event === 'server.shutdown.timed_out_forcing_exit'));
        } finally {
            hangingSocket?.destroy();
            await stopServerForReal(server);
        }
    });
});

describe('createGracefulShutdown — resource close failure does not block exit', () => {
    test('closeResources rejecting still results in exit(0), with the error logged', async () => {
        const server = await startServer();
        try {
            const exitCalls: number[] = [];
            const logs: Array<{ level: string; event: string }> = [];

            const shutdown = createGracefulShutdown(server, {
                timeoutMs: 5_000,
                closeResources: async () => {
                    throw new Error('simulated DB close failure');
                },
                exit: (code) => exitCalls.push(code),
                onLog: (level, event) => logs.push({ level, event }),
            });

            await new Promise<void>((resolve) => {
                const check = setInterval(() => {
                    if (exitCalls.length > 0) {
                        clearInterval(check);
                        resolve();
                    }
                }, 10);
                shutdown('SIGTERM');
            });

            assert.deepEqual(
                exitCalls,
                [0],
                'a failed resource close must not prevent the process from exiting — the goal is guaranteed exit',
            );
            assert.ok(logs.some((l) => l.level === 'error' && l.event === 'server.shutdown.resource_close_error'));
        } finally {
            await stopServerForReal(server);
        }
    });
});
