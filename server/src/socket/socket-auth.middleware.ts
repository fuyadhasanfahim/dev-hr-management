import { Socket } from 'socket.io';
import { auth } from '../lib/auth.js';
import jwt from 'jsonwebtoken';
import envConfig from '../config/env.config.js';
import GuestModel from '../models/guest.model.js';

export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (token && !socket.handshake.headers.cookie?.includes('better-auth.session_token')) {
            const sessionCookie = `better-auth.session_token=${token}`;
            socket.handshake.headers.cookie = socket.handshake.headers.cookie
                ? `${socket.handshake.headers.cookie}; ${sessionCookie}`
                : sessionCookie;
        }

        const session = await auth.api.getSession({
            headers: socket.handshake.headers,
        });

        if (session && session.user) {
            socket.data.user = {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                role: session.user.role || 'staff',
            };
            return next();
        }

        if (token) {
            try {
                const decoded = jwt.verify(token, envConfig.better_auth_secret) as {
                    id: string;
                    email: string;
                    name: string;
                    role: string;
                };

                if (decoded.role === 'Guest') {
                    const guest = await GuestModel.findById(decoded.id);
                    if (guest) {
                        socket.data.user = {
                            id: guest._id.toString(),
                            name: guest.name,
                            email: guest.email,
                            role: 'Guest',
                        };
                        return next();
                    }
                }
            } catch (err) {
                // Ignore and reject
            }
        }

        return next(new Error('Authentication failed: Unauthorized connection.'));
    } catch (error: any) {
        console.error('[Socket Auth Error]:', error.message);
        return next(new Error('Internal server error during socket authentication.'));
    }
}
