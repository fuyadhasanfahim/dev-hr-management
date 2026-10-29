'use client';

import { useState } from 'react';
import { Loader2, Mail, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useConvertToTicketMutation, type WebInboxChat } from '@/store/api/chatApi';

const CATEGORIES = [
    ['support', 'Support'],
    ['service', 'Service'],
    ['billing', 'Billing'],
    ['bug', 'Bug report'],
] as const;

/**
 * Opens a ticket from a website chat. The visitor is emailed the ticket number with a private link, and the same link
 * appears in their chat as a ticket card; the chat itself stays open.
 */
export function OpenTicketDialog({ chat, open, onOpenChange }: { chat: WebInboxChat | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState<string>('support');
    const [note, setNote] = useState('');
    const [openTicket, { isLoading }] = useConvertToTicketMutation();

    // A fresh form each time the dialog opens for a chat.
    const [seen, setSeen] = useState<{ open: boolean; id?: string }>({ open: false });
    if (seen.open !== open || seen.id !== chat?.sessionId) {
        setSeen({ open, id: chat?.sessionId });
        if (open) {
            setSubject('');
            setCategory('support');
            setNote('');
        }
    }

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chat) return;
        try {
            const { ticketId } = await openTicket({ sessionId: chat.sessionId, subject, category, reason: note }).unwrap();
            toast.success(`Ticket ${ticketId} opened`, {
                description: chat.visitor.email ? `We emailed ${chat.visitor.email} their private link and posted it in the chat.` : 'Its link was posted in the chat.',
            });
            onOpenChange(false);
        } catch (err) {
            toast.error('Couldn’t open the ticket', { description: (err as { data?: { message?: string } }).data?.message });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Ticket className="size-4" /> Open a ticket
                    </DialogTitle>
                    <DialogDescription>
                        For {chat?.visitor.name}. The chat stays open; the whole conversation is saved on the ticket.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="ot-subject">Subject</Label>
                        <Input id="ot-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Leave empty to use their first message" maxLength={300} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ot-note">Internal note (optional)</Label>
                        <Textarea id="ot-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this needs a ticket" rows={2} maxLength={1000} />
                    </div>
                    <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                        <Mail className="mt-0.5 size-3.5 shrink-0" />
                        {chat?.visitor.email
                            ? `${chat.visitor.email} gets the ticket number and a private link to follow it and reply.`
                            : 'This visitor left no email, so the link is only posted in the chat.'}
                    </p>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="gap-2">
                            {isLoading && <Loader2 className="size-4 animate-spin" />}
                            Open ticket
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
