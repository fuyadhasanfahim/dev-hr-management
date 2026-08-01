/**
 * Unit tests for E2-F2-T1: fail-fast startup validation of security-critical
 * environment variables in env.config.ts.
 *
 * env.config.ts has real module-level side effects (dotenv.config() +
 * a top-level throw), so it can't be imported directly into this test
 * process without those side effects leaking into every other test file
 * that happens to import anything transitively pulling in env.config.ts.
 * Instead, each scenario spawns an isolated child process that imports
 * ONLY env.config.ts with a fully-controlled, fake environment — no real
 * secrets from server/.env are ever read or used here.
 *
 * Key trick: dotenv.config() (by default) does NOT override a key that is
 * already present in process.env, even if its value is an empty string —
 * only genuinely *missing* keys get filled from the .env file. Setting a
 * var to `''` in the spawned environment therefore reliably simulates "not
 * configured" without dotenv silently backfilling it from the real
 * server/.env file, and without ever needing to read or touch that file.
 *
 * Run with: node --import tsx --test src/config/__tests__/env-config-validation.test.ts
 * (run from the `server/` directory)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '../../../');

/** Every var currently in env.config.ts's hard-required `requiredVars` list. */
const FULL_VALID_ENV: Record<string, string> = {
    MONGO_URI: 'mongodb://localhost:27017',
    DB_NAME: 'test_db',
    BETTER_AUTH_SECRET: 'test-secret',
    BETTER_AUTH_URL: 'http://localhost:5000',
    TRUSTED_ORIGINS: 'http://localhost:3000',
    PORT: '5000',
    NODE_ENV: 'test',
    SMTP_USER: 'test@example.com',
    SMTP_PASS: 'test-pass',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    CLOUDINARY_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    CLOUDINARY_UPLOAD_PATH: 'test-uploads',
    QUOTATION_TOKEN_SECRET: 'test-token-secret',
    ENCRYPTION_KEY: 'test-encryption-key',
    // Soft-warn vars — non-empty here so the "full valid config" case is
    // fully clean (no warning) as its own baseline.
    AWS_ACCESS_KEY_ID: 'test-aws-key',
    AWS_SECRET_ACCESS_KEY: 'test-aws-secret',
    AWS_BUCKET_NAME: 'test-bucket',
    GEMINI_API_KEY: 'test-gemini-key',
};

/**
 * Spawns a child process that imports only env.config.ts against the given
 * env overrides layered on top of FULL_VALID_ENV, and reports whether the
 * import succeeded, plus captured stdout/stderr.
 */
function runEnvConfigImport(overrides: Record<string, string>) {
    const env: Record<string, string | undefined> = {
        // Minimal inherited vars needed to actually run node/tsx.
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot, // Windows: required for Node to resolve DNS/child processes
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        ...FULL_VALID_ENV,
        ...overrides,
    };

    const script =
        "import('./src/config/env.config.ts')" +
        ".then(() => { console.log('ENV_CONFIG_IMPORT_OK'); process.exit(0); })" +
        ".catch((e) => { console.error('ENV_CONFIG_IMPORT_FAILED: ' + e.message); process.exit(1); });";

    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
        cwd: serverRoot,
        env,
        encoding: 'utf-8',
        timeout: 15_000,
    });

    return {
        status: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    };
}

describe('env.config.ts — hard-required vars (fail-fast)', () => {
    test('full valid config (including ENCRYPTION_KEY) boots successfully', () => {
        const { status, stdout } = runEnvConfigImport({});
        assert.equal(status, 0, `expected clean exit, got status ${status}`);
        assert.match(stdout, /ENV_CONFIG_IMPORT_OK/);
    });

    test('missing ENCRYPTION_KEY fails startup immediately with a clear message', () => {
        const { status, stderr } = runEnvConfigImport({ ENCRYPTION_KEY: '' });
        assert.notEqual(status, 0, 'expected a non-zero exit for missing ENCRYPTION_KEY');
        assert.match(stderr, /Missing required environment variables/);
        assert.match(stderr, /ENCRYPTION_KEY/);
    });

    test('missing a pre-existing required var (e.g. MONGO_URI) still fails, same as before this change', () => {
        const { status, stderr } = runEnvConfigImport({ MONGO_URI: '' });
        assert.notEqual(status, 0);
        assert.match(stderr, /Missing required environment variables/);
        assert.match(stderr, /MONGO_URI/);
    });

    test('multiple missing required vars are all listed together in one message', () => {
        const { status, stderr } = runEnvConfigImport({ ENCRYPTION_KEY: '', MONGO_URI: '' });
        assert.notEqual(status, 0);
        assert.match(stderr, /ENCRYPTION_KEY/);
        assert.match(stderr, /MONGO_URI/);
    });
});

describe('env.config.ts — soft-warn vars (AWS_*, GEMINI_API_KEY)', () => {
    test('missing AWS/Gemini vars does NOT fail startup, but logs a warning', () => {
        const { status, stdout, stderr } = runEnvConfigImport({
            AWS_ACCESS_KEY_ID: '',
            AWS_SECRET_ACCESS_KEY: '',
            AWS_BUCKET_NAME: '',
            GEMINI_API_KEY: '',
        });
        assert.equal(status, 0, 'missing soft-warn vars must not block startup');
        assert.match(stdout, /ENV_CONFIG_IMPORT_OK/);
        const combined = stdout + stderr;
        assert.match(combined, /AWS_ACCESS_KEY_ID/);
        assert.match(combined, /GEMINI_API_KEY/);
    });

    test('a fully valid config (all vars present) produces no soft-warn output', () => {
        const { status, stdout, stderr } = runEnvConfigImport({});
        assert.equal(status, 0);
        const combined = stdout + stderr;
        assert.doesNotMatch(combined, /Optional environment variables not set/);
    });
});
