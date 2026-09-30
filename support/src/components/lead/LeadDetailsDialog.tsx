'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
    Activity,
    ArrowRight,
    ArrowRightCircle,
    Bot,
    Calendar,
    Clock,
    Globe,
    Loader,
    Mail,
    MessageSquarePlus,
    Pencil,
    Phone,
    User,
    UserCheck,
} from 'lucide-react';
import { useConvertLeadToClientMutation, useGetLeadByIdQuery } from '@/redux/features/lead/leadApi';
import { LogActivityDialog } from '@/components/lead/LogActivityDialog';
import { useGetLeadSettingsQuery } from '@/redux/features/lead/leadSettingApi';
import { usePermissions } from '@/hooks/use-permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

/* eslint-disable @typescript-eslint/no-explicit-any -- lead payloads are untyped in the shared lead API */

interface Person {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
}

// createdBy/updatedBy null = the system did it (e.g. a new WhatsApp contact).
function personName(p: Person | null | undefined): string {
    if (!p) return 'Automated';
    return p.name || [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'Unknown user';
}

const FIELD_LABELS: Record<string, string> = {
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    website: 'Website',
    source: 'Source',
    priority: 'Priority',
    nextActionType: 'Next action',
    nextActionDate: 'Next action date',
    assignedTo: 'Assigned to',
};

const ACTIVITY_LABELS: Record<string, string> = {
    CREATED: 'Lead created',
    UPDATED: 'Details updated',
    STATUS_CHANGE: 'Status changed',
    NOTE_ADDED: 'Note added',
    FOLLOW_UP_SET: 'Follow-up scheduled',
    CONVERTED: 'Converted to client',
};

function StatusBadge({ status }: { status?: { name: string; color?: string } | null }) {
    if (!status) return <Badge variant="secondary">No status</Badge>;
    return (
        <Badge
            variant="outline"
            style={{
                backgroundColor: status.color ? `${status.color}20` : undefined,
                color: status.color || undefined,
                borderColor: status.color ? `${status.color}50` : undefined,
            }}
        >
            {status.name}
        </Badge>
    );
}

function Field({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="truncate text-sm font-medium">{children}</div>
            </div>
        </div>
    );
}

/** Everything about a lead in one dialog: details, audit trail, history, actions. */
export function LeadDetailsDialog({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
    const router = useRouter();
    const { can } = usePermissions();
    const { data: leadData, isLoading, isFetching } = useGetLeadByIdQuery(leadId!, { skip: !leadId });
    const { data: settingsData } = useGetLeadSettingsQuery(undefined);
    const [convertLead, { isLoading: isConverting }] = useConvertLeadToClientMutation();

    const settingName = (id?: string | null) => settingsData?.data?.find((s: any) => s._id === id)?.name;

    const lead = leadData?.data?.lead;
    const activities: any[] = leadData?.data?.activities || [];

    const [isActivityOpen, setIsActivityOpen] = useState(false);
    const [isConvertOpen, setIsConvertOpen] = useState(false);
    const [clientId, setClientId] = useState('');

    const handleConvert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lead || !clientId) return;
        try {
            await convertLead({
                id: lead._id,
                clientData: {
                    clientId,
                    name: lead.name || 'Unknown',
                    emails: lead.email ? [lead.email] : ['temp@temp.com'],
                    phone: lead.phone,
                    status: 'active',
                },
            }).unwrap();
            toast.success('Lead converted to client');
            setIsConvertOpen(false);
            onClose();
            router.push('/clients');
        } catch (error: any) {
            toast.error(error?.data?.message || 'Couldn’t convert the lead');
        }
    };

    return (
        <>
            <Dialog open={!!leadId} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
                    {isLoading || !lead ? (
                        <div className="space-y-4 p-6">
                            <DialogTitle className="sr-only">Lead details</DialogTitle>
                            <DialogDescription className="sr-only">Loading lead</DialogDescription>
                            {isLoading ? (
                                <>
                                    <Skeleton className="h-8 w-60" />
                                    <Skeleton className="h-40 w-full" />
                                </>
                            ) : (
                                <p className="py-10 text-center text-muted-foreground">Lead not found.</p>
                            )}
                        </div>
                    ) : (
                        <>
                            <DialogHeader className="border-b px-6 py-4 text-left">
                                <div className="flex flex-wrap items-center gap-2 pr-8">
                                    <DialogTitle className="text-xl">{lead.name || lead.phone}</DialogTitle>
                                    <StatusBadge status={lead.status} />
                                    {lead.isConverted && <Badge className="border-amber-200 bg-amber-100 text-amber-700">Converted</Badge>}
                                    {lead.origin === 'whatsapp' && (
                                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                            WhatsApp
                                        </Badge>
                                    )}
                                    {isFetching && <Loader className="size-4 animate-spin text-muted-foreground" />}
                                </div>
                                <DialogDescription>Added {format(new Date(lead.createdAt), 'MMM dd, yyyy')}</DialogDescription>
                                <div className="flex gap-2 pt-2">
                                    {can('lead.update') && (
                                        <Button size="sm" variant="outline" onClick={() => setIsActivityOpen(true)}>
                                            <MessageSquarePlus className="size-4" /> Log activity
                                        </Button>
                                    )}
                                    {!lead.isConverted && can('lead.convert') && (
                                        <Button size="sm" onClick={() => setIsConvertOpen(true)}>
                                            <ArrowRightCircle className="size-4" /> Convert to client
                                        </Button>
                                    )}
                                </div>
                            </DialogHeader>

                            <div className="grid min-h-0 flex-1 md:grid-cols-[280px_1fr]">
                                <ScrollArea className="min-h-0 border-b md:border-r md:border-b-0 [&>[data-slot=scroll-area-viewport]]:max-h-[calc(90vh-9.5rem)]">
                                    <div className="space-y-5 p-5">
                                        <section className="space-y-3">
                                            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contact</h3>
                                            <Field icon={Phone} label="Phone">
                                                {lead.phone}
                                            </Field>
                                            {lead.email && (
                                                <Field icon={Mail} label="Email">
                                                    {lead.email}
                                                </Field>
                                            )}
                                            {lead.website && (
                                                <Field icon={Globe} label="Website">
                                                    <a
                                                        href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-primary hover:underline"
                                                    >
                                                        {lead.website}
                                                    </a>
                                                </Field>
                                            )}
                                        </section>
                                        <Separator />
                                        <section className="space-y-3">
                                            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Lead</h3>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Priority</p>
                                                    <Badge variant="secondary">{lead.priority || 'Medium'}</Badge>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Source</p>
                                                    <p className="font-medium">{lead.source?.name || '—'}</p>
                                                </div>
                                            </div>
                                            {lead.nextActionDate && (
                                                <Field icon={Calendar} label="Next action">
                                                    {lead.nextActionType?.name} · {format(new Date(lead.nextActionDate), 'MMM dd, yyyy')}
                                                </Field>
                                            )}
                                            {lead.currentNotes && (
                                                <div>
                                                    <p className="mb-1 text-xs text-muted-foreground">Latest note</p>
                                                    <p className="rounded-lg border bg-muted/50 p-2.5 text-sm whitespace-pre-wrap break-words">{lead.currentNotes}</p>
                                                </div>
                                            )}
                                        </section>
                                        <Separator />
                                        <section className="space-y-3">
                                            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Record</h3>
                                            <Field icon={lead.createdBy ? User : Bot} label="Created by">
                                                {personName(lead.createdBy)}
                                                <span className="font-normal text-muted-foreground">
                                                    {' '}
                                                    · {format(new Date(lead.createdAt), 'MMM dd, yyyy')}
                                                </span>
                                            </Field>
                                            <Field icon={Pencil} label="Last updated by">
                                                {lead.updatedBy ? personName(lead.updatedBy) : lead.createdBy ? personName(lead.createdBy) : 'Automated'}
                                                <span className="font-normal text-muted-foreground">
                                                    {' '}
                                                    · {formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}
                                                </span>
                                            </Field>
                                        </section>
                                    </div>
                                </ScrollArea>

                                <ScrollArea className="min-h-0 [&>[data-slot=scroll-area-viewport]]:max-h-[calc(90vh-9.5rem)]">
                                    <div className="p-5">
                                        <h3 className="mb-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                            History · {activities.length}
                                        </h3>
                                        {activities.length === 0 ? (
                                            <p className="py-10 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
                                        ) : (
                                            <ol className="relative space-y-4 border-l pl-6">
                                                {activities.map((act) => (
                                                    <li key={act._id} className="relative">
                                                        <span className="absolute top-0.5 -left-[34px] flex size-5 items-center justify-center rounded-full border-2 border-background bg-muted">
                                                            {act.activityType === 'CREATED' ? (
                                                                <User className="size-3 text-primary" />
                                                            ) : act.activityType === 'CONVERTED' ? (
                                                                <UserCheck className="size-3 text-amber-600" />
                                                            ) : act.activityType === 'STATUS_CHANGE' ? (
                                                                <Activity className="size-3 text-blue-600" />
                                                            ) : act.activityType === 'UPDATED' ? (
                                                                <Pencil className="size-3 text-muted-foreground" />
                                                            ) : (
                                                                <MessageSquarePlus className="size-3 text-muted-foreground" />
                                                            )}
                                                        </span>
                                                        <div className="rounded-xl border bg-card p-3.5 shadow-sm">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <span className="text-sm font-semibold">
                                                                    {ACTIVITY_LABELS[act.activityType] ?? act.activityType}
                                                                </span>
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <Clock className="size-3" />
                                                                    {format(new Date(act.createdAt), 'MMM dd, yyyy · hh:mm a')}
                                                                </span>
                                                            </div>

                                                            {(act.previousStatus || act.newStatus) && (
                                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                    Status
                                                                    {act.previousStatus && <StatusBadge status={act.previousStatus} />}
                                                                    {act.previousStatus && <ArrowRight className="size-3" />}
                                                                    <StatusBadge status={act.newStatus} />
                                                                </div>
                                                            )}

                                                            {act.changes?.length > 0 && (
                                                                <ul className="mt-2 space-y-1 text-xs">
                                                                    {act.changes.map((c: any) => {
                                                                        const show = (v?: string | null) =>
                                                                            !v
                                                                                ? '—'
                                                                                : c.field === 'source' || c.field === 'nextActionType'
                                                                                  ? (settingName(v) ?? v)
                                                                                  : c.field === 'nextActionDate'
                                                                                    ? format(new Date(v), 'MMM dd, yyyy')
                                                                                    : v;
                                                                        return (
                                                                            <li key={c.field} className="flex flex-wrap items-center gap-1.5">
                                                                                <span className="text-muted-foreground">{FIELD_LABELS[c.field] ?? c.field}:</span>
                                                                                <span className="line-through opacity-60">{show(c.from)}</span>
                                                                                <ArrowRight className="size-3 text-muted-foreground" />
                                                                                <span className="font-medium">{show(c.to)}</span>
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            )}

                                                            {act.previousNotes && act.notes && act.previousNotes !== act.notes && (
                                                                <div className="mt-2">
                                                                    <p className="mb-1 text-[11px] text-muted-foreground">Previous note</p>
                                                                    <p className="rounded-lg border border-dashed p-2 text-xs whitespace-pre-wrap break-words text-muted-foreground">
                                                                        {act.previousNotes}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {act.notes && (
                                                                <p className="mt-2 rounded-lg border bg-muted/50 p-2.5 text-sm whitespace-pre-wrap break-words">{act.notes}</p>
                                                            )}

                                                            {act.nextActionType && act.nextActionDate && (
                                                                <p className="mt-2 inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                                                                    <Calendar className="size-3" />
                                                                    {act.nextActionType.name} on {format(new Date(act.nextActionDate), 'MMM dd, yyyy')}
                                                                </p>
                                                            )}

                                                            <p className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                                                                {act.createdBy ? <User className="size-3" /> : <Bot className="size-3" />}
                                                                {personName(act.createdBy)}
                                                            </p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <LogActivityDialog lead={isActivityOpen ? lead : null} onClose={() => setIsActivityOpen(false)} />

            {/* Convert to client */}
            <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Convert to client</DialogTitle>
                        <DialogDescription>Assign a unique Client ID to turn this lead into a client profile.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleConvert} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Client ID</Label>
                            <Input required value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="e.g. CLT-1001" />
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsConvertOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isConverting}>
                                {isConverting && <Loader className="size-4 animate-spin" />}
                                Convert lead
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
