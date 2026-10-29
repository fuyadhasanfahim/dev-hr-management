'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Globe, Mail, MessageCircle, Phone, Ticket, UserRound, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CustomerAvatar } from '@/components/messages/customer-avatar';
import { cn } from '@/lib/utils';
import { useGetChatVisitorTicketsQuery, type WebInboxChat } from '@/store/api/chatApi';

function Row({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="text-sm break-words">{children}</div>
            </div>
        </div>
    );
}

const STATUS_LABEL: Record<WebInboxChat['status'], string> = {
    queued: 'Waiting',
    active: 'Active',
    ended: 'Ended',
    converted_to_ticket: 'Open',
};

/** Contact info for a website chat, laid out like the WhatsApp one. */
export function WebChatInfoPanel({
    chat,
    onClose,
    fullScreen = false,
    onOpenTicket,
}: {
    chat: WebInboxChat;
    onClose: () => void;
    fullScreen?: boolean;
    onOpenTicket: () => void;
}) {
    const v = chat.visitor;
    const { data: tickets = [] } = useGetChatVisitorTicketsQuery(chat.sessionId);
    const canOpenTicket = chat.status !== 'ended' && chat.status !== 'converted_to_ticket';
    return (
        <motion.aside
            initial={fullScreen ? { x: '100%' } : { width: 0, opacity: 0 }}
            animate={fullScreen ? { x: 0 } : { width: 340, opacity: 1 }}
            exit={fullScreen ? { x: '100%' } : { width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className={cn('overflow-hidden border-l bg-sidebar', fullScreen ? 'fixed inset-0 z-40 border-l-0' : 'shrink-0')}
            aria-label="Conversation info"
        >
            <div className={cn('flex h-full flex-col', fullScreen ? 'w-full' : 'w-[340px]')}>
                <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
                    <p className="text-sm font-semibold">Contact info</p>
                    <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close contact info">
                        <X className="size-4" />
                    </Button>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                    <div className="flex flex-col items-center gap-2 px-4 pt-6 pb-4 text-center">
                        <CustomerAvatar name={v.name} seed={v.email ?? chat.sessionId} className="size-20 text-2xl" />
                        <div>
                            <p className="text-base font-semibold">{v.name}</p>
                            <p className="text-sm text-muted-foreground">Website chat</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-1.5">
                            <Badge variant="secondary">
                                <Globe className="size-3" /> {STATUS_LABEL[chat.status]}
                            </Badge>
                            {chat.assignedAgent && (
                                <Badge variant="outline">
                                    <UserRound className="size-3" /> {chat.assignedAgent.name}
                                </Badge>
                            )}
                            {v.isClient && <Badge variant="outline">Client</Badge>}
                        </div>
                    </div>
                    <Separator />
                    <div className="px-4 py-2">
                        {v.email && (
                            <Row icon={Mail} label="Email">
                                {v.email}
                            </Row>
                        )}
                        {v.phone && (
                            <Row icon={Phone} label={v.isWhatsapp ? 'Phone · on WhatsApp' : 'Phone'}>
                                {v.phone}
                            </Row>
                        )}
                    </div>
                    {canOpenTicket || chat.whatsappConversationId ? (
                        <>
                            <Separator />
                    <div className="space-y-2 px-4 py-4">
                        {chat.whatsappConversationId ? (
                            <Button asChild variant="outline" className="w-full gap-2">
                                <Link href={`/messages/${chat.whatsappConversationId}`}>
                                    <MessageCircle className="size-4 text-emerald-600" />
                                    Open the WhatsApp chat
                                </Link>
                            </Button>
                        ) : (
                            canOpenTicket && (
                                <Button className="w-full gap-2" onClick={onOpenTicket}>
                                    <Ticket className="size-4" />
                                    Open a ticket
                                </Button>
                            )
                        )}
                    </div>
                        </>
                    ) : null}
                    <Separator />
                    <div className="px-4 py-4">
                        <p className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                            Tickets
                            <span className="tabular-nums">{tickets.length}</span>
                        </p>
                        {tickets.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No tickets for this visitor yet.</p>
                        ) : (
                            <ul className="space-y-1.5">
                                {tickets.map((t) => (
                                    <li key={t.id}>
                                        <Link href={`/tickets?ticket=${t.id}`} className="block rounded-lg border px-3 py-2 transition-colors hover:bg-sidebar-accent">
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="font-mono text-xs font-medium">{t.ticketId}</span>
                                                <span className="text-[11px] capitalize text-muted-foreground">{t.status.replace('_', ' ')}</span>
                                            </span>
                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{t.subject}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </motion.aside>
    );
}
