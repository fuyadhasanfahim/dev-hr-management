'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    useGetQuotationByIdQuery,
    useSendQuotationMutation,
    useCreateNewVersionMutation,
    useDeleteQuotationMutation,
} from '@/redux/features/quotation/quotationApi';
import { useConvertQuotationToOrderMutation } from '@/redux/features/order/orderApi';
import { QuotationEmailDialog } from '../components/QuotationEmailDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Loader2,
    ArrowLeft,
    FileText,
    Send,
    Edit2,
    Copy,
    AlertCircle,
    Trash2,
    CheckCircle2,
    RefreshCcw,
    Layers,
    Cpu,
    Activity,
    ReceiptText,
    Printer,
    Briefcase,
    TrendingUp,
    Video,
    Camera,
    Check,
    Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import QuotationPuppeteerPdfBtn, {
    quotationPdfFileStem,
} from '@/components/quotation/pdf/QuotationPuppeteerPdfBtn';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { IconReceipt } from '@tabler/icons-react';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';
import { Role } from '@/constants/role';
import { cn } from '@/lib/utils';
import { CATEGORY_CONFIG } from '@/constants/quotation-templates';
import { computeQuotationTotals } from '@/lib/quotation-totals';
import type { QuotationCategory } from '@/types/quotation.type';

export default function ViewQuotationPage() {
    const router = useRouter();
    const { id } = useParams();
    const { data: session } = useSession();
    const canSeeFinancials = useMemo(() => {
        const r = session?.user?.role;
        return (
            r === Role.SUPER_ADMIN || r === Role.ADMIN || r === Role.HR_MANAGER
        );
    }, [session]);

    const { data, isLoading, refetch } = useGetQuotationByIdQuery(id as string);

    const [sendQuotation, { isLoading: isSending }] =
        useSendQuotationMutation();
    const [createNewVersion, { isLoading: isVersionCreating }] =
        useCreateNewVersionMutation();
    const [deleteQuotation, { isLoading: isDeleting }] =
        useDeleteQuotationMutation();
    const [convertQuotationToOrder, { isLoading: isConverting }] =
        useConvertQuotationToOrderMutation();

    const [pickerOpen, setPickerOpen] = useState(false);

    const dialogClientId = useMemo(() => {
        if (!data?.clientId) return '';
        if (typeof data.clientId === 'string') return data.clientId;
        const populated = data.clientId as unknown as { _id?: string };
        return populated?._id ?? '';
    }, [data?.clientId]);

    const displayPhases = useMemo(() => {
        if (!data?.services) return [];
        return data.services.map((s) => ({
            title: CATEGORY_CONFIG[s.category as QuotationCategory]?.label || s.category,
            description: s.scopeDescription,
            items: s.scopeItems || [],
        }));
    }, [data?.services]);

    const liveTotals = useMemo(() => computeQuotationTotals(data?.services || []), [data?.services]);

    const openSendPicker = () => {
        if (!dialogClientId) {
            toast.error(
                'This quotation has no linked client — cannot pick recipient emails.',
            );
            return;
        }
        setPickerOpen(true);
    };

    const handleConfirmSend = async (
        selected: string[],
        _includePaymentLink?: boolean,
    ) => {
        if (!id) return [];
        if (selected.length === 0) {
            toast.warning('Please select at least one recipient');
            return [];
        }
        if (isSending) return [];
        try {
            const result = await sendQuotation({
                id: id as string,
                emails: selected,
                includePaymentLink: false,
            }).unwrap();
            if (result.data.clientLink) {
                try {
                    await navigator.clipboard.writeText(result.data.clientLink);
                    toast.success('Client link copied to clipboard!');
                } catch {
                    // Non-fatal: clipboard not always permitted.
                }
            }

            const recipients = result.data.recipients ?? [];
            const failed = recipients.filter((r) => r.status === 'failed');
            const sent = recipients.filter((r) => r.status === 'sent');

            if (sent.length > 0 && failed.length === 0) {
                toast.success(
                    `Quotation sent to ${sent.length} recipient${sent.length === 1 ? '' : 's'}`,
                );
            } else if (sent.length > 0 && failed.length > 0) {
                toast.warning(
                    `Sent to ${sent.length}, failed for ${failed.length}. See dialog for details.`,
                );
            } else if (failed.length > 0) {
                toast.error(
                    result.data.emailError ||
                        `Failed to send to ${failed.length} recipient${failed.length === 1 ? '' : 's'}`,
                );
            } else {
                toast.warning(
                    result.data.emailError ||
                        'Email was not sent. Link was generated only.',
                );
            }
            return recipients;
        } catch (err) {
            toast.error((err as Error).message || 'Failed to send quotation');
            return [];
        }
    };

    const handleConvertToOrder = async () => {
        if (!data?.quotationGroupId) return;
        const tid = toast.loading('Converting quotation to order...');
        try {
            const res = await convertQuotationToOrder({
                quotationGroupId: data.quotationGroupId,
            }).unwrap();
            toast.success('Converted to order successfully!', { id: tid });
            refetch();
            if (res.data?._id) {
                router.push(`/orders/${res.data._id}`);
            }
        } catch (err: any) {
            toast.error(
                err?.data?.message || err?.message || 'Conversion failed',
                { id: tid },
            );
        }
    };

    const handleNewVersion = async () => {
        if (!data?.quotationGroupId) return;
        try {
            const result = await createNewVersion({
                groupId: data.quotationGroupId,
                data: {}, // Empty body copies existing data
            }).unwrap();
            toast.success('New version created successfully');
            router.push(`/quotations/${result.data._id}`);
        } catch (err) {
            toast.error(
                (err as Error).message || 'Failed to create new version',
            );
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this quotation and all associated records?'))
            return;
        try {
            await deleteQuotation(id as string).unwrap();
            toast.success('Quotation deleted');
            router.push('/quotations');
        } catch (err) {
            toast.error((err as Error).message || 'Failed to delete');
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold">Quotation not found</h2>
                <Button asChild className="mt-4">
                    <Link href="/quotations">Back to List</Link>
                </Button>
            </div>
        );
    }

    const statusColors = {
        draft: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800',
        sent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
        viewed: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50',
        accepted:
            'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50',
        rejected:
            'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50',
        superseded:
            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
        expired:
            'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/50',
        change_requested:
            'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50',
    };

    const currency = data.currency || '৳';
    const totals = data.totals ?? {
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
    };
    const grandTotal = totals.grandTotal ?? 0;
    const subtotal = totals.subtotal ?? 0;
    const taxAmount = totals.taxAmount ?? 0;
    // Authoritative — computed once by calculateTotals() on save (category- and
    // quantity-aware). Never re-derive this from basePrice/additionalTotal locally.
    const discountAmount = totals.discountAmount ?? 0;

    // ── Category-aware presentation (mirrors CATEGORY_CONFIG used by the builder) ──
    const proposalLabel = (data.services || [])
        .map((s) => CATEGORY_CONFIG[s.category as QuotationCategory]?.label || s.category)
        .join(' + ') || 'Agency Proposal';
    const webDevService = (data.services || []).find((s) => s.category === 'web-development');
    const showPhases = Boolean(data.services && data.services.length > 0);
    const showTech = Boolean(
        webDevService?.techStack &&
            ((webDevService.techStack.frontend?.length ?? 0) > 0 ||
                (webDevService.techStack.backend?.length ?? 0) > 0 ||
                (webDevService.techStack.database?.length ?? 0) > 0 ||
                (webDevService.techStack.tools?.length ?? 0) > 0),
    );
    const showWorkflow = Boolean(data.workflow && data.workflow.length > 0);

    const getCategoryBadgeStyle = (title: string = '') => {
        const lower = title.toLowerCase();
        if (lower.includes('marketing') || lower.includes('seo')) {
            return {
                bg: 'bg-[#C850FA]/10 dark:bg-[#C850FA]/20',
                text: 'text-[#C850FA]',
                border: 'border-[#C850FA]/30',
                icon: <TrendingUp className="w-5 h-5 stroke-[2.5]" />,
                gradient: 'from-[#C850FA]/5 to-transparent',
            };
        }
        if (lower.includes('video') || lower.includes('motion')) {
            return {
                bg: 'bg-[#1E0078]/10 dark:bg-[#1E0078]/30',
                text: 'text-[#1E0078] dark:text-indigo-300',
                border: 'border-[#1E0078]/30 dark:border-[#1E0078]/50',
                icon: <Video className="w-5 h-5 stroke-[2.5]" />,
                gradient: 'from-[#1E0078]/5 to-transparent',
            };
        }
        if (lower.includes('photo') || lower.includes('retouch')) {
            return {
                bg: 'bg-rose-500/10 dark:bg-rose-500/20',
                text: 'text-rose-500',
                border: 'border-rose-500/30',
                icon: <Camera className="w-5 h-5 stroke-[2.5]" />,
                gradient: 'from-rose-500/5 to-transparent',
            };
        }
        return {
            bg: 'bg-[#4E12D4]/10 dark:bg-[#4E12D4]/20',
            text: 'text-[#4E12D4]',
            border: 'border-[#4E12D4]/30',
            icon: <Layers className="w-5 h-5 stroke-[2.5]" />,
            gradient: 'from-[#4E12D4]/5 to-transparent',
        };
    };


    const money = (amount: number | undefined | null) =>
        `${currency}${(amount ?? 0).toLocaleString()}`;

    return (
        <div className="container mx-auto p-6 space-y-6 animate-in fade-in duration-300">
            {/* Header (Orders-like) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold tracking-tight">
                                {data.details.title}
                            </h1>
                            <Badge
                                variant="outline"
                                className={`${statusColors[data.status || 'draft']} capitalize`}
                            >
                                {data.status?.replace('_', ' ')}
                            </Badge>
                            {!data.isLatestVersion && (
                                <Badge variant="destructive">Outdated</Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground flex items-center gap-2 mt-1">
                            <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                                #{data.quotationNumber || '—'}
                            </span>
                            <span className="text-xs">•</span>
                            <span className="text-sm">
                                Version {data.version}
                            </span>
                            <span className="text-xs">•</span>
                            <span className="text-sm">
                                Created{' '}
                                {data.createdAt
                                    ? format(new Date(data.createdAt), 'PPP')
                                    : 'N/A'}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <QuotationPuppeteerPdfBtn
                        quotationId={id as string}
                        fileNameBase={quotationPdfFileStem(
                            data.quotationNumber,
                            data.details?.title,
                        )}
                    />

                    {data.isLatestVersion &&
                        !['superseded', 'rejected', 'expired'].includes(
                            data.status || '',
                        ) && (
                            <Button
                                onClick={openSendPicker}
                                disabled={isSending}
                            >
                                {isSending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                {data.status === 'draft'
                                    ? 'Send to Client'
                                    : 'Send Again'}
                            </Button>
                        )}

                    {data.isLatestVersion &&
                        !data.orderId &&
                        !['superseded', 'expired'].includes(
                            data.status || '',
                        ) && (
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={isConverting}
                                onClick={handleConvertToOrder}
                            >
                                {isConverting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Briefcase className="h-4 w-4" />
                                )}
                                Convert to Order
                            </Button>
                        )}

                    {data.status === 'accepted' && data.orderId && (
                        <Button asChild variant="outline">
                            <Link href={`/orders/${data.orderId}`}>
                                <CheckCircle2 className="h-4 w-4" />
                                View Order
                            </Link>
                        </Button>
                    )}

                    {data.isLatestVersion && (
                        <Button variant="outline" asChild>
                            <Link href={`/quotations/${id}/edit`}>
                                <Edit2 className="h-4 w-4" />
                                Edit
                            </Link>
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        title="Delete quotation"
                    >
                        {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Version Warning */}
                    {!data.isLatestVersion && (
                        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
                            <CardContent className="p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                        This is an old version
                                    </h4>
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        A newer version of this quotation
                                        exists. Any payment links for this
                                        version are inactive.
                                    </p>
                                    <Button
                                        variant="link"
                                        className="p-0 h-auto text-xs text-amber-900 dark:text-amber-200 font-bold mt-1"
                                        onClick={() =>
                                            router.push(
                                                `/quotations/group/${data.quotationGroupId}/latest`,
                                            )
                                        }
                                    >
                                        Switch to latest version →
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Change Request Info */}
                    {data.status === 'change_requested' && (
                        <Card className="border-purple-200 bg-purple-50/40 dark:border-purple-900/50 dark:bg-purple-950/20">
                            <CardContent className="p-4 flex flex-col gap-3">
                                <div className="flex items-start gap-3">
                                    <RefreshCcw className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-purple-900 dark:text-purple-200">
                                            Client Requested Changes
                                        </h4>
                                        <p className="text-xs text-purple-700 dark:text-purple-300">
                                            The client has requested
                                            modifications. Review their feedback
                                            and issue a new version.
                                        </p>
                                        {data.changeRequestReason && (
                                            <p className="mt-2 text-xs text-purple-800/80 dark:text-purple-300/80">
                                                <span className="font-bold">
                                                    Reason:
                                                </span>{' '}
                                                {data.changeRequestReason}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={handleNewVersion}
                                    disabled={isVersionCreating}
                                >
                                    {isVersionCreating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                    Create New Version to Edit
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Overview */}
                    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 shadow-sm overflow-hidden backdrop-blur-xl">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-slate-500/5 to-transparent flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center shadow-sm">
                                <FileText className="h-5 w-5 stroke-[2.5]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                    Project Overview
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Client details and quotation proposal summary</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#4E12D4]">
                                        Client Contact
                                    </div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white">
                                        {data.client.contactName || 'Valued Client'}
                                    </div>
                                    {data.client.companyName && (
                                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                            {data.client.companyName}
                                        </div>
                                    )}
                                    {(data.client.email || data.client.phone) && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 space-y-0.5 font-medium">
                                            {data.client.email && <div>✉️ {data.client.email}</div>}
                                            {data.client.phone && <div>📞 {data.client.phone}</div>}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#C850FA]">
                                        Proposal Package
                                    </div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white">
                                        {proposalLabel}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium pt-1 space-y-0.5">
                                        <div>📅 Issued: {data.details?.date ? format(new Date(data.details.date), 'PPP') : '—'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                    Executive Summary
                                </div>
                                <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20 p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 font-medium">
                                    {data.overview?.trim() ? data.overview : 'No executive summary provided for this quotation.'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Multi-Service Deliverables Scope */}
                    {showPhases && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pt-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4E12D4] to-[#C850FA] text-white flex items-center justify-center shadow-md shadow-[#4E12D4]/20">
                                <Layers className="h-5 w-5 stroke-[2.5]" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    Deliverables Scope & Features
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Detailed breakdown of included services and project deliverables</p>
                            </div>
                        </div>

                        {displayPhases.length ? (
                            <div className="space-y-5">
                                {displayPhases.map((p, idx) => {
                                    const style = getCategoryBadgeStyle(p.title);
                                    return (
                                        <div
                                            key={`${p.title}-${idx}`}
                                            className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 shadow-sm overflow-hidden backdrop-blur-xl transition-all duration-300 hover:shadow-md"
                                        >
                                            <div className={`p-5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r ${style.gradient} flex items-center justify-between gap-4`}>
                                                <div className="flex items-center gap-3.5">
                                                    <div className={`w-11 h-11 rounded-2xl ${style.bg} ${style.text} flex items-center justify-center border ${style.border} shadow-sm`}>
                                                        {style.icon}
                                                    </div>
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                                                                {p.title || `Service Scope #${idx + 1}`}
                                                            </h4>
                                                        </div>
                                                        {p.description && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className={`rounded-full px-3 py-1 text-xs font-bold ${style.text} ${style.border} ${style.bg}`}>
                                                    {p.items?.length ?? 0} Deliverables
                                                </Badge>
                                            </div>
                                            <div className="p-5">
                                                {p.items?.length ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                                        {p.items.map((it, i) => (
                                                            <div key={`${idx}-${i}`} className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:border-slate-200/80">
                                                                <span className={`w-6 h-6 rounded-xl ${style.bg} ${style.text} font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border ${style.border}`}>
                                                                    {i + 1}
                                                                </span>
                                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug">
                                                                    {it}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-400 italic py-2">
                                                        No deliverables listed for this service scope.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-400 italic">No deliverables defined.</div>
                        )}
                    </div>
                    )}

                    {/* Exclusions: Not Included in This Price */}
                    {data.notIncluded && data.notIncluded.length > 0 && (
                    <div className="rounded-3xl border border-rose-200/80 dark:border-rose-900/40 bg-white/80 dark:bg-slate-900/60 shadow-sm overflow-hidden backdrop-blur-xl transition-all duration-300 hover:shadow-md">
                        <div className="p-5 border-b border-rose-100 dark:border-rose-900/30 bg-gradient-to-r from-rose-500/5 to-transparent flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 shadow-sm">
                                    <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h4 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                                        Not Included in This Price
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Exclusions and out-of-scope items</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-bold text-rose-500 border-rose-500/30 bg-rose-500/10">
                                {data.notIncluded.length} Exclusions
                            </Badge>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {data.notIncluded.map((item: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/80 dark:border-rose-900/30 transition-all duration-200 hover:bg-rose-100/50 dark:hover:bg-rose-950/30">
                                        <span className="w-6 h-6 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-rose-500/20">
                                            ✕
                                        </span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug">
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Prerequisites: Client Needs to Provide */}
                    {data.clientRequirements && data.clientRequirements.length > 0 && (
                    <div className="rounded-3xl border border-[#4E12D4]/20 dark:border-[#4E12D4]/40 bg-white/80 dark:bg-slate-900/60 shadow-sm overflow-hidden backdrop-blur-xl transition-all duration-300 hover:shadow-md">
                        <div className="p-5 border-b border-[#4E12D4]/10 dark:border-[#4E12D4]/30 bg-gradient-to-r from-[#4E12D4]/5 to-transparent flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-2xl bg-[#4E12D4]/10 text-[#4E12D4] flex items-center justify-center border border-[#4E12D4]/20 shadow-sm">
                                    <Check className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h4 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                                        Client Needs to Provide
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Prerequisites and required assets from client</p>
                                </div>
                            </div>
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-bold text-[#4E12D4] border-[#4E12D4]/30 bg-[#4E12D4]/10">
                                {data.clientRequirements.length} Requirements
                            </Badge>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {data.clientRequirements.map((item: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:border-slate-200/80">
                                        <span className="w-6 h-6 rounded-xl bg-[#4E12D4]/10 text-[#4E12D4] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-[#4E12D4]/20">
                                            ✓
                                        </span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug">
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Tech stack + Workflow — category-gated */}
                    {(showTech || showWorkflow) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {showTech && (
                        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 shadow-sm overflow-hidden backdrop-blur-xl">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-[#4E12D4]/5 to-transparent flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#4E12D4]/10 text-[#4E12D4] flex items-center justify-center border border-[#4E12D4]/20 shadow-sm">
                                    <Cpu className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                                        Technology Stack
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Core architecture & tools</p>
                                </div>
                            </div>
                            <div className="p-6 space-y-3">
                                {webDevService?.techStack?.description && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{webDevService.techStack.description}</p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        ...(webDevService?.techStack?.frontend || []),
                                        ...(webDevService?.techStack?.backend || []),
                                        ...(webDevService?.techStack?.database || []),
                                        ...(webDevService?.techStack?.tools || []),
                                    ].map((t, i) => (
                                        <Badge
                                            key={`${t}-${i}`}
                                            variant="outline"
                                            className="rounded-xl px-3 py-1 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
                                        >
                                            {t}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                        )}

                        {showWorkflow && (
                        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 shadow-sm overflow-hidden backdrop-blur-xl">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-[#4E12D4]/5 to-transparent flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#4E12D4]/10 text-[#4E12D4] flex items-center justify-center border border-[#4E12D4]/20 shadow-sm">
                                    <Activity className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                                        Workflow & Process
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Step-by-step execution plan</p>
                                </div>
                            </div>
                            <div className="p-6">
                                {data.workflow?.length ? (
                                    <ol className="space-y-3">
                                        {data.workflow.map((step, idx) => (
                                            <li
                                                key={idx}
                                                className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80"
                                            >
                                                <div className="mt-0.5 h-6 w-6 rounded-xl bg-[#4E12D4]/10 border border-[#4E12D4]/20 flex items-center justify-center text-xs font-extrabold text-[#4E12D4] shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug pt-0.5">
                                                    {step}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <div className="text-sm text-slate-400 italic py-4 text-center">
                                        No workflow steps defined.
                                    </div>
                                )}
                            </div>
                        </div>
                        )}
                    </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Value Card */}
                    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 shadow-sm overflow-hidden backdrop-blur-xl">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-[#4E12D4]/5 to-transparent flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#4E12D4]/10 text-[#4E12D4] flex items-center justify-center border border-[#4E12D4]/20 shadow-sm">
                                <ReceiptText className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                                    Financial Summary
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Total investment breakdown</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="p-5 bg-gradient-to-br from-[#4E12D4]/10 via-[#C850FA]/10 to-transparent rounded-2xl border border-[#4E12D4]/20 text-center relative overflow-hidden shadow-inner">
                                <span className="text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                                    Grand Total Investment
                                </span>
                                <h2
                                    className={cn(
                                        'text-4xl font-black text-[#4E12D4] dark:text-[#C850FA] mt-1.5 tracking-tight',
                                        !canSeeFinancials && 'blur-[4px] opacity-50 select-none'
                                    )}
                                >
                                    {canSeeFinancials ? (
                                        <>
                                            {currency}
                                            {grandTotal.toLocaleString()}
                                        </>
                                    ) : (
                                        '******'
                                    )}
                                </h2>
                            </div>
                            <div className="space-y-3 text-sm font-medium pt-1">
                                {liveTotals.perService.length > 1 &&
                                    liveTotals.perService.map((s) => (
                                        <div key={s.category} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                                            <span className="text-slate-500 dark:text-slate-400">
                                                {CATEGORY_CONFIG[s.category as QuotationCategory]?.label || s.category}
                                            </span>
                                            <span
                                                className={cn(
                                                    'font-bold text-slate-800 dark:text-slate-200',
                                                    !canSeeFinancials && 'blur-[3px] select-none opacity-60'
                                                )}
                                            >
                                                {canSeeFinancials ? money(s.grandTotal) : '******'}
                                            </span>
                                        </div>
                                    ))}
                                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 text-emerald-600 dark:text-emerald-400">
                                    <span>
                                        Discount
                                    </span>
                                    <span
                                        className={cn(
                                            'font-extrabold',
                                            !canSeeFinancials && 'blur-[3px] select-none opacity-60'
                                        )}
                                    >
                                        {canSeeFinancials ? `− ${money(discountAmount)}` : '******'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Subtotal
                                    </span>
                                    <span
                                        className={cn(
                                            'font-bold text-slate-800 dark:text-slate-200',
                                            !canSeeFinancials && 'blur-[3px] select-none opacity-60'
                                        )}
                                    >
                                        {canSeeFinancials ? money(subtotal) : '******'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between py-1">
                                    <span className="text-slate-500 dark:text-slate-400">
                                        Tax / VAT
                                    </span>
                                    <span
                                        className={cn(
                                            'font-bold text-slate-800 dark:text-slate-200',
                                            !canSeeFinancials && 'blur-[3px] select-none opacity-60'
                                        )}
                                    >
                                        {canSeeFinancials ? money(taxAmount) : '******'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Milestones Card */}
                    {data.paymentMilestones && data.paymentMilestones.length > 0 && (
                        <div className="rounded-3xl border border-purple-500/20 dark:border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-transparent shadow-sm overflow-hidden backdrop-blur-xl">
                            <div className="p-4 border-b border-purple-500/15 bg-gradient-to-r from-purple-500/10 to-transparent flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Briefcase className="h-4 w-4 text-[#4E12D4] dark:text-[#C850FA] stroke-[2.5]" />
                                    <h4 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                                        Payment Milestones
                                    </h4>
                                </div>
                                <span className="text-[10px] font-extrabold text-[#4E12D4] bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-purple-500/20 shadow-2xs">
                                    {data.paymentMilestones.length} {data.paymentMilestones.length === 1 ? 'Term' : 'Milestones'}
                                </span>
                            </div>
                            <div className="p-5 space-y-3">
                                {data.paymentMilestones.map((m: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#4E12D4] to-[#1E0078] text-white text-xs font-bold font-mono flex items-center justify-center shadow-xs shrink-0">
                                                {String(idx + 1).padStart(2, '0')}
                                            </span>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                {m.label}
                                            </span>
                                        </div>
                                        {m.percentage > 0 && (
                                            <span className="text-xs font-extrabold font-mono text-[#4E12D4] dark:text-[#C850FA] bg-[#4E12D4]/10 dark:bg-[#C850FA]/15 px-2.5 py-1 rounded-xl shrink-0">
                                                {m.percentage}%
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <QuotationEmailDialog
                open={pickerOpen}
                clientId={dialogClientId}
                quotationLabel={`${data.quotationNumber ?? 'QTN'} • ${data.details?.title ?? ''}`.trim()}
                extraEmails={data.client?.email ? [data.client.email] : []}
                onClose={() => !isSending && setPickerOpen(false)}
                onSend={handleConfirmSend}
                isSending={isSending}
            />
        </div>
    );
}
