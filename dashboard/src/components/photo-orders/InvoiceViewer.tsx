"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SharedDialog } from "@/components/shared/shared-dialog";
import { COMPANY_INFO } from "@/components/quotation/document/brand";
import { QuotationDocument } from "@/components/quotation/document/QuotationDocument";
import { isPdfCancelled, saveBlob, useQuotationPdf } from "@/components/quotation/document/use-quotation-pdf";
import type { QuotationDocInput } from "@/components/quotation/document/types";
import { useDeletePhotoInvoiceMutation, useEmailPhotoInvoiceMutation, useGetPhotoInvoiceQuery } from "@/redux/features/photoOrder/photoOrderApi";
import type { PhotoInvoice } from "@/types/photo-order.type";
import { MONTHS } from "./helpers";

const apiError = (e: unknown, fallback: string) => (e as { data?: { message?: string } })?.data?.message || fallback;

/** The invoice as the A4 document renderer wants it (same renderer as quotations, invoice variant). */
export function toInvoiceDoc(inv: PhotoInvoice): QuotationDocInput {
    const c = inv.client;
    const period = `${MONTHS[inv.month - 1]} ${inv.year}`;
    return {
        quotationNumber: inv.invoiceNumber,
        company: COMPANY_INFO,
        client: {
            contactName: c?.teamMembers?.[0]?.name || c?.name || "Client",
            companyName: c?.name,
            ...(c?.address ? { address: c.address } : {}),
            ...(c?.emails?.[0] ? { email: c.emails[0] } : {}),
        },
        details: { title: `Invoice ${inv.invoiceNumber} — ${period}`, date: inv.issueDate, validUntil: inv.dueDate },
        currency: inv.currency,
        services: [],
        invoice: {
            periodLabel: period,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            totalImages: inv.totalImages,
            totalAmount: inv.totalAmount,
            items: inv.items.map((i) => ({ date: i.date, orderName: i.orderName, images: i.images, unitPrice: i.unitPrice, amount: i.amount })),
            ...(inv.paymentUrl ? { paymentUrl: inv.paymentUrl } : {}),
            paid: inv.paymentStatus === "paid",
        },
    };
}

export function InvoiceViewer({ invoiceId, onClose, canDelete }: { invoiceId: string; onClose: () => void; canDelete: boolean }) {
    const { data: invoice, isLoading } = useGetPhotoInvoiceQuery(invoiceId);
    const [emailInvoice, { isLoading: sending }] = useEmailPhotoInvoiceMutation();
    const [deleteInvoice, { isLoading: deleting }] = useDeletePhotoInvoiceMutation();
    const { generate, stage, busy } = useQuotationPdf();
    const [picking, setPicking] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [extra, setExtra] = useState("");

    const doc = useMemo(() => (invoice ? toInvoiceDoc(invoice) : null), [invoice]);
    const known = invoice?.client?.emails ?? [];

    const download = async () => {
        if (!doc || !invoice) return;
        try {
            saveBlob(await generate(doc), `${invoice.invoiceNumber}.pdf`);
        } catch (e) {
            if (!isPdfCancelled(e)) toast.error((e as Error).message || "Could not create the PDF");
        }
    };

    const send = async () => {
        if (!doc || !invoice) return;
        const emails = [...new Set([...selected, ...extra.split(/[,\s]+/).filter(Boolean)])];
        if (!emails.length) return toast.warning("Choose at least one recipient");
        if (emails.some((e) => !/^\S+@\S+\.\S+$/.test(e))) return toast.error("One of the email addresses is invalid");
        try {
            const pdf = await generate(doc);
            const res = await emailInvoice({ id: invoice._id, emails, pdf }).unwrap();
            const failed = res.data.recipients.filter((r) => r.status !== "sent").length;
            if (failed) toast.warning(`Sent, but ${failed} recipient${failed === 1 ? "" : "s"} failed`);
            else toast.success(`Invoice sent to ${emails.length} recipient${emails.length === 1 ? "" : "s"}`);
            setPicking(false);
        } catch (e) {
            if (!isPdfCancelled(e)) toast.error(apiError(e, "Failed to send the invoice"));
        }
    };

    const remove = async () => {
        if (!invoice || !confirm(`Delete invoice ${invoice.invoiceNumber}? Its orders become available to invoice again.`)) return;
        try {
            await deleteInvoice(invoice._id).unwrap();
            toast.success("Invoice deleted");
            onClose();
        } catch (e) {
            toast.error(apiError(e, "Failed to delete the invoice"));
        }
    };

    return (
        <>
            <SharedDialog
                open
                onOpenChange={(o) => !o && onClose()}
                title={invoice ? `Invoice ${invoice.invoiceNumber}` : "Invoice"}
                description={invoice ? `${invoice.client?.name ?? ""} · ${MONTHS[invoice.month - 1]} ${invoice.year}` : undefined}
                headerExtra={invoice && <Badge variant={invoice.paymentStatus === "paid" ? "default" : "outline"}>{invoice.paymentStatus === "paid" ? "Paid" : "Unpaid"}</Badge>}
                className="sm:max-w-4xl md:max-w-4xl"
                footer={
                    <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                        <div>
                            {canDelete && invoice?.paymentStatus === "pending" && (
                                <Button variant="ghost" className="text-destructive" disabled={deleting} onClick={remove}><Trash2 className="mr-1 size-4" />Delete</Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" disabled={!doc || busy} onClick={download}>{busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Download className="mr-1 size-4" />}Download PDF</Button>
                            <Button disabled={!doc || busy} onClick={() => { setSelected(known.slice(0, 1)); setPicking(true); }}><Mail className="mr-1 size-4" />Send email</Button>
                        </div>
                    </div>
                }
            >
                {isLoading || !doc ? (
                    <Skeleton className="h-[60vh] w-full" />
                ) : (
                    <div className="overflow-auto rounded-lg bg-[#e7e7eb] p-3 dark:bg-[#26262c]">
                        <div className="mx-auto w-fit">
                            <QuotationDocument data={doc} zoom={0.75} />
                        </div>
                    </div>
                )}
            </SharedDialog>

            <SharedDialog
                open={picking}
                onOpenChange={setPicking}
                title="Send invoice"
                description="The PDF is attached, with a Pay now link while the invoice is unpaid."
                className="sm:max-w-md md:max-w-md"
                footer={<div className="flex justify-end gap-2 p-4"><Button variant="outline" onClick={() => setPicking(false)}>Cancel</Button><Button disabled={sending || busy} onClick={send}>{(sending || busy) && <Loader2 className="mr-2 size-4 animate-spin" />}Send</Button></div>}
            >
                <div className="space-y-3">
                    {known.map((e) => (
                        <label key={e} className="flex cursor-pointer items-center gap-3 text-sm">
                            <Checkbox checked={selected.includes(e)} onCheckedChange={(c) => setSelected((s) => (c ? [...s, e] : s.filter((x) => x !== e)))} />
                            {e}
                        </label>
                    ))}
                    <Input value={extra} onChange={(ev) => setExtra(ev.target.value)} placeholder="Other recipients (comma separated)" />
                    {invoice && invoice.emailedTo.length > 0 && <p className="text-xs text-muted-foreground">Already sent to: {invoice.emailedTo.join(", ")}</p>}
                </div>
            </SharedDialog>
            {stage}
        </>
    );
}
