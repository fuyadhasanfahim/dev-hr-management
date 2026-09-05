"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BRAND_GRADIENT } from "@/lib/brand";
import { formatMoney } from "@/lib/money";

interface PaymentConfirmation {
    clientName: string;
    projectTitle: string;
    quotationNumber?: string;
    amount: number;
    currency: string;
    paymentId: string;
    via: "stripe" | "paypal";
    paymentDate: string;
}

function SuccessContent() {
    const searchParams = useSearchParams();

    // URL params
    const method = searchParams.get("method");
    const orderId = searchParams.get("id");
    const paymentIntent = searchParams.get("payment_intent"); // Stripe Intent ID
    const redirectStatus = searchParams.get("redirect_status"); // Stripe Status
    const invoiceNumber = searchParams.get("invoice");
    const alreadyPaid = searchParams.get("already_paid") === "true";
    const token = searchParams.get("token");

    // Purely a UX status page based on the redirect's own query params — no
    // backend call here. The actual "did this get paid" record was already
    // made server-side before we ever got redirected to this page: PayPal's
    // capture-order call happens in PayPalWrapper's onApprove prior to the
    // redirect, and Stripe's payment_intent confirmation lands via the
    // signature-verified webhook independent of this page entirely. This
    // page never itself records a payment.
    const isSuccess =
        alreadyPaid ||
        redirectStatus === "succeeded" ||
        (method === "paypal" && !!orderId);
    const isFailure = !isSuccess && redirectStatus === "failed";
    // Ambiguous only when someone opens /success directly with no params at
    // all — resolved to "error" after a short grace period below.
    const isAmbiguous = !isSuccess && !isFailure && redirectStatus === null && method === null;

    const [status, setStatus] = useState<"loading" | "success" | "error">(() =>
        isSuccess ? "success" : isFailure ? "error" : "loading",
    );

    useEffect(() => {
        if (!isAmbiguous) return;
        const timer = setTimeout(() => setStatus("error"), 1500);
        return () => clearTimeout(timer);
    }, [isAmbiguous]);

    // Best-effort receipt fetch for display — purely informational, never
    // part of the payment-recording flow (see the comment above isSuccess).
    const [confirmation, setConfirmation] = useState<PaymentConfirmation | null>(null);
    useEffect(() => {
        if (!isSuccess || !token) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/payments/confirmation/${encodeURIComponent(token)}`,
                );
                const body = await res.json().catch(() => null);
                if (!cancelled && res.ok && body?.success) {
                    setConfirmation(body.data as PaymentConfirmation);
                }
            } catch {
                // Silent — the receipt card just doesn't render; the success message above still stands.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isSuccess, token]);

    const receiptDownloadUrl = token
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/payments/confirmation/${encodeURIComponent(token)}/pdf`
        : null;

    if (status === "loading") {
        return (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#9C46F4]" />
                <p className="text-[14px] text-[#9CA3AF]">
                    Verifying your payment…
                </p>
            </div>
        );
    }

    if (status === "error") {
        return (
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="mx-auto flex max-w-md flex-col items-center gap-4 py-14 text-center"
            >
                <XCircle className="h-14 w-14 text-red-400" />
                <h1 className="text-[24px] font-bold text-white">
                    Payment incomplete
                </h1>
                <p className="max-w-[320px] text-[14px] text-[#9CA3AF]">
                    We couldn&apos;t verify your transaction, or it was
                    cancelled. You have not been charged.
                </p>
                <Link
                    href="https://webbriks.com"
                    className="mt-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white shadow-[0_0_20px_0_rgba(26,79,255,0.30)]"
                    style={{ background: BRAND_GRADIENT }}
                >
                    Return to Web Briks
                </Link>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mx-auto flex max-w-md flex-col items-center gap-4 py-14 text-center"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 210, delay: 0.15 }}
            >
                <CheckCircle2 className="h-14 w-14 text-[#4ADE80]" />
            </motion.div>

            <h1 className="text-[26px] font-bold text-white">
                {alreadyPaid ? "Invoice already paid" : "Payment successful"}
            </h1>
            <p className="max-w-[320px] text-[14px] text-[#9CA3AF]">
                {alreadyPaid
                    ? "This invoice has already been paid securely. No further action is needed."
                    : "Thank you! Your payment has been securely processed."}
            </p>

            <div className="mt-2 flex w-full max-w-[340px] items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px]">
                <span className="text-[#9CA3AF]">Reference</span>
                <span className="font-mono font-semibold text-[#C9A9F9]">
                    {confirmation?.paymentId ||
                        paymentIntent ||
                        orderId ||
                        (invoiceNumber ? `INV-${invoiceNumber}` : "WB-PAY")}
                </span>
            </div>

            {confirmation && (
                <div className="mt-1 flex w-full max-w-[340px] flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5 text-[13px]">
                    <div className="flex items-center justify-between">
                        <span className="text-[#9CA3AF]">Client</span>
                        <span className="text-[#D1D5DB]">{confirmation.clientName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[#9CA3AF]">
                            {confirmation.quotationNumber ? "Quotation" : "Project"}
                        </span>
                        <span className="text-[#D1D5DB]">
                            {confirmation.quotationNumber || confirmation.projectTitle}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[#9CA3AF]">Amount paid</span>
                        <span className="font-semibold text-white">
                            {formatMoney(confirmation.amount, confirmation.currency)}
                        </span>
                    </div>
                </div>
            )}

            {receiptDownloadUrl && (
                <a
                    href={receiptDownloadUrl}
                    className="mt-1 flex w-full max-w-[340px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.06]"
                >
                    <Download className="h-4 w-4" />
                    Download Receipt
                </a>
            )}

            <Link
                href="https://webbriks.com"
                className="mt-3 rounded-xl px-6 py-3 text-[14px] font-bold text-white shadow-[0_0_20px_0_rgba(26,79,255,0.30)]"
                style={{ background: BRAND_GRADIENT }}
            >
                Return to Web Briks
            </Link>
        </motion.div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#9C46F4]" />
                    <p className="text-[14px] text-[#9CA3AF]">Loading…</p>
                </div>
            }
        >
            <SuccessContent />
        </Suspense>
    );
}
