// The last look before an AI reply is sent. Generating a reply takes seconds, and in that time a teammate may have
// answered, the AI may have been switched off, or the customer may have written again.
export type SendAction = 'send' | 'skip' | 'redo';

export interface SendCheck {
    botActive: boolean; // chat still with the bot (not escalated / closed) and AI switched on for it
    aiActive: boolean; // admin AI switch (off / schedule) for WhatsApp
    humanRepliedAt?: Date | null; // newest teammate message in the chat
    newestCustomerAt?: Date | null; // newest customer message in the chat
    answeredUpTo: Date; // last customer message this draft answers
    redos: number; // how many drafts of this chat were already thrown away for newer messages
}

// A customer who keeps typing must still get an answer, so a draft is only discarded this many times.
export const MAX_REDOS = 2;

export function decideSend(c: SendCheck): { action: SendAction; why: string } {
    if (!c.botActive) return { action: 'skip', why: 'AI was switched off or the chat was handed over while the reply was being written' };
    if (!c.aiActive) return { action: 'skip', why: 'the WhatsApp AI was switched off while the reply was being written' };
    if (c.humanRepliedAt && c.humanRepliedAt.getTime() > c.answeredUpTo.getTime()) return { action: 'skip', why: 'a teammate already replied' };
    if (c.newestCustomerAt && c.newestCustomerAt.getTime() > c.answeredUpTo.getTime() && c.redos < MAX_REDOS)
        return { action: 'redo', why: 'the customer wrote again, so one combined reply is better than two' };
    return { action: 'send', why: 'ok' };
}
