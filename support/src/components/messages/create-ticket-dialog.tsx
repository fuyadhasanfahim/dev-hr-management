'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateWhatsAppTicketMutation } from '@/store/api/whatsappApi';

const CATEGORIES = ['support', 'service', 'development', 'billing', 'bug'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/** Raises a support ticket from a WhatsApp chat. The chat's transcript is attached to the ticket by the server. */
export function CreateTicketDialog({
    conversationId,
    customerName,
    open,
    onOpenChange,
}: {
    conversationId: string;
    customerName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [create, { isLoading }] = useCreateWhatsAppTicketMutation();
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState('support');
    const [priority, setPriority] = useState('medium');
    const [note, setNote] = useState('');

    const submit = async () => {
        try {
            const ticket = await create({ conversationId, subject: subject.trim() || undefined, category, priority, note: note.trim() || undefined }).unwrap();
            toast.success(ticket.existing ? `${ticket.ticketId} is already open for this chat` : `Ticket ${ticket.ticketId} created`, {
                action: { label: 'Open', onClick: () => window.location.assign(`/tickets?ticket=${ticket.id}`) },
            });
            setSubject('');
            setNote('');
            onOpenChange(false);
        } catch (err) {
            toast.error('Couldn’t create the ticket', { description: (err as { data?: { message?: string } }).data?.message });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Ticket className="size-4" />
                        Create ticket
                    </DialogTitle>
                    <DialogDescription>
                        Raises a ticket for {customerName} with this chat attached. You can manage it from <Link href="/tickets" className="underline">Tickets</Link>.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="ticket-subject">Subject</Label>
                        <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`WhatsApp: ${customerName}`} maxLength={120} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((c) => (
                                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Priority</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PRIORITIES.map((p) => (
                                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ticket-note">Note for the team (optional)</Label>
                        <Textarea id="ticket-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs to happen next?" maxLength={2000} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => void submit()} disabled={isLoading}>
                        {isLoading && <Loader2 className="size-4 animate-spin" />}
                        Create ticket
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
