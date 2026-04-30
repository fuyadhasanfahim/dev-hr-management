import ClientModel from '../models/client.model.js';
import { sendBulkSMS } from '../utils/sms.util.js';

/**
 * Centralised helper to send an SMS to a client only if they use BDT currency.
 * Returns whether the SMS was actually sent.
 */
export async function sendClientSmsIfBDT(
    clientId: string,
    message: string,
): Promise<{ sent: boolean; reason?: string }> {
    try {
        const client = await ClientModel.findById(clientId).select('currency phone name').lean();

        if (!client) {
            return { sent: false, reason: 'Client not found' };
        }

        if (client.currency?.toUpperCase() !== 'BDT') {
            return { sent: false, reason: 'Client currency is not BDT' };
        }

        if (!client.phone || client.phone.trim().length < 10) {
            return { sent: false, reason: 'Client has no valid phone number' };
        }

        const result = await sendBulkSMS({ number: client.phone, message });
        console.log('[SMS-BDT] Sent to', client.phone, 'response:', JSON.stringify(result));
        return { sent: true };
    } catch (error: any) {
        console.error('[SMS-BDT] Failed:', error.message);
        return { sent: false, reason: error.message };
    }
}

export default { sendClientSmsIfBDT };
