import { useState } from 'react';
import { useConvertLeadToClientMutation } from '@/redux/features/lead/leadApi';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit, UserPlus, Loader, Phone, Calendar, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Lead } from '@/types/lead.type';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/use-permissions';

interface LeadTableProps {
    leads: Lead[];
    isLoading: boolean;
    onEdit: (lead: Lead) => void;
    onView: (lead: Lead) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
    High: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50',
    Low: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
};

export function LeadTable({
    leads,
    isLoading,
    onEdit,
    onView,
}: LeadTableProps) {
    const { can } = usePermissions();
    const canEdit = can('lead.update');
    const canConvert = can('lead.convert');
    const [convertLead] = useConvertLeadToClientMutation();
    const [activeConvertingId, setActiveConvertingId] = useState<string | null>(
        null,
    );

    const handleConvert = async (lead: Lead) => {
        if (
            !confirm(
                `Are you sure you want to convert "${lead.name || 'this lead'}" to a client?`,
            )
        )
            return;
        try {
            setActiveConvertingId(lead._id);
            const clientData = {
                name: lead.name || 'Unknown',
                emails: lead.email ? [lead.email] : ['temp@temp.com'],
                phone: lead.phone,
                status: 'active',
            };
            await convertLead({ id: lead._id, clientData }).unwrap();
            toast.success('Lead converted to Client successfully!');
        } catch (error: any) {
            toast.error(error?.data?.message || 'Failed to convert lead');
        } finally {
            setActiveConvertingId(null);
        }
    };

    return (
        <Table>
                <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent bg-muted/40">
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pl-6">
                            Name
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Email
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Phone
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Status
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Priority
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Source
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Next Action
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-6">
                            Actions
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 6 }).map((_, index) => (
                            <TableRow
                                key={index}
                                className="border-b border-border/60"
                            >
                                <TableCell className="pl-6"><Skeleton className="h-3.5 w-[110px]" /></TableCell>
                                <TableCell><Skeleton className="h-3.5 w-[140px]" /></TableCell>
                                <TableCell><Skeleton className="h-3.5 w-[100px]" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-[70px] rounded-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-[60px] rounded-full" /></TableCell>
                                <TableCell><Skeleton className="h-3.5 w-[80px]" /></TableCell>
                                <TableCell><Skeleton className="h-3.5 w-[100px]" /></TableCell>
                                <TableCell className="pr-6">
                                    <div className="flex justify-end gap-1">
                                        <Skeleton className="h-7 w-7 rounded-md" />
                                        <Skeleton className="h-7 w-7 rounded-md" />
                                        <Skeleton className="h-7 w-7 rounded-md" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : leads.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={8}
                                className="h-40 text-center"
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                                        <Users className="h-5 w-5 text-brand-primary" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        No leads found matching your criteria.
                                    </p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        leads.map((lead) => (
                            <TableRow
                                key={lead._id}
                                className="cursor-pointer"
                                onClick={() => onView(lead)}
                            >
                                {/* Name */}
                                <TableCell className="pl-6">
                                    <p className="text-sm font-medium text-foreground truncate max-w-[160px]">
                                        {lead.name || 'Unnamed Lead'}
                                    </p>
                                </TableCell>

                                {/* Email */}
                                <TableCell>
                                    {lead.email ? (
                                        <span className="text-sm text-foreground/80 truncate">
                                            {lead.email}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>

                                {/* Phone */}
                                <TableCell>
                                    {lead.phone ? (
                                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                            {lead.phone}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>

                                {/* Status */}
                                <TableCell>
                                    {lead.status ? (
                                        <Badge
                                            variant="outline"
                                            style={{
                                                backgroundColor: lead.status.color
                                                    ? `${lead.status.color}15`
                                                    : undefined,
                                                color: lead.status.color || undefined,
                                                borderColor: lead.status.color
                                                    ? `${lead.status.color}40`
                                                    : undefined,
                                            }}
                                            className="px-2 py-0.5 text-xs font-medium rounded-md"
                                        >
                                            {lead.status.name}
                                        </Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>

                                {/* Priority */}
                                <TableCell>
                                    <Badge
                                        variant="outline"
                                        className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                                            PRIORITY_STYLES[lead.priority || 'Medium'] || PRIORITY_STYLES.Medium
                                        }`}
                                    >
                                        {lead.priority || 'Medium'}
                                    </Badge>
                                </TableCell>

                                {/* Source */}
                                <TableCell>
                                    {lead.source ? (
                                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
                                            {lead.source.color && (
                                                <span
                                                    className="h-2 w-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: lead.source.color }}
                                                />
                                            )}
                                            {lead.source.name}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>

                                {/* Next Action */}
                                <TableCell>
                                    {lead.nextActionDate ? (
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-foreground/80 truncate">
                                                    {lead.nextActionType?.name || 'Follow-up'}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {format(new Date(lead.nextActionDate), 'MMM dd')}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>

                                {/* Actions */}
                                <TableCell className="pr-6" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            title="View"
                                            onClick={() => onView(lead)}
                                            className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary/10"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                        {canEdit && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Edit"
                                                onClick={() => onEdit(lead)}
                                                className="h-7 w-7 text-muted-foreground hover:text-brand-accent hover:bg-brand-accent/10"
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                        {canConvert && !lead.isConverted && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Convert to Client"
                                                onClick={() => handleConvert(lead)}
                                                disabled={activeConvertingId === lead._id}
                                                className="h-7 w-7 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                            >
                                                {activeConvertingId === lead._id ? (
                                                    <Loader className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <UserPlus className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
    );
}
