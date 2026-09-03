import { redirect } from "next/navigation";
import PaymentUI from "@/components/PaymentUI";

/**
 * Pay page.
 *
 * DESIGN COPIED from hr-management/payment. The old version read the invoice
 * straight out of MongoDB (inline Mongoose model + token decrypt). Per the new
 * architecture this app never touches the DB — it fetches the invoice snapshot
 * from the dev-hr-management server:
 *
 *   GET {NEXT_PUBLIC_API_URL}/payments/invoice/:token
 *
 * That endpoint does not exist yet — build it on the server side. Until then
 * this page just renders the "invalid link" fallback (redirect to "/").
 */

type InvoiceSnapshot = {
    invoiceNumber: string;
    clientName: string;
    clientAddress?: string;
    companyName?: string;
    totalAmount: number;
    currency: string;
    dueDate: string;
    paymentStatus?: string;
    [key: string]: unknown;
};

async function fetchInvoice(token: string): Promise<InvoiceSnapshot | null> {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) return null;
    try {
        const res = await fetch(
            `${base}/payments/invoice/${encodeURIComponent(token)}`,
            { cache: "no-store" },
        );
        if (!res.ok) return null;
        return (await res.json()) as InvoiceSnapshot;
    } catch {
        return null;
    }
}

export default async function PaymentPage({
    params,
    searchParams,
}: {
    params: Promise<{ token?: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const token =
        (typeof resolvedSearchParams.token === "string" && resolvedSearchParams.token
            ? resolvedSearchParams.token
            : null) ||
        (typeof resolvedParams.token === "string" && resolvedParams.token
            ? resolvedParams.token
            : null);

    if (!token) redirect("/");

    const invoice = await fetchInvoice(token);

    if (!invoice) redirect("/");

    if (invoice.paymentStatus?.toLowerCase() === "paid") {
        redirect(`/success?already_paid=true&invoice=${invoice.invoiceNumber}`);
    }

    return <PaymentUI invoice={JSON.parse(JSON.stringify(invoice))} />;
}
