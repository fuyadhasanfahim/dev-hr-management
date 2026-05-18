import GuestModel, { type IGuest } from '../models/guest.model.js';
import emailService from './email.service.js';
import jwt from 'jsonwebtoken';
import envConfig from '../config/env.config.js';
import { AppError } from '../utils/AppError.js';

const GUEST_JWT_SECRET = envConfig.better_auth_secret;

/**
 * Generates a 6-digit OTP code.
 */
function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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
export async function verifyGuestOtp(email: string, otp: string): Promise<{ token: string; guest: IGuest }> {
    if (!email || !otp) {
        throw new AppError('Email and OTP are required', 400);
    }

    const guest = await GuestModel.findOne({ email: email.toLowerCase() });
    if (!guest) {
        throw new AppError('Guest profile not found', 404);
    }

    if (!guest.otp || guest.otp !== otp) {
        throw new AppError('Invalid OTP', 400);
    }

    if (guest.otpExpiresAt && guest.otpExpiresAt < new Date()) {
        throw new AppError('OTP has expired', 400);
    }

    guest.emailVerified = true;
    (guest as any).otp = undefined;
    (guest as any).otpExpiresAt = undefined;
    guest.lastSeenAt = new Date();
    await guest.save();

    const token = jwt.sign(
        {
            id: guest._id.toString(),
            email: guest.email,
            name: guest.name,
            role: 'Guest',
        },
        GUEST_JWT_SECRET,
        {
            expiresIn: '7d',
        }
    );

    return {
        token,
        guest,
    };
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
    verifyGuestToken,
};
