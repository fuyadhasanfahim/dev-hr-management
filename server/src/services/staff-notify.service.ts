import { Types } from 'mongoose';
import StaffModel from '../models/staff.model.js';
import UserModel from '../models/user.model.js';
import envConfig from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import { notify } from './notify.service.js';

// Staff-facing alerts (attendance, leave, shifts) on SMS + WhatsApp + email, built on the in-app notifications:
// whatever HR shows in the bell is also sent to the person's own phone and inbox.

const stripEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();

/**
 * Sends one in-app notification to the user's phone/inbox as well. Never throws — a user with no phone, a
 * gateway error or a missing credential just means that channel is skipped.
 */
export async function notifyStaffUser(
    userId: Types.ObjectId | string,
    alert: { title: string; message: string; event: string; actionUrl?: string; actionLabel?: string },
): Promise<void> {
    try {
        const id = String(userId);
        if (!Types.ObjectId.isValid(id)) return;
        const oid = new Types.ObjectId(id);
        const [staff, user] = await Promise.all([
            StaffModel.findOne({ userId: oid }).select('phone').lean(),
            UserModel.findOne({ _id: oid } as any),
        ]);
        const name = (user as any)?.name ?? 'there';
        const title = stripEmoji(alert.title);
        const text = `${title}: ${stripEmoji(alert.message)} - WebBriks HR`;
        const dashboard = envConfig.dashboard_url.replace(/\/+$/, '');
        await notify(
            { name, phone: (staff as any)?.phone, email: (user as any)?.email },
            {
                event: alert.event,
                subject: title,
                text,
                emailFrom: 'HR Management | WebBriks',
                // Free text is allowed inside the 24h window; outside it, an approved template is needed.
                ...(envConfig.wa_template_staff_alert ? { whatsappTemplate: { name: envConfig.wa_template_staff_alert, params: [name, `${title}. ${stripEmoji(alert.message)}`] } } : {}),
                ...(alert.actionUrl ? { actionUrl: `${dashboard}${alert.actionUrl}`, actionLabel: alert.actionLabel || 'Open' } : {}),
            },
        );
    } catch (e) {
        logger.error({ event: alert.event, err: e instanceof Error ? e.message : String(e) }, 'notify.staff_failed');
    }
}
