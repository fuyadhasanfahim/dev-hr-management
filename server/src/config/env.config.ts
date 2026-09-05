import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.join(__dirname, '../../.env'),
});

// Validate required environment variables at startup
const requiredVars = [
    'MONGO_URI',
    'DB_NAME',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'TRUSTED_ORIGINS',
    'PORT',
    'NODE_ENV',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'CLOUDINARY_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'CLOUDINARY_UPLOAD_PATH',
    'QUOTATION_TOKEN_SECRET',
    'ENCRYPTION_KEY',
    'PAYMENT_TOKEN_SECRET',
] as const;

const missing = requiredVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
    throw new Error(
        `Missing required environment variables: ${missing.join(', ')}. ` +
            'Check your .env file.',
    );
}

// DECISION (E2-F2-T1): AWS_* and GEMINI_API_KEY are intentionally NOT in
// requiredVars above. Unlike ENCRYPTION_KEY (currently used to build the
// encrypted payment token in invoice.controller.ts, via utils/crypto.ts —
// and planned as the basis for real order-asset encryption under E2-F3-T1),
// these gate optional features — S3 attachment upload and AI chat — that
// already degrade gracefully without them: s3-upload.service.ts falls back
// to dummy credentials and only fails when S3 is actually called, and
// ai-chat.service.ts's getAI() throws its own clear, request-scoped error
// only when AI chat is actually invoked. Hard-requiring them would block
// environments that don't use those features at all. Warn at startup
// instead, so a misconfiguration is still visible without blocking boot.
const softWarnVars = [
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_NAME', 'GEMINI_API_KEY',
    'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET',
    'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET',
] as const;
const missingSoft = softWarnVars.filter((key) => !process.env[key]);
if (missingSoft.length > 0) {
    console.warn(
        `[env.config] Optional environment variables not set: ${missingSoft.join(', ')}. ` +
            'Features depending on them (S3 uploads, AI chat) will be unavailable until configured.',
    );
}

const envConfig = {
    node_env: process.env.NODE_ENV!,
    port: Number(process.env.PORT),

    mongo_uri: process.env.MONGO_URI!,
    db_name: process.env.DB_NAME!,

    // better-auth
    better_auth_secret: process.env.BETTER_AUTH_SECRET!,
    better_auth_url: process.env.BETTER_AUTH_URL!,
    trusted_origins: process.env.TRUSTED_ORIGINS!,

    // client
    client_url: process.env.CLIENT_URL || 'http://localhost:3000',
    // Base URL of the dashboard app, which now hosts the sign-in / sign-up /
    // reset-password pages (the standalone `auth` app was removed). Used to
    // build the links in invitation and password-reset emails.
    // `AUTH_APP_URL` is still read for backward compatibility.
    dashboard_url:
        process.env.DASHBOARD_URL ||
        process.env.AUTH_APP_URL ||
        process.env.CLIENT_URL ||
        'http://localhost:3000',

    // nodemailer
    smtp_user: process.env.SMTP_USER!,
    smtp_pass: process.env.SMTP_PASS!,
    smtp_host: process.env.SMTP_HOST!,
    smtp_port: Number(process.env.SMTP_PORT),
    smtp_secure: process.env.SMTP_SECURE!,

    // cloudinary
    cloudinary_name: process.env.CLOUDINARY_NAME!,
    cloudinary_api_key: process.env.CLOUDINARY_API_KEY!,
    cloudinary_secret: process.env.CLOUDINARY_API_SECRET!,
    cloudinary_upload_path: process.env.CLOUDINARY_UPLOAD_PATH!,

    // SMS Configuration
    sms_api_key: process.env.SMS_API_KEY,
    monthly_report_day: Number(process.env.MONTHLY_REPORT_DAY) || 10,
    monthly_report_hour: Number(process.env.MONTHLY_REPORT_HOUR) || 10,
    monthly_report_minute: Number(process.env.MONTHLY_REPORT_MINUTE) || 0,

    // Advanced SaaS Integrations
    redis_url: process.env.REDIS_URL || 'redis://localhost:6379',

    // Quotation pipeline
    quotation_token_secret: process.env.QUOTATION_TOKEN_SECRET!,

    // Google Calendar / Meet integration
    google_service_account_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    google_service_account_private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '',
    google_calendar_id: process.env.GOOGLE_CALENDAR_ID || 'primary',

    // AWS S3
    aws_access_key_id: process.env.AWS_ACCESS_KEY_ID || '',
    aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY || '',
    aws_region: process.env.AWS_REGION || 'us-east-1',
    aws_bucket_name: process.env.AWS_BUCKET_NAME || '',

    // Gemini AI
    gemini_api_key: process.env.GEMINI_API_KEY || '',

    // Payment pipeline — client invoice payment links (JWT signing) +
    // gateway credentials. The token secret is hard-required (see
    // requiredVars above); the gateway credentials only gate their own
    // feature and degrade gracefully (route returns 503) when absent.
    payment_token_secret: process.env.PAYMENT_TOKEN_SECRET!,
    payment_client_url: process.env.PAYMENT_CLIENT_URL || '',
    /** Comma-separated recipients for the online-payment admin notification email. Falls back to SMTP_USER if unset. */
    payment_admin_emails: process.env.PAYMENT_ADMIN_EMAILS || '',
    stripe_secret_key: process.env.STRIPE_SECRET_KEY || '',
    stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || '',
    stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || '',
    paypal_mode: process.env.PAYPAL_MODE || 'sandbox',
    paypal_client_id: process.env.PAYPAL_CLIENT_ID || '',
    paypal_client_secret: process.env.PAYPAL_CLIENT_SECRET || '',
    paypal_api_base_url: process.env.PAYPAL_API_BASE_URL || '',
};
export default envConfig;
