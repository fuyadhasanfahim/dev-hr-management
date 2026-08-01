/**
 * Pure decision logic behind GET /healthz — deliberately has no mongoose or
 * app import, so it can be unit-tested without a real DB connection. The
 * route handler in app.ts is a thin wrapper that passes in
 * `mongoose.connection.readyState`.
 */

export interface HealthStatus {
    statusCode: 200 | 503;
    body: {
        success: boolean;
        status: 'ok' | 'unavailable';
        db: 'connected' | 'disconnected';
    };
}

/** Mongoose connection.readyState values: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting. */
export function getHealthStatus(mongoReadyState: number): HealthStatus {
    const isConnected = mongoReadyState === 1;
    return isConnected
        ? { statusCode: 200, body: { success: true, status: 'ok', db: 'connected' } }
        : { statusCode: 503, body: { success: false, status: 'unavailable', db: 'disconnected' } };
}
