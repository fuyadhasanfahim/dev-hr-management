import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { client } from './db.js';
import emailService from '../services/email.service.js';
import envConfig from '../config/env.config.js';
import { Role } from '../constants/role.js';

const { db_name, better_auth_secret, trusted_origins } = envConfig;
const mongoClient = await client();
const db = mongoClient.db(db_name);

export const auth = betterAuth({
    secret: better_auth_secret,
    database: mongodbAdapter(db, {
        client: mongoClient,
    }),
    advanced: {
        defaultCookieAttributes: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            ...(process.env.NODE_ENV === 'production' && { domain: '.webbriks.com' }),
        },
    },
    user: {
        additionalFields: {
            role: {
                type: 'string',
                required: false,
                defaultValue: Role.STAFF,
            },
            // Phase 1 — per-user permission overrides layered on top of the
            // user's role. `input: false` so a client can never set these at
            // sign-up / update; only server-side admin flows (Phase 5) write
            // them. Resolved by `lib/permissions.ts` (Phase 2) as:
            //   effective = (role.permissions ∪ extraPermissions) − deniedPermissions
            extraPermissions: {
                type: 'string[]',
                required: false,
                defaultValue: [],
                input: false,
            },
            deniedPermissions: {
                type: 'string[]',
                required: false,
                defaultValue: [],
                input: false,
            },
            theme: {
                type: 'string',
                required: false,
                defaultValue: 'system',
            },
        },
        changeEmail: {
            enabled: true,
        },
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        async sendResetPassword(data) {
            try {
                let resetPasswordUrl = data.url;
                try {
                    const parsedUrl = new URL(data.url);
                    const token = parsedUrl.searchParams.get('token');
                    if (token) {
                        const baseUrl = envConfig.dashboard_url;
                        resetPasswordUrl = `${baseUrl}/reset-password?token=${token}`;
                    }
                } catch (e) {
                    console.error('[Auth] Error formatting reset password URL:', e);
                }

                await emailService.sendResetPasswordEmail({
                    to: data.user.email,
                    userName: data.user.name || 'User',
                    resetPasswordUrl,
                });
            } catch (error) {
                console.error(
                    `[Auth] Failed to send reset password email to ${data.user.email}:`,
                    error,
                );
            }
        },
    },
    emailVerification: {
        sendOnSignUp: false,
        async sendVerificationEmail({ url, user }) {
            try {
                // Ensure callbackUrl is included so the user lands on the
                // dashboard sign-in page after verifying their email.
                const verifyUrl = new URL(url);
                if (!verifyUrl.searchParams.has('callbackUrl')) {
                    verifyUrl.searchParams.set(
                        'callbackUrl',
                        `${envConfig.dashboard_url}/sign-in`,
                    );
                }
                const finalUrl = verifyUrl.toString();

                await emailService.sendVerificationEmail({
                    to: user.email,
                    userName: user.name || 'User',
                    verificationUrl: finalUrl,
                });
            } catch (error) {
                console.error(
                    `[Auth] Failed to send verification email to ${user.email}:`,
                    error,
                );
            }
        },
    },
    trustedOrigins: trusted_origins.split(',').map((o) => o.trim()).filter(Boolean),
});
