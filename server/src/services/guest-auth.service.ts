import GuestModel, { type IGuest } from '../models/guest.model.js';
import emailService from './email.service.js';
import jwt from 'jsonwebtoken';
import envConfig from '../config/env.config.js';
import { AppError } from '../utils/AppError.js';

const GUEST_JWT_SECRET = envConfig.better_auth_secret;

// Short-lived bearer the client sends on every request; validated by the route
// guard. Long-lived refresh token lives in an httpOnly cookie and is rotated.
const ACCESS_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL = '90d';

// Failed-OTP lockout policy.
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generates a 6-digit OTP code.
 */
function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Issues the access + refresh token pair for a verified guest.
 * Access carries identity (consumed by the route guard); refresh carries the
 * tokenVersion so it can be revoked en masse.
 */
function issueGuestTokens(guest: IGuest): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign(
        {
            id: guest._id.toString(),
            email: guest.email,
            name: guest.name,
            role: 'Guest',
            type: 'access',
        },
        GUEST_JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL }
    );

    const refreshToken = jwt.sign(
        {
            id: guest._id.toString(),
            role: 'Guest',
            type: 'refresh',
            tokenVersion: guest.tokenVersion ?? 0,
        },
        GUEST_JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_TTL }
    );

    return { accessToken, refreshToken };
}

/**
 * Request an OTP for guest email verification.
 * Creates a guest profile if one does not exist.
 */
export async function requestGuestOtp(email: string, name: string): Promise<{ message: string }> {
    if (!email || !name) {
        throw new AppError('Email and name are required', 400);
    }

    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    let guest = await GuestModel.findOne({ email: email.toLowerCase() });

    if (guest) {
        guest.name = name;
        guest.otp = otp;
        guest.otpExpiresAt = otpExpiresAt;
        // A fresh code clears any prior failed-attempt lockout.
        guest.otpAttempts = 0;
        guest.otpLockedUntil = undefined;
        await guest.save();
    } else {
        guest = await GuestModel.create({
            name,
            email: email.toLowerCase(),
            otp,
            otpExpiresAt,
            emailVerified: false,
        });
    }

    await emailService.sendSupportOtpEmail({
        to: guest.email,
        guestName: guest.name,
        otp,
    });

    return { message: 'OTP sent to email successfully' };
}

/**
 * Verifies the OTP sent to guest.
 * Generates a JWT token for the guest to authenticate future chat/ticket actions.
 */
export async function verifyGuestOtp(
    email: string,
    otp: string
): Promise<{ accessToken: string; refreshToken: string; guest: IGuest }> {
    if (!email || !otp) {
        throw new AppError('Email and OTP are required', 400);
    }

    const guest = await GuestModel.findOne({ email: email.toLowerCase() });
    if (!guest) {
        throw new AppError('Guest profile not found', 404);
    }

    // Brute-force guard: refuse while locked.
    if (guest.otpLockedUntil && guest.otpLockedUntil > new Date()) {
        throw new AppError('Too many incorrect attempts. Please request a new code.', 429);
    }

    if (guest.otpExpiresAt && guest.otpExpiresAt < new Date()) {
        throw new AppError('OTP has expired', 400);
    }

    if (!guest.otp || guest.otp !== otp) {
        guest.otpAttempts = (guest.otpAttempts ?? 0) + 1;
        if (guest.otpAttempts >= MAX_OTP_ATTEMPTS) {
            guest.otpLockedUntil = new Date(Date.now() + OTP_LOCK_MS);
            guest.otpAttempts = 0;
            await guest.save();
            throw new AppError('Too many incorrect attempts. Please request a new code.', 429);
        }
        await guest.save();
        throw new AppError('Invalid OTP', 400);
    }

    // Success — clear the OTP and any lockout, then mint tokens.
    guest.emailVerified = true;
    (guest as any).otp = undefined;
    (guest as any).otpExpiresAt = undefined;
    guest.otpAttempts = 0;
    guest.otpLockedUntil = undefined;
    guest.lastSeenAt = new Date();
    await guest.save();

    const { accessToken, refreshToken } = issueGuestTokens(guest);
    return { accessToken, refreshToken, guest };
}

/**
 * Exchanges a valid refresh token for a fresh access token and a rotated refresh
 * token (sliding session). Rejects if the token was revoked via tokenVersion.
 */
export async function refreshGuestSession(
    refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; guest: IGuest }> {
    if (!refreshToken) {
        throw new AppError('Refresh token required', 401);
    }

    let decoded: { id: string; role: string; type?: string; tokenVersion?: number };
    try {
        decoded = jwt.verify(refreshToken, GUEST_JWT_SECRET) as typeof decoded;
    } catch {
        throw new AppError('Session expired. Please verify your email again.', 401);
    }

    if (decoded.role !== 'Guest' || decoded.type !== 'refresh') {
        throw new AppError('Invalid refresh token', 401);
    }

    const guest = await GuestModel.findById(decoded.id);
    if (!guest) {
        throw new AppError('Guest profile not found', 401);
    }

    // A bumped tokenVersion invalidates every refresh token issued before it.
    if ((decoded.tokenVersion ?? 0) !== (guest.tokenVersion ?? 0)) {
        throw new AppError('Session revoked. Please verify your email again.', 401);
    }

    guest.lastSeenAt = new Date();
    await guest.save();

    const tokens = issueGuestTokens(guest);
    return { ...tokens, guest };
}

/**
 * Revokes all of a guest's refresh tokens by bumping tokenVersion (logout).
 */
export async function revokeGuestSessions(guestId: string): Promise<void> {
    await GuestModel.findByIdAndUpdate(guestId, { $inc: { tokenVersion: 1 } });
}

/**
 * Finds an existing guest by email or creates a lightweight one. Used when an
 * unverified visitor provides their name/email to create a ticket — they are not
 * email-verified (they must OTP to *view* tickets), but we can attribute the
 * ticket to them.
 */
export async function getOrCreateGuest(email: string, name: string): Promise<IGuest> {
    if (!email || !name) {
        throw new AppError('Name and email are required', 400);
    }
    const lower = email.toLowerCase().trim();
    let guest = await GuestModel.findOne({ email: lower });
    if (!guest) {
        guest = await GuestModel.create({ name: name.trim(), email: lower, emailVerified: false });
    } else if (name.trim() && guest.name !== name.trim()) {
        guest.name = name.trim();
        await guest.save();
    }
    return guest;
}

/**
 * Verifies if a given guest JWT token is valid and returns the Guest document.
 */
export async function verifyGuestToken(token: string): Promise<IGuest> {
    try {
        const decoded = jwt.verify(token, GUEST_JWT_SECRET) as { id: string; role: string };
        if (decoded.role !== 'Guest') {
            throw new AppError('Invalid guest token', 401);
        }

        const guest = await GuestModel.findById(decoded.id);
        if (!guest) {
            throw new AppError('Guest profile not found', 401);
        }

        guest.lastSeenAt = new Date();
        await guest.save();
        return guest;
    } catch (err) {
        throw new AppError('Guest verification failed or token expired', 401);
    }
}

export default {
    requestGuestOtp,
    verifyGuestOtp,
    refreshGuestSession,
    revokeGuestSessions,
    getOrCreateGuest,
    verifyGuestToken,
};
