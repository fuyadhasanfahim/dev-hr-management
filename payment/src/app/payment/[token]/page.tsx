import { redirect } from "next/navigation";
import PaymentUI from "@/components/PaymentUI";

/**
 * Pay page — fetches the invoice snapshot from the dev-hr-management server:
 *
 *   GET {NEXT_PUBLIC_API_URL}/api/payments/invoice/:token
 *
 * The token itself IS the auth for this page; there is no session. The
 * server validates it (signature, expiry, single-use, live amount-due
 * recompute) and returns 410/409 for a dead link — this page just reacts to
 * that rather than doing any of its own trust decisions.
 */

export interface InvoiceSnapshot {
    invoiceNumber: string;
    quotationNumber: string;
    projectTitle: string;
    currency: string;
    amountDue: number;
    client: { name: string; email?: string };
    lines: Array<{ label: string; sublabel?: string; amount: number }>;
}

type FetchResult =
    | { kind: "ok"; invoice: InvoiceSnapshot }
    | { kind: "already_paid" }
    | { kind: "invalid" };

async function fetchInvoice(token: string): Promise<FetchResult> {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) return { kind: "invalid" };

    try {
        const res = await fetch(
            `${base}/api/payments/invoice/${encodeURIComponent(token)}`,
            { cache: "no-store" },
        );
        const body = await res.json().catch(() => null);

        if (res.ok && body?.success) {
            return { kind: "ok", invoice: body.data as InvoiceSnapshot };
        }

        // The server reports "already paid in full" as 409 — treat that as
        // a success-page redirect rather than a dead link.
        if (res.status === 409) {
            return { kind: "already_paid" };
        }

        return { kind: "invalid" };
    } catch {
        return { kind: "invalid" };
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

    const result = await fetchInvoice(token);

    if (result.kind === "already_paid") {
        redirect(`/success?already_paid=true`);
    }
    if (result.kind === "invalid") {
        redirect("/");
    }

    return <PaymentUI invoice={result.invoice} token={token} />;
}
