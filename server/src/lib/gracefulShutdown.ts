import type { Server } from 'http';

/**
 * Factory for a SIGTERM/SIGINT handler: stop accepting new connections,
 * let in-flight requests finish, close external resources (DB, etc.), then
 * exit — with a bounded timeout so a hung connection/request can never
 * block shutdown indefinitely.
 *
 * `closeResources`, `exit`, and `onLog` are injectable specifically so this
 * can be unit-tested against a bare in-process http.Server, without needing
 * a real DB connection to close and without the test process actually
 * calling `process.exit`. Production wiring (server.ts) supplies the real
 * `mongoose.connection.close`, `process.exit`, and `logger` behind these.
 */
export interface GracefulShutdownOptions {
    /** Hard cap on shutdown duration before forcing exit. Default 10s. */
    timeoutMs?: number;
    /** Called after the HTTP server has stopped accepting connections. */
    closeResources?: () => Promise<void>;
    /** Called instead of `process.exit` — defaults to `process.exit`. */
    exit?: (code: number) => void;
    /** Called for every lifecycle event, for logging. */
    onLog?: (level: 'info' | 'error', event: string, meta: Record<string, unknown>) => void;
}

export function createGracefulShutdown(
    server: Server,
    options: GracefulShutdownOptions = {},
): (signal: string) => void {
    const {
        timeoutMs = 10_000,
        closeResources = async () => {},
        exit = (code: number) => process.exit(code),
        onLog = () => {},
    } = options;

    return function shutdown(signal: string): void {
        onLog('info', 'server.shutdown.started', { signal });

        const forceExitTimer = setTimeout(() => {
            onLog('error', 'server.shutdown.timed_out_forcing_exit', { signal, timeoutMs });
            exit(1);
        }, timeoutMs);

        server.close((err) => {
            if (err) {
                onLog('error', 'server.shutdown.http_close_error', { signal, err: err.message });
            }
            closeResources()
                .catch((resourceErr: unknown) => {
                    onLog('error', 'server.shutdown.resource_close_error', {
                        signal,
                        err: resourceErr instanceof Error ? resourceErr.message : String(resourceErr),
                    });
                })
                .finally(() => {
                    clearTimeout(forceExitTimer);
                    onLog('info', 'server.shutdown.completed', { signal });
                    exit(0);
                });
        });
    };
}
