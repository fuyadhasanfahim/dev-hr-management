"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
    CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function SuccessContent() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">(
        "loading",
    );
    const [referenceId, setReferenceId] = useState<string | null>(null);

    // URL params
    const from = searchParams.get("from");
    const method = searchParams.get("method");
    const orderId = searchParams.get("id");
    const paymentIntent = searchParams.get("payment_intent"); // Stripe Intent ID
    const redirectStatus = searchParams.get("redirect_status"); // Stripe Status
    const invoiceNumber = searchParams.get("invoice");
    const alreadyPaid = searchParams.get("already_paid") === "true";
    const token = searchParams.get("token");
    const phase = searchParams.get("phase");
    const amount = searchParams.get("amount");
    const currency = searchParams.get("currency");

    useEffect(() => {
        const verifyAndConfirm = async () => {
            // 1. Client-side verification based on URL params
            const isSuccess =
                alreadyPaid ||
                redirectStatus === "succeeded" ||
                (method === "paypal" && orderId);

            if (isSuccess) {
                setStatus("success");

                // 2. Synchronize with the backend
                if (from === "quotation" && token && phase) {
                    try {
                        const provider = method === "paypal" ? "paypal" : "stripe";
                        if (provider === "stripe" && paymentIntent) {
                            const confirmRes = await fetch(
                                `${process.env.NEXT_PUBLIC_API_URL}/api/quotation-payments/client/${encodeURIComponent(
                                    token,
                                )}/confirm`,
                                {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        phase,
                                        provider,
                                        paymentIntentId: paymentIntent,
                                        amountCents: amount ? Number(amount) : undefined,
                                        currency: currency || undefined,
                                    }),
                                },
                            );
                            const confirmJson = await confirmRes.json().catch(() => ({}));
                            if (confirmRes.ok) {
                                const ref =
                                    confirmJson?.data?.referenceId ||
                                    confirmJson?.data?.paymentIntentId ||
                                    confirmJson?.data?.paypalCaptureId;
                                if (ref) setReferenceId(String(ref));
                            }
                        } else if (provider === "paypal" && orderId) {
                            const confirmRes = await fetch(
                                `${process.env.NEXT_PUBLIC_API_URL}/api/quotation-payments/client/${encodeURIComponent(
                                    token,
                                )}/confirm`,
                                {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        phase,
                                        provider,
                                        paypalCaptureId: orderId,
                                        amountCents: amount ? Number(amount) : undefined,
                                        currency: currency || undefined,
                                    }),
                                },
                            );
                            const confirmJson = await confirmRes.json().catch(() => ({}));
                            if (confirmRes.ok) {
                                const ref =
                                    confirmJson?.data?.referenceId ||
                                    confirmJson?.data?.paymentIntentId ||
                                    confirmJson?.data?.paypalCaptureId;
                                if (ref) setReferenceId(String(ref));
                            }
                        } else {
                            // Already-paid paths may arrive without an id; fall back to tracker status.
                            const sRes = await fetch(
                                `${process.env.NEXT_PUBLIC_API_URL}/api/quotation-payments/client/${encodeURIComponent(
                                    token,
                                )}/status`,
                                { cache: "no-store" },
                            );
                            const sJson = await sRes.json().catch(() => ({}));
                            if (sRes.ok) {
                                const row = sJson?.data?.phases?.[phase];
                                const lastPaid =
                                    Array.isArray(row?.paidIntentIds) && row.paidIntentIds.length
                                        ? row.paidIntentIds[row.paidIntentIds.length - 1]
                                        : null;
                                const ref = row?.paymentIntentId || lastPaid;
                                if (ref) setReferenceId(String(ref));
                            }
                        }
                    } catch {
                        // UI already shows success; backend sync is best-effort here.
                    }
                } else if (invoiceNumber) {
                    // Legacy invoice flow (non-quotation payments)
                    try {
                        console.log("Confirming payment with backend...");
                        const confirmRes = await fetch(
                            `${process.env.NEXT_PUBLIC_API_URL}/api/payments/confirm`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    invoiceNumber,
                                    paymentIntentId: paymentIntent,
                                    paypalOrderId:
                                        method === "paypal"
                                            ? orderId
                                            : undefined,
                                }),
                            },
                        );

                        const confirmData = await confirmRes.json();

                        if (confirmData.alreadyPaid) {
                            console.log(
                                "Invoice was already paid. No duplicate processing.",
                            );
                        } else if (!confirmRes.ok) {
                            console.error(
                                "Backend confirmation failed:",
                                confirmData,
                            );
                        } else {
                            console.log(
                                "Backend record updated to PAID successfully.",
                            );
                        }
                    } catch (err) {
                        console.error(
                            "Error connecting to backend for confirmation:",
                            err,
                        );
                    }
                }
            } else if (redirectStatus === "failed") {
                setStatus("error");
            } else if (
                redirectStatus === null &&
                method === null &&
                !alreadyPaid
            ) {
                // If someone just visits /success directly without params
                setTimeout(() => setStatus("error"), 1500);
            }
        };

        verifyAndConfirm();
    }, [
        from,
        redirectStatus,
        method,
        orderId,
        invoiceNumber,
        paymentIntent,
        alreadyPaid,
        token,
        phase,
        amount,
        currency,
    ]);

    if (status === "loading") {
        return (
            <div className="min-h-[calc(100vh-80px)] w-full flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-4" />
                <h2 className="text-lg font-medium text-muted-foreground tracking-tight">
                    Verifying payment...
                </h2>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="min-h-[calc(100vh-80px)] w-full flex flex-col items-center justify-center p-4 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-[460px] z-10"
                >
                    <Card className="border-border shadow-xl rounded-3xl overflow-hidden relative">
                        <div className="h-1.5 w-full bg-destructive" />
                        <CardHeader className="pt-12 pb-6 text-center flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center ring-4 ring-destructive/10 text-destructive">
                                <AlertCircle size={40} />
                            </div>
                            <CardTitle className="text-3xl font-bold tracking-tight">
                                Payment Incomplete
                            </CardTitle>
                            <CardDescription className="text-base">
                                We couldn&apos;t verify your transaction or it
                                was cancelled.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="px-10 pb-10">
                            <Button
                                asChild
                                variant="outline"
                                className="w-full h-14 text-sm font-semibold rounded-2xl shadow-xs"
                            >
                                <Link href="https://webbriks.com">
                                    <Home className="w-4 h-4 mr-2" />
                                    Return to Web Briks
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-200px)] w-full flex flex-col items-center justify-center p-4 relative z-10">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-[460px] z-10"
            >
                <Card className="bg-card border-border shadow-xl rounded-3xl overflow-hidden relative">
                    <div className="h-1.5 w-full bg-teal-500" />

                    <CardHeader className="pt-12 pb-6 text-center flex flex-col items-center gap-4">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                                type: "spring",
                                stiffness: 200,
                                delay: 0.2,
                            }}
                            className="bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-full w-20 h-20 flex items-center justify-center shadow-sm ring-4 ring-teal-500/10"
                        >
                            <CheckCircle2 size={36} strokeWidth={2.5} />
                        </motion.div>

                        <Badge
                            variant="secondary"
                            className="bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 border-none font-semibold px-4 py-1.5"
                        >
                            {alreadyPaid
                                ? "Already Paid"
                                : "Transaction Successful"}
                        </Badge>

                        <div className="space-y-2">
                            <CardTitle className="text-3xl font-bold tracking-tight">
                                {alreadyPaid ? "Invoice Paid" : "Thank You!"}
                            </CardTitle>
                            <CardDescription className="text-base max-w-[300px] mx-auto">
                                {alreadyPaid
                                    ? "You have already securely paid this invoice."
                                    : "Your payment has been securely processed. A receipt has been sent to your email address."}
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="px-10 pb-6">
                        <div className="w-full flex items-center justify-between border-t border-b border-border py-4">
                            <span className="text-sm font-medium text-muted-foreground">
                                Reference ID
                            </span>
                            <span className="font-mono text-sm font-semibold text-teal-600 dark:text-teal-400">
                                {referenceId || paymentIntent || orderId || "—"}
                            </span>
                        </div>
                    </CardContent>

                    <CardFooter className="px-10 pb-10">
                        <Button
                            asChild
                            variant="outline"
                            className="w-full h-14 text-sm font-semibold rounded-2xl shadow-xs"
                        >
                            <Link href="https://webbriks.com">
                                <Home className="w-4 h-4 mr-2" />
                                Return to Web Briks
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex flex-col items-center justify-center p-4">
                    <Loader2 className="w-12 h-12 text-teal-600 animate-spin mb-4" />
                    <h2 className="text-xl font-medium text-muted-foreground tracking-tight">
                        Loading...
                    </h2>
                </div>
            }
        >
            <SuccessContent />
        </Suspense>
    );
}
