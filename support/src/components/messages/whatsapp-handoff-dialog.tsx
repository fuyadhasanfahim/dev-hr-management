'use client';

import { useRouter } from 'next/navigation';
import { Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useHandOffToWhatsAppMutation, type WebInboxChat } from '@/store/api/chatApi';

/** Moves a website chat to WhatsApp after the agent confirms what the visitor will receive. */
export function WhatsAppHandoffDialog({ chat, open, onOpenChange }: { chat: WebInboxChat | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const router = useRouter();
    const [handOff, { isLoading }] = useHandOffToWhatsAppMutation();

    const confirm = async () => {
        if (!chat) return;
        try {
            const { conversationId } = await handOff(chat.sessionId).unwrap();
            toast.success('Moved to WhatsApp', { description: 'The visitor was messaged on WhatsApp.' });
            onOpenChange(false);
            router.push(`/messages/${conversationId}`);
        } catch (err) {
            toast.error('Couldn’t move the chat to WhatsApp', { description: (err as { data?: { message?: string } }).data?.message });
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <MessageCircle className="size-4 text-emerald-600" />
                        Continue on WhatsApp?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {chat?.visitor.name} gets a WhatsApp message on {chat?.visitor.phone} saying we’ll continue there. Replies on this website chat are turned off,
                        and everything carries on in the WhatsApp chat, assigned to you.
                        {chat?.visitor.isWhatsapp === false && ' They said this number is not on WhatsApp, so the message may not arrive.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button disabled={isLoading} onClick={() => void confirm()}>
                        {isLoading && <Loader2 className="size-4 animate-spin" />}
                        Send on WhatsApp
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
